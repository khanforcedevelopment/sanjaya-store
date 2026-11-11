# Security audit, 2026-11-11

Scope: this repository (React SPA on Netlify, Supabase Postgres/Auth/Storage/Edge Functions, Stripe) and a
**read-only** check of the live Supabase project (RLS, grants, buckets, auth settings, function settings,
secret names). Nothing in production was changed by this audit. References: OWASP Top 10 (2021), OWASP API
Top 10 (2023), ASVS 4.0 L2.

Evidence: `npm run check` (typecheck, lint, 57 unit tests, build, dist secret scan), `scripts/db-test.sh`
(all migrations on a fresh Postgres + 201 SQL assertions, 15 new), `deno check` on every Edge Function, a
headless-browser run of the production build with the new Content-Security-Policy against live data
(home, categories, category, deals, login, cart, contact, product page: 0 CSP violations).

## Summary by area

| Security item | Initial status | Action taken | Verification |
|---|---|---|---|
| Authentication | Password + email code built, but the enforcing Auth hook is **off** in the live project; min password length 6 | Per-IP throttle and timing-safe unknown-email path added (migration). Hook + length need dashboard change | DB tests 07/08. **Requires owner approval** |
| Authorization | RLS on all 43+ tables, roles checked in every SECURITY DEFINER function, column grants block mass assignment | Signed-in-only functions no longer executable by `anon`; `setting()` respects `is_public` | DB tests 08 |
| Database security | Parameterized (PostgREST/RPC, `format('%I')`), no dynamic SQL from input | None needed | Code review |
| API security | Edge Functions verify user JWT, ownership/amount decided in DB, CORS allow-list included `localhost` | CORS default = production origins only; `no-store` on JSON; service-key check is now exact | `deno check` |
| SSRF (image copy) | `rehost-images` fetched any http(s) URL and followed redirects; staff-only | https only, no IPs/internal names/odd ports/credentials, DNS check, each redirect re-checked (max 3), streamed 10 MB cap, optional host allow-list | 16 unit tests + live download test |
| File storage | KYC bucket limited; product/banner/proof buckets had **no** type or size limit | 10 MB + image MIME allow-list on all buckets (no SVG/HTML) | DB test 08 |
| Payment security | Amount/currency checked against DB on webhook, Stripe signature + 5 min replay window + event de-dup, refunds super-admin only and audited | None needed | Code review |
| Privacy compliance | Policies pages exist (marked "being reviewed"); no trackers; no account-deletion flow | Listed for owner | **Requires owner action** |
| Infrastructure | No CSP/HSTS; source maps off; dist secret scan in build; 10 moderate dev-only advisories | CSP, HSTS, COOP, tighter Permissions-Policy; `minimatch` override (0 advisories) | Browser run, `npm audit` |

## Findings

### High

**H1. Two-step sign-in not enforced on the server (live config).** `custom_access_token_hook` exists
(migration 1600) but `hook_custom_access_token_enabled = false` in the live project, so the Supabase Auth API
accepts a plain password grant or an email code alone. Fix: Supabase → Authentication → Hooks → enable
"Customize Access Token (JWT) Claims" → `public.custom_access_token_hook`. Status: **Requires owner approval**
(changes how everyone signs in; tested in `supabase/tests/07_login.sql`).

**H2. SSRF in the image copy function.** `supabase/functions/rehost-images` downloaded any `http(s)` URL from
product rows (filled by CSV import) with automatic redirects; a crafted row could make the server request
internal or metadata addresses. Only `operations` staff can trigger it, which lowers the likelihood.
Fix: `supabase/functions/_shared/url-guard.ts` + manual redirect loop. Status: **Fixed and verified in code**;
live after the function is redeployed.

### Medium

**M1. Storage buckets without type/size limits.** `product-images`, `banner-images` (public) and
`delivery-proofs` accepted any file of any size from authorised staff/riders; an SVG or HTML file in a public
bucket is served from the Supabase domain. Fix: migration `20261111000200` sets 10 MB + image MIME lists.
Status: **Fixed and verified (tests)**; needs the migration applied.

**M2. No Content-Security-Policy / HSTS.** XSS impact (including theft of the session kept in browser storage)
was not limited by policy. React escapes output and there is no `dangerouslySetInnerHTML`/`eval`. Fix:
`public/_headers`. Status: **Fixed and verified** (0 violations); live after the Netlify deploy.

**M3. Password spraying.** Wrong passwords were limited per email (5 / 15 min) only. Fix: also 30 / 15 min per
IP (Cloudflare `cf-connecting-ip`), 10 reset requests / hour per IP, constant work for unknown emails.
Status: **Fixed and verified (tests)**. Confirm after applying that the header is present (otherwise only the
per-email limit applies).

