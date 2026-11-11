-- Checkout, delivery fees, payments, approval, delivery, refunds and permissions.
\set ON_ERROR_STOP 1
\set alice_items '[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":2}]'
\set address '{"recipient_name":"Alice Test","phone":"+971501234561","house":"Flat 12","street":"Marine Drive","landmark":"Near Oval","city":"Dubai Marina","state":"Dubai","pincode":"DXB"}'

-- ---------------------------------------------------------------- visitors
set role anon; select tests.as_anon();
select tests.eq((select count(*) from products)::int, 3, 'visitor sees only active products');
select tests.eq((select count(*) from coupons)::int, 0, 'visitor cannot list coupon codes');
select tests.eq((select count(*) from site_settings where key = 'kyc')::int, 0, 'private settings are hidden');
select tests.throws($$insert into orders (user_id, shipping_address, pincode, subtotal_paise, total_paise) values ('00000000-0000-0000-0000-0000000000c1', '{}', 'DXB', 1, 1)$$,
  'permission denied', 'visitor cannot insert orders directly');
select tests.throws($$select record_checkout_paid('x', 'y', 1, 'aed', false)$$, 'permission denied', 'visitor cannot call payment functions');

-- emirate delivery areas
select tests.eq(check_pincode('DXB')->>'zone_name', 'Dubai, Sharjah & Ajman', 'Dubai -> north zone');
select tests.eq(check_pincode('ajm')->>'zone_name', 'Dubai, Sharjah & Ajman', 'emirate code is case-insensitive');
select tests.eq(check_pincode('AUH')->>'zone_name', 'Abu Dhabi, Umm Al Quwain, Ras Al Khaimah & Fujairah', 'Abu Dhabi -> wide zone');
select tests.eq((check_pincode('FUJ')->>'max_days')::int, 3, 'Fujairah up to 3 days');
select tests.eq(check_pincode('SHJ')->>'state', 'Sharjah', 'emirate name returned');
select tests.eq((check_pincode('400020')->>'known')::boolean, false, 'Indian pincode no longer accepted');
select tests.eq((check_pincode('XYZ')->>'serviceable')::boolean, false, 'unknown emirate code not serviceable');

-- quote as visitor: first order assumed free
select tests.eq((quote_cart(:'alice_items', 'DXB')->>'total_paise')::bigint, 4000000::bigint, 'visitor quote: 2 x 20,000 with free first delivery');
select tests.eq((quote_cart('[{"variant_id":"00000000-0000-0000-0000-00000000d004","quantity":1}]', 'DXB')->'errors'->>0),
  'An item in your cart is no longer available', 'hidden product cannot be bought');
select tests.throws($$select quote_cart('[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":50}]', 'DXB')$$, 'between 1 and 20', 'quantity limit enforced');

-- ---------------------------------------------------------------- alice orders
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.eq((quote_cart(:'alice_items', 'DXB')->'delivery'->>'first_order_free')::boolean, true, 'alice: first order is free');
select tests.eq((quote_cart(:'alice_items', 'DXB', 'SAVE10')->>'discount_paise')::bigint, 50000::bigint, 'percent coupon capped at max discount');
select tests.eq((quote_cart(:'alice_items', 'DXB', 'NOPE')->'coupon'->>'error'), 'This coupon code is not valid', 'unknown coupon reports an error');
select tests.throws($$select place_order('[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":1}]', '{"recipient_name":"A","phone":"123","house":"1","street":"x","city":"Deira","state":"Dubai","pincode":"DXB"}')$$,
  'valid mobile', 'bad phone number rejected');
select tests.throws($$select place_order('[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":1}]', '{"recipient_name":"Alice","phone":"+971501234561","house":"1","street":"Main road","city":"Nowhere","state":"Nowhere","pincode":"XYZ"}')$$,
  'do not deliver', 'unserviceable pincode blocks checkout');

create temp table t_order1 as select place_order(:'alice_items', :'address', 'SAVE10') as r;
grant select on t_order1 to authenticated, service_role, anon;
select tests.eq((select (r->>'total_paise')::bigint from t_order1), 3950000::bigint, 'order total = 40,000 - 500 coupon + 0 delivery');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'payment_pending', 'new order waits for payment');
select tests.eq((select free_delivery_applied from orders where id = (select (r->>'order_id')::uuid from t_order1)), true, 'free delivery recorded on order');
select tests.eq((select count(*) from order_status_events where order_id = (select (r->>'order_id')::uuid from t_order1))::int, 2, 'timeline has placed + payment pending');
reset role;
select tests.eq((select stock from product_variants where sku = 'PH-128'), 8, 'stock reserved at order time');
set role authenticated; select tests.as_user(tests.id('alice'));

-- second order while the first is still unpaid: no second free delivery
select tests.eq((quote_cart(:'alice_items', 'DXB')->>'delivery_fee_paise')::bigint, 1500::bigint, 'second order pays AED 15 while first is pending');
select tests.throws($$select place_order('[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":1}]', '{"recipient_name":"Alice","phone":"+971501234561","house":"1","street":"Main road","city":"Deira","state":"Dubai","pincode":"DXB"}', 'SAVE10')$$,
  'already used', 'coupon per-customer limit enforced');

