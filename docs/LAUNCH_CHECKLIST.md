# Launch checklist

The website already runs on **sanjayatrading.store** and deploys automatically from `main`. It runs in **test mode**: no real money moves and the products are demo items. Work down this list before taking real orders. Each line says who does it.

## A. Live system set-up (Claude, already done or in progress)

- [x] Live database created (Mumbai) with every migration, the delivery zones and pincodes, and the demo catalogue.
- [x] Server functions deployed: create-checkout, stripe-webhook, admin-refund, kyc-submit, dispatch-notifications, sitemap.
- [x] Website connected to the live database (public URL and public key only).
- [ ] Two-step sign-in switched on in Supabase Auth: Confirm email, minimum password 8, access token hook (DEPLOYMENT.md D3).
- [ ] `/sitemap.xml` returns the product list.

## B. Accounts and keys (you)

- [ ] **Resend** connected as the Supabase SMTP sender, with the domain verified. Without it, only a few sign-in emails go out per hour. (USER_TODO §4)
- [ ] Resend API key and sender saved as Supabase secrets, plus the 5-minute cron job, for order emails. (DEPLOYMENT.md E3)
- [ ] `KYC_HASH_SALT` saved as a Supabase secret (a long random value; never change it later). (DEPLOYMENT.md E2)
- [ ] Stripe **test** keys and webhook saved as Supabase secrets, then one test card order. (DEPLOYMENT.md E)
- [ ] Sign in once, set your password with "Forgot password", and become Super Admin. (USER_TODO §1)
- [ ] SMS provider (MSG91 or Twilio with DLT), only needed for verifying mobile numbers for installments.
- [ ] Supabase Pro plan, so the database never pauses and has daily backups.

## C. Business and legal (you, with professionals)

- [ ] Stripe confirms in writing that the UAE account may take INR payments from Indian customers.
- [ ] Indian CA: GST registration and entity or import set-up.
- [ ] Lawyer: Terms, Privacy, Returns, Shipping and Installments pages, and whether six installments need an NBFC or BNPL partner.
- [ ] Grievance officer, Indian address and GSTIN entered in Admin → Settings → Store details.
- [ ] Contact details on the site checked.

## D. Content (you)

- [ ] Real products imported with Admin → Products → Import CSV, using photos you are allowed to use.
- [ ] Demo products removed (Admin → Products → Remove demo products).
- [ ] Homepage banners and staff accounts with their roles.

## E. Go-live switches (only with your written OK)

- [ ] Stripe live keys saved, then Admin → Settings → **Live payments** (you type LIVE to confirm).
- [ ] Installments live only after the lawyer's answer: Admin → Settings → **Live installments**.
- [ ] One real low-value order end to end: pay, approve, pack, dispatch, deliver with the door code, refund.
- [ ] Submit `https://sanjayatrading.store/sitemap.xml` in Google Search Console.

## F. Final test pass (Claude, 2026-11-03)

All passed on a full local copy of the system:

| Area | What was checked |
|---|---|
| Sign-in | Create account with email code; wrong password refused; password + code; "Forgot password" then new password; old password refused. A password alone or a code alone gives no session (enforced on the server). |
| Shopping | Browse, search, product variants, cart, pincode check, free first delivery then ₹50, checkout to Stripe (test). |
| Orders | Payment confirmed, Super Admin approval, packing, dispatch, rider queue, delivery with door code and photo, tracking timeline, cancel and return requests. |
| Installments | Eligibility reasons, agreement, six-payment schedule, pay next, collections tasks, waiver with audit log. |
| Identity check | Document upload into the private folder, duplicate detection, Super Admin review, automatic eligibility. |
| Account | Orders, addresses, profile, mobile verification, rewards, support tickets and staff replies. |
| Referrals | Invite code, reward after the friend's delivered order, admin reject with audit. |
| App and SEO | Service worker, offline page, manifest and icons, policy pages on a phone, product structured data, sitemap. |
| Automated | 33 unit tests, 184 database assertions, production build with secret scan. |
