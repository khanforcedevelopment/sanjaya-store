# Your to-do list (things only you can do)

Claude keeps building without waiting. These are the steps that need your accounts, money, signatures or decisions. Do them whenever you have time; nothing is blocked from being **built**, but the store cannot **go live** until the "Before launch" items are done.

Last updated: 2026-11-03

## 1. Accounts to create (free to start)

- [ ] **Supabase** (database and server). Sign up at supabase.com, create a project named `sanjaya-store`, region **South Asia (Mumbai)**. Save the database password in a password manager. Then invite the developer to the organisation (Organization → Team → Invite), or share only the **Project URL** and **anon public key**. Never share the service_role key or the database password in chat.
- [ ] **Stripe test mode**. In your existing Stripe UAE dashboard, switch on "Test mode". Nothing else yet.
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

- [ ] **SMS OTP** for phone login: MSG91 or Twilio (pay per SMS; India requires DLT registration of your sender ID and templates, which takes a few days).
- [ ] **KYC provider** (ID + selfie liveness): e.g. IDfy, HyperVerge or Digio. Contract and per-check pricing.
- [ ] **Email sending**: Resend or Postmark (free tier to start).
- [ ] **WhatsApp Business** notifications: Meta Cloud API or a provider like Interakt/AiSensy.
- [ ] **Supabase Pro** (about US$25/month) at launch so the database never pauses and has daily backups.
- Maps use free OpenStreetMap tiles by default; no account needed unless traffic grows.

## 5. Real content

- [ ] Product list with photos, prices (₹), stock and variants (a spreadsheet is fine; Claude will build an import).
- [ ] Banner photos for the homepage (or approve stock images).
- [ ] Staff list with roles: Operations, Delivery, Collections, Support.