-- customers cannot change status or see other people's orders
select tests.throws(format($$select transition_order(%L, 'order_confirmed')$$, (select r->>'order_id' from t_order1)), 'cannot change', 'customer cannot approve own order');
select tests.throws($$update profiles set is_blocked = true where id = auth.uid()$$, 'permission denied|not allowed', 'customer cannot unblock/block themselves');
update product_variants set stock = 999;
reset role;
select tests.eq((select stock from product_variants where sku = 'PH-128'), 8, 'customer update of stock has no effect (RLS)');
set role authenticated; select tests.as_user(tests.id('alice'));

set role authenticated; select tests.as_user(tests.id('bob'));
select tests.eq((select count(*) from orders)::int, 0, 'bob cannot see alice''s orders');
select tests.eq((select count(*) from order_delivery_codes)::int, 0, 'bob cannot see delivery codes');

-- ---------------------------------------------------------------- payment
set role service_role; select tests.as_service();
select create_payment_record((select (r->>'order_id')::uuid from t_order1), null, 'full', 3950000, 'cs_test_1', false);
select tests.eq(record_checkout_paid('cs_test_1', 'pi_test_1', 100, 'aed', false)->>'result', 'amount_mismatch', 'wrong amount is not accepted');
select tests.eq((select status::text from payments where stripe_checkout_session_id = 'cs_test_1'), 'failed', 'mismatched payment marked failed');
-- a fresh session for the real payment
select create_payment_record((select (r->>'order_id')::uuid from t_order1), null, 'full', 3950000, 'cs_test_2', false);
select tests.eq(record_checkout_paid('cs_test_2', 'pi_test_2', 3950000, 'inr', false)->>'result', 'amount_mismatch', 'a payment in INR is not accepted');
select create_payment_record((select (r->>'order_id')::uuid from t_order1), null, 'full', 3950000, 'cs_test_3', false);
select tests.eq(record_checkout_paid('cs_test_3', 'pi_test_3', 3950000, 'aed', false)->>'result', 'recorded', 'payment recorded');
select tests.eq(record_checkout_paid('cs_test_3', 'pi_test_3', 3950000, 'aed', false)->>'result', 'already_recorded', 'webhook replay is idempotent');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'awaiting_approval', 'paid order waits for Super Admin approval');
select tests.eq((select amount_paid_paise from orders where id = (select (r->>'order_id')::uuid from t_order1)), 3950000::bigint, 'amount paid recorded once');

-- ---------------------------------------------------------------- approval and dispatch
set role authenticated; select tests.as_user(tests.id('ops'));
select tests.throws(format($$select approve_order(%L)$$, (select r->>'order_id' from t_order1)), 'cannot change', 'operations cannot approve (Super Admin only)');
select tests.eq((select count(*) from orders)::int, 1, 'operations can see orders');
set role authenticated; select tests.as_user(tests.id('admin'));
select approve_order((select (r->>'order_id')::uuid from t_order1));
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'order_confirmed', 'Super Admin approved the order');
set role authenticated; select tests.as_user(tests.id('ops'));
select transition_order((select (r->>'order_id')::uuid from t_order1), 'processing');
select transition_order((select (r->>'order_id')::uuid from t_order1), 'packed');
select tests.throws(format($$select transition_order(%L, 'delivered')$$, (select r->>'order_id' from t_order1)), 'cannot change|complete_delivery', 'cannot skip straight to delivered');

-- rider not yet assigned
set role authenticated; select tests.as_user(tests.id('rider'));
select tests.eq((select count(*) from orders)::int, 0, 'rider cannot see unassigned orders');
select tests.throws(format($$select transition_order(%L, 'dispatched')$$, (select r->>'order_id' from t_order1)), 'cannot change', 'unassigned rider cannot dispatch');

set role authenticated; select tests.as_user(tests.id('ops'));
select tests.throws(format($$select assign_delivery(%L, %L)$$, (select r->>'order_id' from t_order1), tests.id('support')), 'not delivery staff', 'only delivery staff can be assigned');
select assign_delivery((select (r->>'order_id')::uuid from t_order1), tests.id('rider'), current_date);

set role authenticated; select tests.as_user(tests.id('rider'));
select tests.eq((select count(*) from my_delivery_queue())::int, 1, 'rider sees the assigned order');
select transition_order((select (r->>'order_id')::uuid from t_order1), 'dispatched');
select transition_order((select (r->>'order_id')::uuid from t_order1), 'out_for_delivery');
select tests.eq((select count(*) from order_delivery_codes)::int, 0, 'rider cannot read the door code');
select record_delivery_attempt((select (r->>'order_id')::uuid from t_order1), 'customer_unavailable', 'Door locked');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'delivery_failed', 'failed attempt recorded');
select transition_order((select (r->>'order_id')::uuid from t_order1), 'out_for_delivery', 'Second attempt today');
select tests.throws(format($$select complete_delivery(%L, 'Alice', '0000x')$$, (select r->>'order_id' from t_order1)), 'does not match', 'wrong door code rejected');

