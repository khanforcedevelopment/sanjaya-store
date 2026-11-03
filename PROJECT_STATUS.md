# Sanjaya Store: Project Status

Last updated: 2026-11-03 · Building all phases continuously (owner approved on 2026-11-03: no stop between phases, merge when tests pass)

| Phase | Name | Status |
|---|---|---|
| 1 | New project initialization | ✅ Done, merged |
| 2 | Database and backend architecture | ✅ Done, merged |
| 3 | VIP branding and homepage | ✅ Done, merged |
| 4 | Product catalogue | ✅ Done, merged |
| 5 | Customer authentication | ✅ Done, merged |
| 6 | Cart and checkout | ✅ Done, merged |
| 7 | Delivery charges and serviceability | ✅ Done, merged |
| 8 | Customer GPS address | ✅ Done, merged |
| 9 | Stripe integration | ✅ Done, merged (test mode; live blocked until approved) |
| 10 | Order approval system | ✅ Done, merged |
| 11 | In-house delivery management | ✅ Done, merged |
| 12 | Customer delivery tracking | ✅ Done, merged |
| 13 | Super Admin dashboard | ✅ Done, merged |
| 14 | Staff role management | ✅ Done, merged |
| 15 | Six-installment system | ✅ Done, merged (test mode; live blocked until legal review) |
| 16 | KYC and automatic eligibility | ✅ Done, merged (document review; automatic provider optional later) |
| 17 | Customer dashboard | ✅ Done, merged |
| 18 | Referrals and promotions | ✅ Done, merged |
| 19 | PWA, notifications and SEO | Not started |
| 20 | Testing and Netlify launch | Not started |

---

## Phase 18 report: referrals and promotions

### Features completed
- **Invite links** (`?ref=CODE`) are remembered and attached when the friend signs up. A friend who joined without the link can add the code on *My account → Rewards* before their first order.
- **Rewards are automatic**: when a friend's first order is delivered, they count; every N friends (default 5) issue the campaign reward (coupon/gift voucher or points). Customers see progress, friends and rewards on the Rewards page (Phase 17).
- **Staff → Referrals** (Super Admin): create, edit, switch campaigns on and off (headline, friends needed, reward type and value, description, end date); see rewards issued and mark physical gifts as sent; review every referral with the friend's order count and a **same phone** warning; reject a suspicious referral with a reason (audited).
- **Promotions already in place**: coupons and banners (Staff → Banners & coupons), flash sale with countdown (Settings → Flash sale), loyalty points with coupon redemption.

