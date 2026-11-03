# Sanjaya Store: Project Status

Last updated: 2026-11-03 · Building all phases continuously (owner approved on 2026-11-03: no stop between phases, merge when tests pass)

| Phase | Name | Status |
|---|---|---|
| 1 | New project initialization | ✅ Done, merged |
| 2 | Database and backend architecture | ✅ Done, merged |
| 3 | VIP branding and homepage | ✅ Done, merged |
| 4 | Product catalogue | ✅ Done, merged |
| 5 | Customer authentication | ✅ Done, merged |
| 6 | Cart and checkout | ✅ Done, merged (card payment connects in Phase 9) |
| 7 | Delivery charges and serviceability | ✅ Done |
| 8 | Customer GPS address | ✅ Done |
| 9 | Stripe integration | Not started |
| 10 | Order approval system | Not started |
| 11 | In-house delivery management | Not started |
| 12 | Customer delivery tracking | Not started |
| 13 | Super Admin dashboard | Not started |
| 14 | Staff role management | Not started |
| 15 | Six-installment system | Not started |
| 16 | KYC and automatic eligibility | Not started |
| 17 | Customer dashboard | Not started |
| 18 | Referrals and promotions | Not started |
| 19 | PWA, notifications and SEO | Not started |
| 20 | Testing and Netlify launch | Not started |

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