set role authenticated; select tests.as_user(tests.id('rider2'));
select tests.throws(format($$select complete_delivery(%L, 'Alice', '1234')$$, (select r->>'order_id' from t_order1)), 'not allowed', 'another rider cannot complete it');

-- alice reads her code and tells the rider
set role authenticated; select tests.as_user(tests.id('alice'));
create temp table t_code as select code from order_delivery_codes where order_id = (select (r->>'order_id')::uuid from t_order1);
grant select on t_code to authenticated;
select tests.eq((select count(*) from t_code)::int, 1, 'customer can see the door code');
set role authenticated; select tests.as_user(tests.id('rider'));
select complete_delivery((select (r->>'order_id')::uuid from t_order1), 'Alice Test', (select code from t_code));

set role authenticated; select tests.as_user(tests.id('alice'));
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'delivered', 'order delivered');
select tests.eq((select count(*) from order_status_events where order_id = (select (r->>'order_id')::uuid from t_order1))::int >= 10, true, 'customer timeline has every step');
select tests.eq((select count(*) from order_status_events where order_id = (select (r->>'order_id')::uuid from t_order1) and note = 'Assigned to delivery partner')::int, 0, 'internal events hidden from customer');
select tests.eq(loyalty_balance(), 395, 'loyalty points earned: 1 per AED 100');
select tests.eq((select count(*) from proof_of_delivery)::int, 1, 'customer can see proof of delivery');

-- ---------------------------------------------------------------- after the first order
select tests.eq((quote_cart(:'alice_items', 'DXB')->>'delivery_fee_paise')::bigint, 1500::bigint, 'later orders pay AED 15 delivery');

-- unpaid order expires, releases stock and coupon
create temp table t_order2 as select place_order('[{"variant_id":"00000000-0000-0000-0000-00000000d003","quantity":2}]', :'address', 'FLAT200') as r;
grant select on t_order2 to authenticated, service_role;
reset role;
select tests.eq((select stock from product_variants where sku = 'SR-RED'), 3, 'saree stock reserved');
update orders set payment_expires_at = now() - interval '1 hour' where id = (select (r->>'order_id')::uuid from t_order2);
set role service_role; select tests.as_service();
select tests.eq(expire_unpaid_orders(), 1, 'one unpaid order expired');
reset role;
select tests.eq((select stock from product_variants where sku = 'SR-RED'), 5, 'expired order released stock');
select tests.eq((select is_released from coupon_redemptions where order_id = (select (r->>'order_id')::uuid from t_order2)), true, 'expired order released coupon');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order2)), 'cancelled', 'expired order is cancelled');

-- ---------------------------------------------------------------- returns and refunds
set role authenticated; select tests.as_user(tests.id('alice'));
select transition_order((select (r->>'order_id')::uuid from t_order1), 'return_requested', 'Wrong colour');
set role authenticated; select tests.as_user(tests.id('ops'));
select transition_order((select (r->>'order_id')::uuid from t_order1), 'returned');
set role service_role; select tests.as_service();
select record_refund('pi_test_3', 're_test_1', 1000000, 'pending');
select record_refund('pi_test_3', 're_test_1', 1000000, 'succeeded');
select tests.eq((select status::text from payments where stripe_payment_intent_id = 'pi_test_3'), 'partially_refunded', 'partial refund recorded');
select record_refund('pi_test_3', 're_test_2', 2950000, 'succeeded');
select record_refund('pi_test_3', 're_test_2', 2950000, 'succeeded');
select tests.eq((select amount_refunded_paise from orders where id = (select (r->>'order_id')::uuid from t_order1)), 3950000::bigint, 'refunds counted once each');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_order1)), 'refunded', 'fully refunded order is marked refunded');
select tests.eq((select sum(points)::int from loyalty_ledger where user_id = tests.id('alice')), 0, 'loyalty points reversed after full refund');

-- ---------------------------------------------------------------- staff management
set role authenticated; select tests.as_user(tests.id('ops'));
select tests.throws($$select set_staff_role('00000000-0000-0000-0000-0000000000c2', 'operations', true)$$, 'Only the Super Admin', 'operations cannot create staff');
set role authenticated; select tests.as_user(tests.id('admin'));
select tests.throws($$select set_staff_role('00000000-0000-0000-0000-0000000000a1', 'super_admin', false)$$, 'last Super Admin', 'last Super Admin cannot be removed');
select tests.eq((admin_dashboard()->>'awaiting_approval')::int, 0, 'dashboard loads for Super Admin');
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.throws($$select admin_dashboard()$$, 'not allowed', 'customers cannot load the dashboard');
select tests.eq(is_service_role(), false, 'signed-in user is not the service role');
reset role;
