# Sanjaya Store: Project Status

Last updated: 2026-11-03 · Current phase: **1 of 20, complete, awaiting approval**

| Phase | Name | Status |
|---|---|---|
| 1 | New project initialization | ✅ Done, awaiting approval |
| 2 | Database and backend architecture | ⏸ Waiting for Phase 1 approval |
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

## Phase 1 report

### Reference website findings (sanjayatrading.store, checked 2026-11-03)

- Live and reachable. It is the old **fresh fruits and vegetables** site for Sanjaya Trading FZE (UAE).
- Public details found: legal name Sanjaya Trading FZE; address Office BLV-6F-SF60793, Ajman Boulevard-A Building, Business District, Ajman Free Zone, UAE; phone and WhatsApp +971 56 911 0077; email admin@sanjayatrading.com. No licence number or social links shown.
- Logo: gold crowned "ST" monogram with a green leaf and "SANJAYA TRADING FZE" wordmark. The leaf is produce-themed, so Phase 3 will propose a navy and gold mark for Sanjaya Store; the old files are kept in `public/brand/legacy/` for reference only.
- **The old source code was found** in GitHub at `khanforcedevelopment/sanjaya-store` (a static HTML site with two Netlify Functions for Stripe). No secret keys were committed in it. None of its code or design was reused. Its last version is preserved as the git tag `legacy-produce-site`.

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
