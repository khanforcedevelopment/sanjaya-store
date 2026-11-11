-- Installments, KYC decisions, collections, referrals, loyalty and reviews.
\set ON_ERROR_STOP 1
\set laptop '[{"variant_id":"00000000-0000-0000-0000-00000000d002","quantity":1}]'
\set phone '[{"variant_id":"00000000-0000-0000-0000-00000000d001","quantity":1}]'
\set address '{"recipient_name":"Bob Test","phone":"+971501234562","house":"B-4","street":"Linking Road","city":"Al Nahda","state":"Sharjah","pincode":"SHJ"}'

-- The test laptop costs 60,000; allow plans up to 200,000 here (the live default is AED 1,000 - 10,000).
reset role;
update site_settings set value = value || '{"min_order_total_paise": 500000, "max_order_total_paise": 20000000}'::jsonb where key = 'installments';
set role authenticated; select tests.as_user(tests.id('bob'));
-- product rules
select tests.eq((quote_cart(:'phone', 'SHJ')->'installment'->>'products_eligible')::boolean, false, 'mobile phones are not on installments');
select tests.eq((quote_cart(:'laptop', 'SHJ')->'installment'->>'products_eligible')::boolean, true, 'laptops are on installments');
select tests.eq((select sum(x::bigint) from jsonb_array_elements_text(quote_cart(:'laptop', 'SHJ')->'installment'->'schedule_paise') x), 6000000::numeric,
  'six installments add up exactly to the total');
-- customer rules
select tests.eq((my_installment_eligibility()->'reasons'->>0), 'Verify your mobile number with OTP', 'unverified phone blocks installments');
select tests.throws(format($$select place_order(%L, %L, null, 'installment', null, 'v1')$$, :'laptop', :'address'), 'Installments not available', 'ineligible customer cannot choose installments');
select tests.throws(format($$select place_order(%L, %L, null, 'installment', null, 'v1')$$, :'phone', :'address'), 'not available on installments', 'phone cannot be bought on installments');

reset role;
update auth.users set phone = '+971501234562', phone_confirmed_at = now() where id = tests.id('bob');
select tests.eq((select phone from profiles where id = tests.id('bob')), '+971501234562', 'verified phone copied to profile');

-- ---------------------------------------------------------------- KYC
set role service_role; select tests.as_service();
insert into kyc_applications (id, user_id, provider, provider_reference) values
  ('00000000-0000-0000-0000-0000000000e1', tests.id('bob'), 'sandbox', 'ref-bob'),
  ('00000000-0000-0000-0000-0000000000e2', tests.id('alice'), 'sandbox', 'ref-alice');
select tests.eq(apply_kyc_result('00000000-0000-0000-0000-0000000000e1', 'emirates_id', 'hash-123', 'Bob Test', false, 95, '{}')->>'status', 'manual_review', 'failed liveness goes to manual review');
select tests.eq(apply_kyc_result('00000000-0000-0000-0000-0000000000e1', 'emirates_id', 'hash-123', 'Bob Test', true, 92, '{}')->>'status', 'approved', 'good result is approved automatically');
select tests.eq(apply_kyc_result('00000000-0000-0000-0000-0000000000e2', 'emirates_id', 'hash-123', 'Alice Test', true, 99, '{}')->>'status', 'rejected', 'same ID on another account is rejected');

set role authenticated; select tests.as_user(tests.id('alice'));
select tests.eq((select count(*) from kyc_applications)::int, 1, 'customers see only their own KYC');
select tests.throws($$select decide_kyc('00000000-0000-0000-0000-0000000000e2', 'approved', 'looks fine')$$, 'Only the Super Admin', 'customer cannot approve KYC');
set role authenticated; select tests.as_user(tests.id('support'));
select tests.eq((select count(*) from kyc_applications)::int, 0, 'support staff cannot see KYC data');

