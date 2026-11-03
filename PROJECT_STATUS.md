# Sanjaya Store: Project Status

Last updated: 2026-11-03 · Building all phases continuously (owner approved on 2026-11-03: no stop between phases, merge when tests pass)

| Phase | Name | Status |
|---|---|---|
| 1 | New project initialization | ✅ Done, merged |
| 2 | Database and backend architecture | ✅ Done |
| 3 | VIP branding and homepage | Not started |
| 4 | Product catalogue | Not started |
| 5 | Customer authentication | Not started |
| 6 | Cart and checkout | Not started |
| 7 | Delivery charges and serviceability | Not started |
| 8 | Customer GPS address | Not started |
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

## Phase 2 report: database and backend

### Features completed

- Full PostgreSQL schema for every phase (37 tables): identity, staff roles, addresses, catalogue, delivery zones and pincodes, coupons, banners, orders and timeline, payments, refunds, Stripe event log, delivery assignments/attempts/proof, installments, collections, KYC, referrals, rewards, loyalty, notifications, support tickets, audit log.
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