### Database changes
- `20261103001500_referrals_admin.sql`: `reject_referral` (Super Admin, reason required, audited) and `admin_referrals` (referrals with names, friend's orders and same-phone flag).

### Tests run
- Database tests: 170 assertions pass (new: only Super Admin can list or reject, reason required).
- Browser test on local Supabase: referrer copies code → friend signs up through the link and is linked → second friend enters a wrong code (refused) then the right one → referrer sees "2 joined" → Super Admin changes the reward to ₹750 and the customer page shows it immediately → referral rejected with reason, audit written. No browser errors.

---

## Phase 17 report: customer dashboard

### Features completed
- **My account** now has: Overview, **Orders**, Profile (with verified mobile), Addresses, Wishlist, Installments, Verify identity, **Rewards**, **Help**. Works on phone (scrolling tab bar) and desktop (side menu).
- **Orders**: every order with picture, status, delay and installment badges, date and total. Opens the order page with tracking, timeline and the 4-digit delivery code (Phase 12).
- **Cancel order**: customers can cancel while the order is awaiting payment, awaiting approval or confirmed (not after packing). Stock is released and a paid order is flagged for refund.
- **Rewards**: invite progress (5 boxes), share or copy the invite link, friends and whether they count yet, reward coupons with expiry, loyalty points with "Get coupon" redemption.
- **Help**: start a request (optionally about an order, also from the order page), chat-style conversation, status "Waiting for our team / We replied / Resolved", WhatsApp and email shown.
- **Staff → Support** (`/admin/support`, support role): queue of waiting requests, oldest first, reply, mark resolved, link to the order. A staff reply queues an email to the customer; the customer's reply reopens the request.

### Database changes
- `20261103001400_support.sql`: ticket status follows the conversation; at most 5 new requests a day; a request can only be linked to the customer's own order.

### Tests run
- Database tests: 165 assertions pass (new: customers cannot post as staff, see only their own requests, status changes on reply and reopen).
- Browser test on local Supabase: place an order → it appears in My orders → cancel with a reason → status Cancelled → "Get help with this order" opens a request → support staff replies in the staff panel → customer sees the reply and "We replied" → customer answers, request reopens → points redemption refuses more points than the balance → no sideways scroll on a phone on any account page, no browser errors.

---

## Phase 16 report: identity check (KYC) and automatic eligibility

### Features completed
- **My account → Verify identity**: customer picks PAN, passport, driving licence or voter ID, enters the number and name, uploads the document photo (back optional) and a selfie holding it, and agrees to the check. Status shows "Documents received", "Identity verified" or "Not approved" with the reason.
- **No Aadhaar** is collected: only licensed e-KYC providers may process Aadhaar numbers.
- **Privacy**: the document number is never stored. The server function `kyc-submit` turns it into a fingerprint with a secret key (to block one ID on many accounts) and keeps only the last 4 characters. Photos are in a private bucket that only the Super Admin can open, through links that expire after 5 minutes.
- **Admin → Identity checks** (Super Admin): photos, document type, last 4, name; Approve or Reject with a reason (audited, customer emailed). Duplicate IDs are rejected automatically.
- **Verified mobile**: Profile has "Verify your mobile number" with an SMS code. Phone confirmation is now required in the auth settings, so a number counts only after the code.
- **Automatic eligibility**: once mobile and identity are verified, installments unlock straight away at checkout and on /installments (rules from Settings: account age, active plans, overdue installments, order amount).

### Database changes
- `20261103001300_kyc.sql`: `kyc_applications` gets `document_last4`, `document_paths`, `consent_at`; private `kyc-documents` bucket with own-folder upload and Super Admin read; server-only `register_manual_kyc` (format, own-folder files, one review at a time, 3 tries a day, duplicate detection). KYC provider setting is now `manual`.

### Tests run
- Database tests: 161 assertions pass (new: server-only, no Aadhaar, own-folder files, one review at a time, duplicate rejected).
- Browser test on local Supabase: verify mobile with SMS code → wrong PAN format refused → documents submitted, row stores a 64-character fingerprint and last 4 only, the PAN itself appears nowhere → a second account with the same PAN is rejected as duplicate → Super Admin sees both photos, must write a reason, approves → customer is immediately eligible for installments. No browser errors.

### Next requirements (you)
- Set the `KYC_HASH_SALT` secret and turn on **Confirm phone** in Supabase (DEPLOYMENT.md section E2).
- An SMS provider is needed before customers can verify their mobile (USER_TODO, paid).

---

## Phase 15 report: six monthly installments (test mode)

### Features completed
- **Checkout**: when every item in the bag allows installments, customers see "Pay in 6 monthly installments · ₹X today". If they are not eligible yet, the reasons are listed with a link to fix each one (verify mobile, verify identity, pay an overdue installment). Choosing it shows the plain-language terms and an "I agree" box; the order button then reads "Place order · pay ₹X" (first installment).
- **Amounts in whole rupees**: the later payments are rounded down to the rupee and the first payment takes the remainder, so the total is exactly the order total. No interest, no fee.
- **Info page `/installments`** (linked from product pages and the footer): how it works, the terms, your eligibility checklist, and which categories allow it (mobile phones off).
- **My account → Installments**: every plan with progress, schedule and status, and a "Pay installment N" button that opens Stripe for the next payment.
- **Order page**: installment orders ask for the first installment, not the full total, and link to the plan.
- **Collections desk `/admin/collections`** (collections staff and Super Admin): overdue installments with the customer's phone, status (open, contacted, promised, resolved, escalated), promised date and notes. Super Admin can assign tasks and waive an installment with a reason (audited).
- **Safety**: with live Stripe keys, installment payments are refused unless *Settings → Installments → live enabled* is on, separately from normal live payments.

### Database changes
- `20261103001200_installments.sql`: whole-rupee `installment_split`.

### Tests run
- Database tests: 155 assertions pass (new: split amounts and total preserved).
- Browser test on local Supabase: new customer sees "verify mobile" and "verify identity" → after both, eligible → laptop in bag → installment option, button disabled until terms are accepted → first installment ₹15,704 of ₹94,199 paid via signed webhook → plan active, installments 2–6 scheduled → "Pay installment 2" opens Stripe → overdue task appears in Collections → note and promised date saved → Super Admin waives with reason (audit log written) → no sideways scroll on a phone, no browser errors.

### Next requirements (you)
- A lawyer must confirm whether this plan counts as lending in India (USER_TODO, Before launch). The terms text is marked as a draft until then.

---

## Phases 10–14 report: staff panel, approvals, delivery and tracking

### Features completed
- **Staff panel at `/admin`** (separate from the shop, works on phone and desktop). Each person only sees the sections their role allows.
- **Dashboard** (Phase 13): payments, refunds, paid orders, new customers, orders awaiting approval, delayed orders, low stock, overdue installments, payments per day and top products.
- **Order approval** (Phase 10): order list with status filters, delayed filter and search. The order page shows items, totals, payments, timeline and the next allowed steps for your role (Approve order, Processing, Packed, Dispatched, ...). Super Admin refunds from the payment row. Delay reports with a reason and new date are shown to the customer.
- **In-house delivery** (Phase 11): assign a rider and date. Riders get **My deliveries** with call and map buttons, amount to collect, Start delivery, Delivered (4-digit customer code, receiver name, optional doorstep photo) and Could not deliver (reason, note, new date).
- **Customer tracking** (Phase 12): the order page shows a progress bar, expected dates, delay notice, the full timeline, and the **4-digit delivery code** once the parcel is dispatched. The rider never sees the code.
- **Products**: list with search and low-stock filter, create and edit products, variants (price, MRP, stock changes with reason), image upload.
- **CSV import**: check the file first (per-row errors), then import; template download; Super Admin can remove all demo products in one click.
- **Banners & coupons**, **Delivery zones** (days, fee, remote flag, pincode exceptions).
- **Staff** (Phase 14, Super Admin): find a person by email or phone and switch roles on or off. The last Super Admin cannot be removed.
- **Settings** (Super Admin): delivery fee, first order free, flash sale, loyalty, returns, store details. Live payments and live installments need the word LIVE typed to switch on, and the server still refuses live Stripe keys while they are off.

### Database changes
- `20261103001100_admin.sql`: `list_delivery_staff()` (operations) and `list_staff()` (Super Admin).

### Tests run
- Database tests: 152 assertions pass, including the new staff-list permission checks.
- Browser test against local Supabase: customer pays → admin opens every staff page → changes the delivery fee and back → finds a customer in Staff → approves, processes, packs, assigns a rider, dispatches → customer sees the same 4-digit code → rider starts delivery → wrong code rejected → right code plus photo marks the order delivered with the photo saved → admin order page on a phone has no sideways scroll. No browser errors.
- Web checks (unit tests, build, secret scan) pass.

### Next requirements (you)
- After the live database is set up, sign in once on the website with your email, then give your account the Super Admin role (USER_TODO item "Become Super Admin"). Then open sanjayatrading.store/admin.

---

## Phase 9 report: Stripe payments (test mode)

### Features completed
- After "Place order" the customer goes straight to Stripe's secure payment page (INR). If they close it, the order page shows "Pay now" until the payment window ends.
- Returning from Stripe, the order page confirms the payment as soon as Stripe's notice arrives ("Payment received"), and the order moves to **Awaiting approval** for the Super Admin.
- Server functions (Supabase Edge Functions, no third-party packages):
  - `create-checkout`: checks the signed-in customer owns the order and that it is awaiting payment; the amount comes from the database, never the browser. Works for full payment and installments (Phase 15).
  - `stripe-webhook`: verifies Stripe's signature, stores every event once (replays are ignored), checks the paid amount and currency match the order, records late payments for refund, and records refunds.
  - `admin-refund`: Super Admin only; full or partial refunds with a reason, logged in the audit log.
- Safety: live Stripe keys are refused until the Super Admin turns on live payments in settings. No Stripe secret is in the website or the repository.

### Files
- `supabase/functions/_shared/{http.ts,clients.ts}`, `supabase/functions/{create-checkout,stripe-webhook,admin-refund}/index.ts`, `supabase/config.toml` (webhook runs without a Supabase login).
- `src/features/payments/startPayment.ts`, `src/pages/checkout/{CheckoutPage,OrderPlacedPage}.tsx`.

### Database changes
- None (payment functions from Phase 2).

### Tests run
- Against local Supabase and Stripe's official mock server: order placed → checkout session created → visitor without login refused (401) → signed webhook marks the order paid and "Awaiting approval" → same event replayed is ignored → forged signature rejected (400) → customer refund attempt refused (403) → Super Admin refund recorded and audited.
- Browser: place order → redirected to Stripe → after the webhook the order page shows "Payment received". No console errors.
- Web checks (31 unit tests, build, secret scan) and database tests pass.

### Next requirements (you)
- Stripe test keys and webhook, after Supabase is set up: DEPLOYMENT.md section E.
- Ask Stripe in writing whether the UAE account may take INR payments from Indian customers (USER_TODO, before launch).

---

## Phases 7 + 8 report: delivery and GPS address

### Features completed
- Delivery page (`/delivery`): pincode checker with zone, typical days and arrival dates; delivery-time table per zone (Mumbai/Thane/Navi Mumbai 2–3 days, Maharashtra & metros 3–5, rest of India 5–7, remote areas 10–13); fee rule (first order free, then ₹50, from admin settings); delivery-code and map-pin explainers.
- Delivery rules (built in Phase 2 and used everywhere): pincode serviceability, zone by exact pincode or prefix, remote flag, per-zone fee override, first-order-free that is released again if an unpaid order expires or is cancelled.
- GPS address (optional, with consent): "Use my current location" in the address form asks the browser only when tapped, shows an OpenStreetMap map with a draggable gold pin, and fills street/city/state/pincode from OpenStreetMap's free address lookup when those fields are empty. Coordinates are saved with the address and copied onto the order for the rider. "Remove pin" clears it. If location is declined, the customer simply types the address.

### Files
- `src/pages/DeliveryPage.tsx`, `src/features/delivery/{LocationPicker.tsx,MapPin.tsx,geocode.ts,geocode.test.ts}`, `src/features/account/AddressForm.tsx`, `src/app/router.tsx`. The map code loads only when a customer opens it.

### Database changes
- None.

### Tests run
- Web checks (31 unit tests) and database tests pass.
- Browser test: remote pincode 781001 shows 10–13 days; signed-in customer pins location (simulated GPS 19.0596, 72.8295 in Bandra), saves the address, and the database stores the coordinates with source "gps". The test machine has no internet for map tiles, so the map was grey there and the address lookup was skipped, which is the designed fallback.

### Notes
- OpenStreetMap tiles and address lookup are free for low traffic and need no account. If traffic grows a lot, switch to a paid map provider (listed in USER_TODO).

---

## Phase 6 report: cart and checkout

### Features completed
- Bag page (`/cart`): change quantity, remove, live server prices with MRP, stock warnings, delivery pincode check, coupon codes, delivery fee (free on the first order, then ₹50), estimated delivery dates.
- Checkout (`/checkout`, sign-in required): pick a saved address or add one (saved to the address book), serviceability check per address, coupon, note for the team, place order. The server re-prices everything, checks stock and reserves it, and records the coupon.
- Order placed page (`/order/:id`): order number, status, items, totals, address, payment deadline and next steps.
- Payment: "Pay in full by card". The Stripe payment page itself is connected in Phase 9; until then orders stay "Payment pending" and are released automatically after 60 minutes.

### Files
- `src/pages/CartPage.tsx`, `src/pages/checkout/{CheckoutPage,OrderPlacedPage}.tsx`, `src/features/cart/OrderSummary.tsx`, `src/app/router.tsx`.

### Database changes
- None (uses `quote_cart` and `place_order` from Phase 2).

### Tests run
- Web checks and database tests pass.
- Browser test against local Supabase: add a watch → bag → pincode 400050 → coupon WELCOME10 (−₹1,000) → sign in by email code → new address → place order → order SNJ100001 "Payment pending", first delivery free. Second order by the same customer correctly charges ₹50 delivery. Phone layout checked (no sideways scroll), no console errors.

### Next requirements
- None from you for this phase.

---

## Phase 5 report: customer accounts

### Features completed
- Sign in or register with a one-time 6-digit code by **email** or **Indian mobile** (no passwords). New accounts can enter their name. Safe return to the page the customer came from.
- Invite links: `?ref=CODE` on any page is remembered on the device and attached when the friend creates an account (counts toward "Invite 5 friends" once their first order is delivered).
- My account area (`/account`): overview with personal invite link and copy button, profile (name, contact mobile, marketing opt-in), address book, wishlist. Staff see a link to the staff panel.
- Address book: add, edit, delete, make default; Home/Office/Other; Indian mobile and pincode validation (same rules as the database); city and state filled automatically from the pincode table; live "we deliver here / arriving by" hint. The same form will be reused at checkout.
- Wishlist page shows saved products as cards; removing updates instantly.
- Pages needing login redirect to `/login` and come back afterwards.

### Files created or changed
- `src/pages/auth/LoginPage.tsx`, `src/pages/account/{AccountLayout,AccountOverview,ProfilePage,AddressesPage,WishlistPage}.tsx`
- `src/features/account/{RequireAuth.tsx,referralCapture.ts,addresses.ts,AddressForm.tsx}`, `src/lib/{phone.ts,indianStates.ts}`
- `src/app/router.tsx` (login and account routes), `src/components/layout/SiteLayout.tsx` (invite capture), `src/features/catalog/api.ts`
- `supabase/templates/{magic_link,confirmation}.html` (code emails), `supabase/config.toml` (local OTP settings)

### Database changes
- Migration `20261103001000_account.sql`: `set_default_address()`; address trigger (first address becomes default, a new default replaces the old one, maximum 20 per customer); `search_products` takes a list of product ids (for the wishlist).

### Tests run
- Database: 147 assertions pass, including 11 new account tests (addresses are private, default switching, profile columns customers may edit).
- Web: typecheck, lint, 29 unit tests, production build and secret scan pass.
- Browser, against a full local Supabase: invite link → protected page → login redirect → email code from the test mailbox → account created → address added with pincode autofill → product saved to wishlist → overview. Desktop and phone screenshots checked, no console errors.

### Errors and fixes
- Account pages overflowed sideways on phones (scrolling tab row widened the grid); fixed with `min-w-0`.

### Deployment status
- Merged to `main`; the live site updates automatically. Sign-in works once Supabase is connected (see DEPLOYMENT.md section D, step 3).

### Next requirements
- For mobile login on the live site: MSG91 or Twilio with DLT registration (USER_TODO, paid). Email login works with free SMTP.

---

## Phase 3 + 4 report: branding, homepage and catalogue

### Features completed
- Navy, white and gold design system (Cormorant Garamond + Manrope, self-hosted), new crowned "S" monogram and wordmark.
- Header with search and category menu, mobile menu, app-style bottom tab bar on phones, footer, cart drawer.
- Homepage: rotating hero banners, category tiles, delivery offer strip, flash sale with live countdown, product rails (electronics, laptops, ethnic fashion, watches, bags, footwear), promo pair, "Invite 5 friends" block, installments block. Banners, flash sale and strip text come from the database (admin-editable in Phase 13).
- Category pages with sub-categories, filters (availability, price bands, brands with counts), sorting, pagination; search with prefix matching; deals page.
- Product page: image gallery, size/colour/storage option pickers with out-of-stock hints, price with MRP discount, stock level, quantity, add to bag / buy now, pincode delivery check with estimated dates and first-order-free message, installment preview, specs, verified-purchase reviews (write and read), related products.
- Wishlist hearts (saved per customer).
- 1,150 original demo products (4,714 variants, tagged `demo`) with generated navy/gold illustrations, loadable with `supabase/demo/demo_catalogue.sql`; `remove_demo_products()` clears them before launch.
- Bulk product import function with dry-run preview and per-row errors (admin screen in Phase 13).

### Database changes
`…000800_catalog_search.sql` (search_products, product_reviews, flash_sale setting), `…000900_catalog_admin.sql` (import_products, preview_or_import_products, remove_demo_products).

### Tests performed
137 database assertions; 19 unit tests; build and secret scan; checked in Chromium against a full local Supabase stack (desktop and phone widths), no console errors.

---

## Phase 2 report: database and backend

### Features completed

- Full PostgreSQL schema for every phase (41 tables): identity, staff roles, addresses, catalogue, delivery zones and pincodes, coupons, banners, orders and timeline, payments, refunds, Stripe event log, delivery assignments/attempts/proof, installments, collections, KYC, referrals, rewards, loyalty, notifications, support tickets, audit log.
- Row Level Security on every table; roles Super Admin, Operations, Delivery, Collections, Support (see docs/DATABASE.md for the permission table).
- Server-side business logic as database functions: checkout quote, order placement with stock reservation, first-order-free delivery, ₹50 fee, pincode zones, coupons, order lifecycle with Super Admin approval, delivery with door code, payment recording with amount checks, refunds, unpaid-order expiry, six-installment schedules, eligibility rules, collections, KYC auto-decision with duplicate detection, Invite-5 rewards, loyalty points, verified reviews, notification queue, admin dashboard numbers.
- Scheduled jobs (pg_cron) for order expiry and installment reminders.
- CI workflow that runs web checks and the database tests on every pull request.

### Database changes

Seven migrations in `supabase/migrations/` (listed in docs/DATABASE.md). Not yet applied to a real Supabase project (needs your Supabase account, see USER_TODO.md).

### Tests performed

121 database assertions (`npm run test:db`) on PostgreSQL 16 with a Supabase auth stand-in, acting as visitors, customers, each staff role and the server. They cover pricing, zones, free first delivery, coupons, stock, payments (including wrong amounts and webhook replays), approval rights, rider restrictions, door codes, expiry, refunds, installments, overdue collections, KYC duplicates, referral gifts, loyalty, reviews and data privacy between customers and staff.

### Errors

None outstanding.

### Deployment status

Nothing to deploy on Netlify. Supabase deployment waits for your account.

---

## Phase 1 report

### Reference website findings (sanjayatrading.store, checked 2026-11-03)

- Live and reachable. It is the old **fresh fruits and vegetables** site for Sanjaya Trading FZE (UAE).
- Public details found: legal name Sanjaya Trading FZE; address Office BLV-6F-SF60793, Ajman Boulevard-A Building, Business District, Ajman Free Zone, UAE; phone and WhatsApp +971 56 911 0077; email admin@sanjayatrading.com. No licence number or social links shown.
- Logo: gold crowned "ST" monogram with a green leaf and "SANJAYA TRADING FZE" wordmark. The leaf is produce-themed, so Phase 3 will propose a navy and gold mark for Sanjaya Store; the old files are kept in `public/brand/legacy/` for reference only.
- **The old source code was found** in GitHub at `khanforcedevelopment/sanjaya-store` (a static HTML site with two Netlify Functions for Stripe). No secret keys were committed in it. None of its code or design was reused. Its last version stays in GitHub history as commit `04552d0` on `main`.

### Features completed

- New React 19 + TypeScript + Vite + Tailwind CSS 4 project, replacing the old static site on a new branch.
- Architecture chosen and documented with tradeoffs (ARCHITECTURE.md).
- Folder structure for all 20 phases (feature folders, Supabase folder).
- Public-config guard: the app refuses Stripe secret keys, webhook secrets and Supabase service-role/secret keys in website settings.
- Post-build secret scan of `dist/`, plus check that Netlify routing and header files are present.
- Netlify drag-and-drop support: `_redirects` (deep links) and `_headers` (security headers) ship inside `dist/`.
- INR money helpers using integer paise with Indian digit grouping.
- Placeholder home page and 404 page, mobile-friendly.

### Files created

`package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `netlify.toml`, `.env.example`, `.gitignore`, `public/_redirects`, `public/_headers`, `public/brand/legacy/*`, `src/main.tsx`, `src/app/router.tsx`, `src/components/layout/SiteLayout.tsx`, `src/pages/HomePage.tsx`, `src/pages/NotFoundPage.tsx`, `src/lib/env.ts`, `src/lib/money.ts`, `src/lib/supabase.ts`, `src/config/business.ts`, `src/styles/index.css`, `src/features/README.md`, tests (`*.test.ts[x]`), `scripts/verify-dist.mjs`, `supabase/README.md`, `README.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`, `PROJECT_STATUS.md`, `docs/REQUIREMENTS.md`.

### Database changes

None. The schema is designed in ARCHITECTURE.md section 4 and built in Phase 2.

### Tests performed

- `npm run check`: type check, lint, 12 unit tests (env guard, INR formatting, routing), production build, `dist/` secret scan. All pass.
- Negative test: planting a fake `sk_live_` key in `dist/` makes the scan fail as intended.
- Browser smoke test (Chromium) of the built site at phone (390px) and desktop widths, plus a direct deep link to an unknown route showing the 404 page. No console errors.

### Errors

None outstanding.

### Deployment status

Not deployed. The `dist/` folder can be drag-and-dropped to Netlify now to see the placeholder, but there is no backend yet. sanjayatrading.store is untouched and still serves the old site.

### Next phase requirements (Phase 2: database and backend)

1. Your approval of this architecture (Supabase + Netlify static + Stripe Checkout).
2. A Supabase account. Free tier is fine for development. Either invite a developer to your Supabase organisation, or create the project (region Mumbai) and share the project URL and anon key. Never share the service-role key or database password in chat.
3. Answers to the open questions below where you can. Defaults will be used and documented otherwise.

### Open questions for the owner

1. Are the UAE address, phone, WhatsApp and email above still correct for the India store? Is there an Indian address, GSTIN and grievance officer to display (required for Indian e-commerce)?
2. "First eligible order free delivery": per customer account, per phone number, or per delivery address? Does a cancelled or refunded first order still count as used? (Proposed: per verified customer, and a cancelled or refunded order does not use up the free delivery.)
3. Does free delivery have a minimum order value?
4. Which categories should allow installments at launch? (Mobile phones stay off by default as requested.)
5. Do you want the new site to keep the old "ST crown" monogram, or should Phase 3 propose a new logo for Sanjaya Store?
6. Cash on delivery: wanted or not? (Not in the brief, so not planned.)
