# Sanjaya Store: Architecture

Status: **built (Phases 1 to 19), Phase 20 launch checks in progress.** Last updated 2026-11-03. This file describes what exists in the code today.

## 1. Summary of the recommendation

| Layer | Choice | Deployed how |
|---|---|---|
| Website (storefront, customer account, admin and staff app) | React 19 + TypeScript + Vite + Tailwind CSS 4, one single-page app | `dist/` folder, Netlify drag and drop (or GitHub auto-deploy) |
| Database | Supabase PostgreSQL, region **ap-south-1 (Mumbai)** | Supabase project; schema pushed with Supabase CLI |
| Login and OTP | Supabase Auth (email + phone OTP through an SMS provider) | Supabase dashboard settings |
| Server code (payments, webhooks, order approval, delivery fees, KYC callbacks, reminders) | Supabase Edge Functions (Deno, TypeScript) | Supabase CLI: `supabase functions deploy` |
| Product images, proof-of-delivery photos | Supabase Storage (public bucket for products, private buckets for proofs and KYC) | Supabase |
| Payments | Stripe Checkout (hosted page) on the existing Stripe UAE account, **test mode first** | Stripe dashboard + webhook pointed at an Edge Function |
| Scheduled jobs (installment reminders, payment-link expiry) | Supabase Cron (pg_cron) calling Edge Functions | Supabase |
| App experience | Installable PWA: web manifest + service worker | Ships inside `dist/` |

**Why this fits your drag-and-drop requirement:** every piece of server code lives in Supabase, not Netlify. The Netlify side is only static files, so dragging `dist/` into Netlify is a complete website deploy. The old site used Netlify Functions for Stripe, and those do **not** run from drag and drop, which is why its notes told you to deploy through GitHub. This design removes that limitation.

## 2. Tradeoffs considered

### Backend: Supabase vs alternatives

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Supabase** | Real PostgreSQL (orders, payments and installments need relational integrity and transactions); Row Level Security enforces staff roles in the database itself; Auth, Storage, Edge Functions and Cron in one place; Mumbai region; generous free tier | Edge Functions are Deno, deployed by CLI (one-time setup by a developer); free projects pause after 7 days idle, so production needs Pro | **Recommended** |
| Firebase | Mature, good mobile SDKs | NoSQL is a poor fit for orders, ledgers and reports; Cloud Functions need the paid Blaze plan; role security rules are harder to audit | Not recommended |
| Netlify Functions + a separate database (Neon etc.) | Server code next to the site | Breaks drag-and-drop deploys (functions need Git or CLI deploys); two vendors to manage | Not recommended |
| Custom Node server (Render, Railway, VPS) | Full control | You asked for no continuously running server; more to maintain and secure | Not recommended |

### Frontend: Vite SPA vs Next.js

A Vite single-page app produces plain static files, which is exactly what drag-and-drop wants. Next.js with static export would also work, but its server features (the reason to pick it) would be unused. Tradeoff: an SPA is less SEO-friendly out of the box. Phase 19 handles this with per-route meta tags, a generated `sitemap.xml`, structured data, and optionally pre-rendering key pages at build time.

### One app for customers, admin and staff

You asked for one Super Admin application with staff logging into the same one. We go a step further and keep it in the same codebase and deploy as the storefront, under `/admin`. Admin screens are loaded on demand, so customers never download them. **Security never relies on hiding screens:** every admin read and write is checked by database Row Level Security and by role checks inside Edge Functions.

### Payments: Stripe Checkout (hosted)

Checkout redirects to Stripe's own page, so card data never touches our site (smallest PCI scope). Order totals are always recalculated on the server from database prices, delivery rules and coupons; the browser's numbers are never trusted. An order is marked paid only by a verified Stripe webhook, never by the success page.

## 3. Security model