-- ---------------------------------------------------------------- installment order
set role authenticated; select tests.as_user(tests.id('bob'));
select tests.eq((my_installment_eligibility()->>'eligible')::boolean, true, 'bob is now eligible');
select tests.throws(format($$select place_order(%L, %L, null, 'installment', null, null)$$, :'laptop', :'address'), 'accept the installment agreement', 'agreement acceptance required');
create temp table t_inst as select place_order(:'laptop', :'address', null, 'installment', null, '2026-11-draft-1') as r;
grant select on t_inst to authenticated, service_role;
select tests.eq((select (r->>'amount_due_now_paise')::bigint from t_inst), 1000000::bigint, 'first installment due now (AED 10,000 of AED 60,000)');
select tests.eq((select count(*) from installments)::int, 6, 'schedule of six installments created');
select tests.eq((select due_date from installments where seq = 2), (ist_today() + interval '1 month')::date, 'second installment due in a month');
select tests.eq((my_installment_eligibility()->>'eligible')::boolean, false, 'only one active plan at a time');
select tests.eq((payment_intent_for_order((select (r->>'order_id')::uuid from t_inst))->>'purpose'), 'first_installment', 'checkout charges the first installment');

set role service_role; select tests.as_service();
select create_payment_record((select (r->>'order_id')::uuid from t_inst), (select id from installments where seq = 1), 'first_installment', 1000000, 'cs_inst_1', false);
select record_checkout_paid('cs_inst_1', 'pi_inst_1', 1000000, 'aed', false);
select tests.eq((select status from installment_plans), 'active', 'plan active after first installment');
select tests.eq((select status::text from orders where id = (select (r->>'order_id')::uuid from t_inst)), 'awaiting_approval', 'installment order awaits approval');

set role authenticated; select tests.as_user(tests.id('bob'));
select tests.throws(format($$select payment_intent_for_order(%L, %L)$$, (select r->>'order_id' from t_inst), (select id from installments where seq = 3)), 'earlier installments first', 'installments are paid in order');
select tests.eq((payment_intent_for_order((select (r->>'order_id')::uuid from t_inst), (select id from installments where seq = 2))->>'amount_paise')::bigint, 1000000::bigint, 'second installment payable');

-- make installment 2 overdue and run the daily jobs
reset role;
update installments set due_date = ist_today() - 10 where seq = 2;
set role service_role; select tests.as_service();
select refresh_installment_statuses();
select refresh_installment_statuses();
select tests.eq((select status::text from installments where seq = 2), 'overdue', 'late installment marked overdue');
select tests.eq((select count(*) from collection_tasks)::int, 1, 'collection task created once');
select tests.eq(queue_installment_reminders() >= 1, true, 'reminder queued');
select tests.eq(queue_installment_reminders(), 0, 'reminders are not repeated within 3 days');

set role authenticated; select tests.as_user(tests.id('support'));
select tests.eq((select count(*) from collection_tasks)::int, 0, 'support cannot see collection tasks');
set role authenticated; select tests.as_user(tests.id('collector'));
select update_collection_task((select id from collection_tasks), 'promised', 'Customer will pay Friday', ist_today() + 3);
select tests.eq((select assigned_to from collection_tasks), tests.id('collector'), 'collector picked up the task');

set role service_role; select tests.as_service();
select create_payment_record((select (r->>'order_id')::uuid from t_inst), (select id from installments where seq = 2), 'installment', 1000000, 'cs_inst_2', false);
select record_checkout_paid('cs_inst_2', 'pi_inst_2', 1000000, 'aed', false);
select tests.eq((select status from collection_tasks), 'resolved', 'payment resolves the collection task');
select tests.eq((select amount_paid_paise from orders where id = (select (r->>'order_id')::uuid from t_inst)), 2000000::bigint, 'two installments paid');

-- ---------------------------------------------------------------- referrals
-- Bob was referred by Alice. His first delivered order qualifies the referral.
set role authenticated; select tests.as_user(tests.id('admin'));
select approve_order((select (r->>'order_id')::uuid from t_inst));
select transition_order((select (r->>'order_id')::uuid from t_inst), 'processing');
select transition_order((select (r->>'order_id')::uuid from t_inst), 'packed');
select transition_order((select (r->>'order_id')::uuid from t_inst), 'dispatched');
select transition_order((select (r->>'order_id')::uuid from t_inst), 'out_for_delivery');
select complete_delivery((select (r->>'order_id')::uuid from t_inst), 'Bob Test');
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.eq((my_referral_summary()->>'qualified')::int, 1, 'referral qualified when friend''s order is delivered');
select tests.eq(jsonb_array_length(my_referral_summary()->'rewards'), 0, 'no gift before 5 friends');