**M4. Weak password policy (live config).** Minimum length 6, no leaked-password check. Fix: Authentication →
Providers → Email → minimum length 8 (DEPLOYMENT.md D3). Leaked-password protection needs a paid plan.
Status: **Requires manual configuration**.

**M5. No CAPTCHA on sign-up / sign-in.** Free Cloudflare Turnstile is supported by Supabase Auth. Needs a
Turnstile site key + secret from the owner, then a small form change. Status: **Requires owner approval**.

### Low

- **L1. CORS default allowed `http://localhost:5173` in production.** Fixed (`_shared/http.ts`).
- **L2. `dispatch-notifications` trusted a JWT's `role` claim after decoding it without checking the signature**
  (the API gateway did check it, `verify_jwt = true`). Now requires an exact project server key. Fixed.
- **L3. `setting()` returned non-public settings (kyc, notifications) to anonymous callers.** Now SECURITY
  INVOKER so table RLS applies. Fixed (test).
- **L4. Signed-in-only RPCs executable by `anon`.** Each already refused anonymous callers inside; EXECUTE is now
  revoked from `anon` as defence in depth. Fixed (tests).
- **L5. Support messages had no flood limit.** 30 / hour per customer. Fixed (test).
- **L6. Session token in `localStorage`** (supabase-js default). Moving to httpOnly cookies needs a server
  (Netlify Functions/SSR) in front of Supabase: an architecture change. Mitigated by M2 (CSP) and 1-hour JWTs
  with refresh-token rotation (on). Status: **Requires owner approval** (not recommended now).
- **L7. Staff accounts have no app-based MFA.** TOTP is enabled in Supabase Auth but there is no enrolment UI
  and admin pages do not require `aal2`. With H1 enabled every sign-in is password + emailed code. Status:
  **Requires owner approval** (proposed follow-up: TOTP for staff, enforced in `has_any_role`).

### Informational

- **I1. `payments.live_enabled` and `installments.live_enabled` are `true` in live `site_settings`.** No Stripe
  key is set yet, so nothing can be charged. When a live key is added, live payments (and installments, still
  under legal review) would start at once. Owner to confirm; not changed.
- **I2. `kyc.auto_approve = true`** in live settings. Business decision; confirm it is intended.
- **I3. `dispatch-notifications` is not scheduled** (no cron job) and no email provider is set; order emails stay
  queued. Auth emails use Supabase's built-in sender (2 per hour). Set up Resend SMTP (USER_TODO).
- **I4. No default credentials or test accounts** in the live project (one account: the owner, super_admin).
  `config.toml` test OTP numbers apply to local development only (`sms_test_otp` is empty live).
- **I5. Secrets:** only public values in the repo (`netlify.toml` anon key is public by design); build fails if a
  secret key pattern reaches `dist/`. Supabase secrets hold service keys and `KYC_HASH_SALT`. JWT signing keys
  are managed by Supabase. Passwords are hashed by Supabase Auth with bcrypt (Argon2id is not configurable
  there; bcrypt is accepted by OWASP).
- **I6. CSRF:** not applicable; the API uses `Authorization: Bearer` headers, not cookies.
- **I7. Source maps:** `build.sourcemap = false`; no `.map` in `dist/`.
- **I8. Error handling/logs:** functions return generic messages and log only error objects (no tokens,
  card data or ID numbers; ID numbers are HMAC-hashed). Stripe event payloads are stored in `stripe_events`
  (no card numbers; Stripe Checkout keeps the app out of PCI scope, SAQ A).
- **I9. Reviews:** 0 reviews live; "verified purchase" is computed by the database, customers cannot set it or
  un-hide a moderated review.
- **I10. Privacy:** no analytics or ad trackers, so no cookie banner is legally needed today (only
  strictly-necessary storage). Missing: a self-service "delete my account / my data" request (UAE PDPL),
  and lawyer review of the policy pages (already in USER_TODO).
- **I11. Backups:** catalogue backups are kept in project files before bulk changes; Supabase free plan has no
  point-in-time recovery. Consider the Pro plan's daily backups before taking real orders.

## Deploy and rollback plan (needs owner approval)

1. Apply `supabase/migrations/20261111000200_security_hardening.sql` to the live database (additive; rollback
   steps are at the top of the file).
2. Redeploy Edge Functions `rehost-images`, `dispatch-notifications` and the others (shared `http.ts` changed).
   Rollback: redeploy the previous commit.
3. Netlify: Trigger deploy of `main` (new headers). Rollback: "Publish deploy" on the previous deploy.
4. Dashboard: enable the access-token hook (H1) and minimum password length 8 (M4). Rollback: switch off.
5. After each step: sign in (password + code), open admin, run "Copy all remaining photos" on a few products.
