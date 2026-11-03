# Your to-do list (things only you can do)

Claude keeps building without waiting. These are the steps that need your accounts, money, signatures or decisions. Do them whenever you have time; nothing is blocked from being **built**, but the store cannot **go live** until the "Before launch" items are done.

Last updated: 2026-11-03

## 1. Accounts to create (free to start)

- [ ] **Supabase** (database and server) — **needed for products to appear on the live site.** Sign up at supabase.com, create a project named `sanjaya-store`, region **South Asia (Mumbai)**, save the database password in a password manager. Then create an access token (Account → Access Tokens) and add it in Claude's Project settings → Cloud environment → Add cloud environment as `SUPABASE_ACCESS_TOKEN`, plus `SUPABASE_PROJECT_REF` (the first part of your project URL). Never paste tokens or passwords in chat. Claude then creates the tables, loads the products and connects the website.
- [ ] **Review identity checks**: when customers apply for installments, open Admin → Identity checks, compare the name and selfie with the document, then Approve or Reject with a reason.
- [ ] **Become Super Admin** (after the live database is set up). Sign in once on sanjayatrading.store with your email, then in Supabase → SQL editor run `select public.grant_initial_super_admin('your@email.com');` (or ask Claude to do it). Open sanjayatrading.store/admin; from the **Staff** page you can give roles to your team (they must sign in once first).
- [ ] **Stripe test mode**. In your Stripe UAE dashboard switch on "Test mode". After Supabase is set up, follow DEPLOYMENT.md section E (about 10 minutes): add the webhook and save the two test keys as Supabase secrets. Payments then work with Stripe test cards; no real money moves.
- [x] ~~Decide where the new store lives on Netlify.~~ Decided: use the **existing** Netlify site and domain. Work stays on a separate branch; you preview it on the PR's Netlify preview link. At launch, with your OK, it is merged and goes live on sanjayatrading.store.

## 2. Decisions (defaults are being used until you say otherwise)

| Question | Default Claude is building with |
|---|---|
| Who counts as "first eligible order"? | Per customer account. A cancelled or refunded first order does not use up free delivery. |
| Minimum order value for free delivery? | None. |
| Categories allowed for installments at launch | Laptops & tablets, electronics, watches, handbags. **Mobile phones off.** Admin can change. |
| Logo | Keep the gold "ST" crown monogram, redrawn without the leaf, on navy. |
| Cash on delivery | Not offered. |
| Delivery zones | Mumbai/Thane/Navi Mumbai 2 to 3 days; Maharashtra and metros 3 to 5 days; rest of India 5 to 7 days; North-East, J&K, Ladakh, Andaman, Lakshadweep 10 to 13 days (remote). All ₹50 after the first order. |
| Free gift for "Invite 5 friends" | A coupon worth ₹500, admin-editable. |
| A referral "qualifies" when | The friend's first order is **Delivered** (not just placed). |

## 3. Before launch (required)

- [ ] Ask Stripe support in writing: "Can my UAE Stripe account accept INR payments from Indian customers for goods dispatched from our Mumbai office?" Keep the reply.
- [ ] Indian CA: GST registration and the right entity/import set-up for selling in India from Sanjaya Trading FZE.
- [ ] Lawyer: whether the six-installment plan counts as lending under RBI rules (it may need a licensed NBFC or BNPL partner). Installments stay in **test mode only** until this is answered.
- [ ] Indian address, GSTIN and a **Grievance Officer** name/email to show on the site (required by India's e-commerce rules).
- [ ] Confirm the contact details shown on the site (currently the UAE phone/WhatsApp/email from the old site).
- [ ] Review the draft Terms, Privacy, Returns and Installment Agreement pages Claude writes, with a lawyer.

## 4. Paid services (sign up only when that feature is needed)

- [ ] **SMS OTP** for phone login **and for verifying mobile numbers (required for installments)**: MSG91 or Twilio (pay per SMS, roughly ₹0.20–0.50 each in India; India requires DLT registration of your sender ID and templates, which takes a few days).
- [ ] **KYC provider (optional, later)**: identity checks already work for free by document upload and your review in Admin → Identity checks. An automatic provider (IDfy, HyperVerge or Digio; roughly ₹5–30 per check) adds instant decisions, selfie liveness and Aadhaar e-KYC. Only needed when volume grows.
- [ ] **Email sending**: Resend or Postmark (free tier to start). Needed for login codes on the live site; Supabase's own mailer allows only a few emails per hour.
- [ ] **WhatsApp Business** notifications: Meta Cloud API or a provider like Interakt/AiSensy.
- [ ] **Supabase Pro** (about US$25/month) at launch so the database never pauses and has daily backups.
- Maps use free OpenStreetMap tiles by default; no account needed unless traffic grows.

## 5. Real content

- [ ] Product list with photos, prices (₹), stock and variants. Ask your suppliers/distributors for their product sheet and **photos you are allowed to use** (copying from Amazon or brand sites is not allowed). Upload it with Admin → Products → Import CSV.
- [ ] Before launch: Admin → Products → **Remove demo products** (the 1000+ sample products are for testing only).
- [ ] Banner photos for the homepage. Optional: an AI image service key (OpenAI or Google, paid per image) if you want AI-made banner photos; product photos should be real photos of your stock (phone camera on white background is fine).
- [ ] Staff list with roles: Operations, Delivery, Collections, Support.
