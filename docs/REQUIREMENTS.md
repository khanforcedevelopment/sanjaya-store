# Sanjaya Store: Requirements

Captured from the owner's master brief on 2026-11-03. This is the checklist every phase is measured against.

## Business

- Store: **Sanjaya Store**. Legal company: **Sanjaya Trading FZE** (managed from the UAE).
- Single seller: every product belongs to the business. No marketplace or vendors.
- Market: India. Currency: INR. Main dispatch office: Mumbai.
- Categories: mobile phones; laptops and tablets; electronics and accessories; Indian ethnic fashion (sarees, kurtis, dresses); men's clothing; women's clothing; footwear; watches; handbags; fashion accessories; home and lifestyle.
- No grocery or fresh food. Do not copy the old produce website's design.
- Premium, Amazon-inspired shopping experience with an original luxury identity: navy, white and gold.

## Delivery

- Own delivery team, dispatch from Mumbai.
- First eligible order: free delivery. Second and later orders: ₹50 per order.
- Standard estimate 2 to 7 days; remote up to 12 to 13 days where supported.
- Serviceability by pincode. Admin configures zones, fees and estimates.
- Fee and estimate shown before payment.

## Orders

- Flow: placed, payment verified, Super Admin approves, packed, assigned, staff update delivery, customer sees timeline.
- Statuses: Order Placed, Payment Pending, Payment Confirmed, Awaiting Approval, Order Confirmed, Processing, Packed, Dispatched, In Transit, Out for Delivery, Delivered.
- Also: delays, cancellations, failed delivery attempts, returns, refunds.
- Tracking comes only from real database records.

## Customer location

- Ask for location permission at checkout; never collect without permission.
- If granted: GPS coordinates, adjustable map pin, reverse geocoding to prefill.
- Customer must confirm house number, street, landmark, city, state, pincode.
- Manual entry when permission is denied.

## Admin and staff (one application)

- Super Admin controls products, inventory, customers, orders, approvals, payments, installments, delivery zones, fees, assignments, staff accounts, tracking updates, promotions, referrals, homepage banners, reports, website settings.
- Staff use the same app with restricted roles: Super Admin, Operations, Delivery, Collections, Customer Support.
- Delivery staff see assigned orders and update statuses. Collections staff manage assigned installment follow-ups.
- Every admin action must actually work.

## Payments (existing Stripe UAE account)

- Full payments, first-installment payments, Stripe Checkout, server-side verification, webhooks, refunds, reconciliation, monthly installment payment links.
- Test mode first. Live only after confirming Stripe approval for UAE merchant selling to India.

## Installments

- Six installments on eligible categories: first paid immediately, five monthly.
- Calculator, customer agreement, schedule, reminders, outstanding balance, payment history, collection tracking, admin eligibility rules.
- Not automatically enabled on mobile phones.
- No live financing before legal and compliance review.

## KYC and eligibility

- Authorised identity verification provider: government ID, selfie liveness, mobile OTP, duplicate checks, fraud prevention, configurable rules, automatic decisions for qualifying applicants.
- An ID image alone does not establish identity or creditworthiness.

## Referrals and rewards

- Main campaign: "Invite 5 friends and get a free gift".
- Unique links, qualified referral tracking, progress indicator, gift redemption, loyalty points, coupons. Super Admin controls campaigns.

## PWA

- Installable on Android where supported; Add to Home Screen guidance on iPhone.
- Icons, standalone mode, mobile navigation, offline fallback, safe caching, product deep links, notifications where supported.
- Never described as a published native app.

## Hosting and deployment

- Netlify, with manual drag-and-drop of a `dist/` folder supported.
- No continuously running custom Node server.
- Secure external backend for database, auth, payments, webhooks, admin, orders, tracking, installments.
- Frontend never contains Stripe secret keys, service-role keys or verification credentials.
- Clear explanation of what is and isn't deployed by drag and drop. Non-technical step-by-step instructions.
- Ready to connect to the existing domain later, only with final approval.

## Working rules

One phase at a time, approval after each, complete working code, no fake features, test before marking complete, modular, premium and mobile-friendly, PROJECT_STATUS.md kept current, database changes and deployment documented, paid services explained first, no exposed credentials, no dependency on the deleted project.

Each phase report covers: features completed, files created, database changes, tests performed, errors, deployment status, next phase requirements.