-- four more friends sign up with Alice's code and get an order delivered
reset role;
do $$
declare i int; v_uid uuid; v_order uuid; v_code text := (select referral_code from profiles where id = tests.id('alice'));
begin
  for i in 1..4 loop
    insert into auth.users (email, raw_user_meta_data) values ('friend' || i || '@test.local', jsonb_build_object('referral_code', lower(v_code)))
    returning id into v_uid;
    insert into orders (user_id, status, shipping_address, pincode, subtotal_paise, total_paise)
    values (v_uid, 'out_for_delivery', '{}', 'AJM', 100000, 100000) returning id into v_order;
    update orders set status = 'delivered' where id = v_order;
  end loop;
end $$;
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.eq((my_referral_summary()->>'qualified')::int, 5, 'five qualified friends');
select tests.eq(jsonb_array_length(my_referral_summary()->'rewards'), 1, 'free gift issued at 5 friends');
select tests.eq((select discount_value from coupons where assigned_user_id = auth.uid()), 2500::bigint, 'gift voucher worth AED 25');
select tests.eq((quote_cart('[{"variant_id":"00000000-0000-0000-0000-00000000d003","quantity":1}]', 'DXB',
   (select code from coupons where assigned_user_id = auth.uid()))->>'discount_paise')::bigint, 2500::bigint, 'alice can use her gift voucher');
reset role;
create temp table t_gift as select code from coupons where assigned_user_id = tests.id('alice');
grant select on t_gift to authenticated;
set role authenticated; select tests.as_user(tests.id('bob'));
select tests.eq((quote_cart('[{"variant_id":"00000000-0000-0000-0000-00000000d003","quantity":1}]', 'SHJ',
   (select code from t_gift))->'coupon'->>'error'), 'This coupon is not valid', 'nobody else can use alice''s voucher');
select tests.throws($$select apply_referral_code('XXXX')$$, 'already applied', 'referral code cannot be changed');

-- ---------------------------------------------------------------- loyalty
select tests.eq(loyalty_balance(), 600, 'bob earned 600 points on a 60,000 delivered order');
select tests.throws($$select redeem_points(100)$$, 'at least 500', 'minimum redemption enforced');
select tests.eq((redeem_points(500)->>'value_paise')::bigint, 5000::bigint, '500 points -> AED 50 voucher (10 fils a point)');
select tests.eq(loyalty_balance(), 100, 'points deducted after redemption');

-- ---------------------------------------------------------------- reviews
insert into reviews (product_id, user_id, rating, title) values ('00000000-0000-0000-0000-00000000b002', auth.uid(), 5, 'Great laptop');
select tests.eq((select is_verified_purchase from reviews where user_id = auth.uid()), true, 'review of a delivered product is a verified purchase');
insert into reviews (product_id, user_id, rating) values ('00000000-0000-0000-0000-00000000b003', auth.uid(), 2);
update reviews set is_verified_purchase = true where product_id = '00000000-0000-0000-0000-00000000b003';
select tests.eq((select is_verified_purchase from reviews where product_id = '00000000-0000-0000-0000-00000000b003'), false, 'customer cannot fake the verified badge');
select tests.throws($$insert into reviews (product_id, user_id, rating) values ('00000000-0000-0000-0000-00000000b002', '00000000-0000-0000-0000-0000000000c1', 1)$$, 'row-level security', 'cannot review as someone else');
select tests.eq((select rating_count from products where slug = 'test-laptop'), 1, 'product rating count updated');
select tests.eq((select rating_avg from products where slug = 'test-laptop'), 5.00, 'product rating average updated');
reset role;
