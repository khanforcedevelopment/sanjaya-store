# Sanjaya Store: Architecture

Status: **proposed in Phase 1, awaiting owner approval.** Nothing below Phase 1 is built yet.

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
- Location is requested only at checkout and only after the customer taps to allow it; manual entry always works.
- KYC images go to a private storage bucket; access is limited to authorised roles and is logged.

## 4. Planned data model (built in Phase 2)

Core tables, all money stored as integer **paise**:

- Identity: `profiles`, `staff_roles`, `addresses`
- Catalogue: `categories`, `products`, `product_variants`, `product_images`, `inventory_movements`, `reviews`, `wishlists`
- Commerce: `carts`, `cart_items`, `coupons`, `orders`, `order_items`, `order_status_events` (the tracking timeline, one row per change, with who and when)
- Payments: `payments`, `refunds`, `stripe_events` (idempotent webhook log)
- Delivery: `delivery_zones`, `pincodes` (pincode to zone, serviceable flag, estimate days), `delivery_settings` (first-order-free rule, ₹50 fee), `delivery_assignments`, `delivery_attempts`, `proof_of_delivery`
- Installments: `installment_plans`, `installment_schedules`, `installment_payments`, `collection_tasks`, `eligibility_rules`
- KYC: `kyc_applications`, `kyc_checks` (provider results only; no raw credentials)
- Growth: `referral_codes`, `referrals`, `reward_campaigns`, `loyalty_ledger`, `banners`
- System: `site_settings`, `audit_log`

## 5. Order lifecycle

```
Order Placed → Payment Pending → Payment Confirmed → Awaiting Approval → Order Confirmed
  → Processing → Packed → Dispatched → In Transit → Out for Delivery → Delivered
Side states: Delayed, Delivery Attempt Failed, Cancelled, Return Requested, Returned, Refunded
```

Only Edge Functions change order status, each change writes a row to `order_status_events`, and the customer timeline reads from that table, so tracking always reflects real records.

## 6. Delivery fee rule

Calculated on the server at checkout:

1. Look up the pincode. Not serviceable: block checkout with a clear message.
2. "First eligible order" means the customer has no earlier order that reached Payment Confirmed and was not cancelled or refunded (exact definition to be confirmed by you, see PROJECT_STATUS.md).
3. First eligible order: ₹0. Otherwise the configured fee (default ₹50).
4. Estimate from the pincode's zone: standard 2 to 7 days, remote up to 12 to 13 days.
5. Fee and estimate shown before payment and saved on the order.

## 7. Folder structure

```
sanjaya-store/
├── public/               Static files copied into dist/ as-is
│   ├── _redirects        SPA routing for Netlify (deep links work)
│   ├── _headers          Security and caching headers for Netlify
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
│   ├── migrations/       SQL schema and RLS policies (Phase 2)
│   └── functions/        Edge Functions (Phase 2 onward)
├── scripts/verify-dist.mjs  Post-build secret scan
├── docs/REQUIREMENTS.md  Full requirements captured from the brief
├── ARCHITECTURE.md · DEPLOYMENT.md · PROJECT_STATUS.md
└── netlify.toml          Only used if you later connect Netlify to GitHub
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