- The website contains only **public** keys: Supabase URL + anon key, Stripe **publishable** key.
- The Stripe secret key, webhook signing secret, Supabase service-role key and KYC credentials live only in **Supabase secrets**.
- Two automatic guards already exist in the code: `src/lib/env.ts` refuses to start if a secret-looking key is placed in a `VITE_` variable, and `scripts/verify-dist.mjs` fails the build if any secret pattern appears in `dist/`.
- Roles: `customer`, `super_admin`, `operations`, `delivery`, `collections`, `support`. Roles are stored in the database and enforced by RLS policies.
- **Sign-in is two-step**: password, then a 6-digit code emailed to the account. The server enforces it with Supabase Auth's access token hook (`custom_access_token_hook`): a password alone, or a code alone, never gives a session. Wrong passwords are limited to 5 per 15 minutes and reset codes to 3 an hour.
- Location is requested only at checkout and only after the customer taps to allow it; manual entry always works.
- KYC images go to a private storage bucket; access is limited to authorised roles and is logged.

## 4. Data model (as built)

All money is stored as integer **paise**. Every table has row-level security; the browser only ever uses the public anon key, and anything sensitive goes through `SECURITY DEFINER` functions that check the caller's role (`has_any_role`, which always lets `super_admin` through).

- Identity: `profiles`, `staff_roles`, `addresses`
- Catalogue: `categories`, `products`, `product_variants`, `product_images`, `inventory_movements`, `reviews`, `wishlists`, `banners`
- Commerce: `orders`, `order_items`, `order_status_events` (tracking timeline), `order_status_transitions` (allowed moves and which role may make them), `coupons`, `coupon_redemptions`
- Payments: `payments`, `refunds`, `stripe_events` (idempotent webhook log)
- Delivery: `delivery_zones`, `pincodes`, `pincode_prefixes`, `delivery_assignments`, `delivery_attempts`, `proof_of_delivery`, `order_delivery_codes` (4-digit door code)
- Installments: `installment_plans`, `installments`, `collection_tasks`, `collection_notes`
- KYC: `kyc_applications` (document type, last 4 digits and an HMAC fingerprint only; never the full number)
- Growth: `referral_campaigns`, `referrals`, `reward_grants`, `loyalty_ledger`
- Support: `support_tickets`, `support_messages`
- System: `site_settings` (admin-editable, some public), `audit_log`, `notification_outbox` (emails/WhatsApp waiting to be sent)

Storage buckets: `product-images` (public), `delivery-proofs` (private, delivery staff and admins), `kyc-documents` (private; customers upload to their own folder only, only the Super Admin can read).

## 5. Order lifecycle

```
Payment Pending → Awaiting Approval (paid) → Order Confirmed (Super Admin approves)
  → Processing → Packed → Dispatched → In Transit → Out for Delivery → Delivered
Side states: Delayed, Delivery Failed, Cancelled, Return Requested, Returned, Refunded
```

Status only changes through the `transition_order` database function (and the Stripe webhook for payments). It checks `order_status_transitions` for the caller's role, writes a row to `order_status_events`, and queues a customer notification. Delivered needs the customer's door code (`complete_delivery`). The customer timeline reads from `order_status_events`, so tracking always reflects real records.

## 5b. Server functions (Supabase Edge Functions)

| Function | Called by | Does |
|---|---|---|
| `create-checkout` | Customer at checkout or paying an installment | Recalculates the amount on the server and opens a Stripe Checkout page. Refuses live keys unless the Super Admin switched on live payments (and live installments for installment payments). |
| `stripe-webhook` | Stripe | Verifies the signature, records payments and refunds, moves the order to Awaiting Approval. |
| `admin-refund` | Super Admin | Issues a Stripe refund. |
| `kyc-submit` | Customer | Validates the ID format, stores only last 4 digits plus a keyed fingerprint (`KYC_HASH_SALT`), rejects duplicates. |
| `dispatch-notifications` | Supabase Cron every 5 minutes | Sends queued emails through Resend; no-op until Resend is configured. |
| `sitemap` | Search engines via `/sitemap.xml` | Lists live products and categories. |

## 5c. Website structure

One React app serves three audiences, separated by route and role:

- **Storefront**: home, categories, search/listing, product, cart, checkout, delivery checker, installments info, policies, about, contact, install.
- **Customer account** (`/account`): orders and tracking, addresses, profile with mobile verification, identity check, installments, rewards and referrals, support tickets.
- **Admin** (`/admin`, role-gated per page): dashboard, orders and approvals, products and CSV import, inventory, delivery riders' queue, collections, identity checks, support, referrals, staff roles, settings.

The site is an installable PWA (`public/manifest.webmanifest`, `public/sw.js`). The service worker never caches API or Supabase calls, so prices, stock and order status are always fresh.

