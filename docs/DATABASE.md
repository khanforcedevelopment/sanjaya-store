# Database reference

PostgreSQL on Supabase. Source of truth: `supabase/migrations/`. Tests: `supabase/tests/` (run `npm run test:db` against a local PostgreSQL 16; see "Testing" below).

All money is stored in **paise** (integer). All times are UTC `timestamptz`; dates shown to customers use India time (`ist_today()`).

## Migrations

| File | What it does |
|---|---|
| `…000100_schema.sql` | All tables, enums, constraints, indexes |
| `…000200_core_functions.sql` | Role helpers, settings, sign-up trigger, referral codes, staff management, pincode lookup, first-order-free rule, coupons, installment eligibility, checkout quote |
| `…000300_order_functions.sql` | Place order, status changes, approval, delays, Stripe payment recording, refunds, unpaid-order expiry, delivery assignment, attempts, proof of delivery, customer cancellation |
| `…000400_growth_functions.sql` | Installment servicing and reminders, collections, KYC decisions, referral rewards, loyalty points, reviews, notification queue, stock adjustment, admin dashboard |
| `…000500_security.sql` | Row Level Security on every table, function permissions, storage buckets |
| `…000600_config_data.sql` | Default settings, order lifecycle rules, delivery zones and pincode prefixes, categories, "Invite 5 friends" campaign |
| `…000700_scheduled_jobs.sql` | pg_cron jobs: expire unpaid orders (10 min), installment statuses and reminders (daily 09:00 IST) |

## Roles and what they can do

Roles live in `staff_roles`. A person can hold several. The Super Admin passes every role check except server-only steps.

| Action | Customer | Super Admin | Operations | Delivery | Collections | Support |
|---|---|---|---|---|---|---|
| Browse catalogue, quote cart | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Place / cancel own order (until processing starts) | ✓ | | | | | |
| See all orders | | ✓ | ✓ | assigned only | ✓ | ✓ |
| **Approve order** | | ✓ | | | | |
| Processing, packed, cancel | | ✓ | ✓ | | | |
| Assign delivery | | ✓ | ✓ | | | |
| Dispatched / in transit / out for delivery / failed attempt | | ✓ | ✓ | assigned only | | |
| Mark delivered (needs customer's 4-digit code) | | ✓ (override) | | assigned only | | |
| Report delay | | ✓ | ✓ | assigned only | | ✓ |
| Products, stock, categories, banners, coupons, zones | | ✓ | ✓ | | | |
| Installment plans (read) | own | ✓ | ✓ | | ✓ | ✓ |
| Collection tasks | | ✓ | | | ✓ | |
| Waive an installment | | ✓ | | | | |
| KYC data and decisions | own | ✓ | | | | |
| Staff accounts, settings, referral campaigns | | ✓ | | | | |
| Moderate reviews, support tickets | | ✓ | | | | ✓ |

## Order lifecycle

Allowed moves are data in `order_status_transitions` (editable without code changes). `system` moves happen only through the server:

```
order_placed → payment_pending ─(Stripe webhook)→ payment_confirmed → awaiting_approval
awaiting_approval ─(Super Admin)→ order_confirmed → processing → packed → dispatched
dispatched → in_transit → out_for_delivery → delivered (rider enters customer's code)
out_for_delivery → delivery_failed → out_for_delivery (retry) | cancelled (return to origin)
delivered → return_requested (within 7 days) → returned → refunded (Stripe refund webhook)
payment_pending → cancelled (customer, or automatically after 60 min unpaid)
```

"Delayed" is recorded as a timeline event with a reason (`report_delay`), without losing the current status. Every change writes a row to `order_status_events`; the customer timeline reads only rows marked customer-visible.

## Business rules enforced in the database

- **Prices** come only from `product_variants`; the browser's numbers are never used.
- **Stock** is reserved when the order is placed (no overselling, even with simultaneous orders) and released when an order is cancelled, expires unpaid, or is refunded before dispatch.
- **First order free delivery**: free if the customer has no other order that is paid, in progress or still within its payment window. Cancelled, refunded and expired orders do not use it up. Orders from one customer are serialised so two simultaneous orders cannot both be free.
- **Delivery fee**: zone override, else the default ₹50 (`site_settings.delivery.default_fee_paise`).
- **Pincode**: exact `pincodes` row first, else the longest matching `pincode_prefixes` row.
- **Coupons**: validity window, minimum subtotal, max discount, total and per-customer limits, first-order-only, personal coupons. Released if the order is cancelled.
- **Payments**: amount and currency are checked against the expected amount; mismatches are rejected and logged; webhook replays are ignored.
- **Installments**: only when every item's category/product allows it (mobile phones off by default), the customer passes the eligibility rules (verified phone, approved KYC, one active plan, no overdue installment, order between ₹5,000 and ₹2,00,000 by default) and accepted the agreement version. Six installments; any rounding paise go on the first.
- **KYC**: automatic approval only if liveness passed, face match ≥ threshold and no risk flags; the same ID on another account is rejected; anything else goes to manual review. Only a salted hash of the ID number is stored.
- **Referrals**: qualify when the friend's first order is delivered; every 5 qualified friends issues the campaign reward once.
- **Loyalty**: 1 point per ₹100 on delivered orders, reversed on full refund; 500 points minimum to redeem, 1 point = 10 paise.

## Server-only functions

Callable only with the service role (Edge Functions) or from the SQL editor/cron, never from the browser: `create_payment_record`, `record_checkout_paid`, `record_checkout_expired`, `record_refund`, `expire_unpaid_orders`, `refresh_installment_statuses`, `queue_installment_reminders`, `apply_kyc_result`, `grant_initial_super_admin`, and all functions starting with `_`.

## First Super Admin

After the owner signs up on the website, run once in Supabase → SQL editor:

```sql
select public.grant_initial_super_admin('owner@example.com');
```

## Testing

`scripts/db-test.sh` creates a fresh database, loads `supabase/tests/supabase_shim.sql` (a stand-in for Supabase's `auth` schema and roles), applies every migration, then runs the numbered test files. Tests act as real users by setting the same JWT claims Supabase sets, so Row Level Security is exercised exactly as in production. CI runs this on every pull request.

```
PGHOST=/path/to/socket PGPORT=5432 npm run test:db
```