## 6. Delivery fee rule

Calculated on the server at checkout:

1. Look up the pincode. Not serviceable: block checkout with a clear message.
2. "First eligible order" means the customer has no earlier paid order that was not cancelled or refunded (per customer account; see USER_TODO.md decisions).
3. First eligible order: ₹0. Otherwise the configured fee (default ₹50).
4. Estimate from the pincode's zone: standard 2 to 7 days, remote up to 12 to 13 days.
5. Fee and estimate shown before payment and saved on the order.

## 7. Folder structure

```
sanjaya-store/
├── public/               Static files copied into dist/ as-is
│   ├── _redirects        SPA routing for Netlify (deep links work)
│   ├── _headers          Security and caching headers for Netlify
│   ├── manifest.webmanifest, sw.js, offline.html, icons/   PWA
│   └── brand/legacy/     Old Sanjaya Trading logo, kept for reference only
├── src/
│   ├── app/              Router and app-level setup
│   ├── components/       Shared UI (layout, buttons, forms)
│   ├── config/           Public business identity
│   ├── features/         One folder per business area (see features/README.md)
│   ├── lib/              env guard, Supabase client, money helpers
│   ├── pages/            Route-level screens
│   ├── styles/           Tailwind entry and brand tokens
│   └── types/            Shared types (database types generated in Phase 2)
├── supabase/
│   ├── migrations/       SQL schema, RLS policies and database functions
│   ├── tests/            Database tests (run by CI)
│   ├── templates/        Login email templates
│   └── functions/        Edge Functions (see 5b)
├── scripts/verify-dist.mjs  Post-build secret scan
├── docs/REQUIREMENTS.md  Full requirements captured from the brief
├── ARCHITECTURE.md · DEPLOYMENT.md · PROJECT_STATUS.md
└── netlify.toml          Build settings; the live site auto-deploys from main
```

## 8. Third-party services and costs

Prices are indicative list prices as of late 2026; confirm before signing up. Nothing paid is introduced without your approval.

| Service | Needed for | Cost | When |
|---|---|---|---|
| Netlify | Website hosting | Free tier is enough to start | Now |
| Supabase | Database, auth, functions | Free to develop; **Pro about US$25/month** for production (no pausing, daily backups) | Phase 2 (free), launch (Pro) |
| Stripe (existing UAE account) | Payments | Per-transaction fees on your Stripe UAE pricing; international cards and currency conversion cost more | Phase 9 |
| SMS OTP provider (e.g. MSG91, Twilio) | Phone login, OTP | Pay per SMS; India needs DLT template registration | Phase 5 |
| Maps and reverse geocoding (e.g. Google Maps Platform, or OpenStreetMap-based provider) | Checkout map pin | Google has a monthly free credit then pay per use; OSM-based providers have free tiers with limits | Phase 8 |
| KYC provider authorised in India (e.g. IDfy, HyperVerge, Digio) | ID, liveness, fraud checks | Per verification, contract-based | Phase 16 |
| WhatsApp Business Platform (Meta, or a BSP) | Order notifications | Per conversation | Phase 19 |
| Email (e.g. Resend, Postmark) | Receipts, reminders | Free tier then low monthly fee | Phase 9 or 19 |

## 9. Compliance items that need a professional, not code

These are flagged so they are handled before launch; they are not legal advice.

- **Stripe:** confirm with Stripe that your UAE account may sell to Indian customers in INR for goods fulfilled from Mumbai. Indian-issued cards can be declined on cross-border merchants, and UPI is generally not available to a UAE Stripe account. Live mode stays off until this is confirmed.
- **Six-installment plans:** in India, letting customers pay later with no partner lender can be treated as credit. Get advice on RBI digital lending rules (or partner with a licensed NBFC or a BNPL provider) before enabling it live.
- **KYC and location data:** India's Digital Personal Data Protection Act 2023 applies (consent, purpose limitation, retention, breach notice).
- **E-commerce rules:** the Consumer Protection (E-Commerce) Rules 2020 require seller details, a grievance officer, and clear return and refund policies on the site.
- **Tax and import:** selling in India from a UAE entity with a Mumbai dispatch office needs GST registration and the right import and entity structure. Confirm with an Indian CA.
