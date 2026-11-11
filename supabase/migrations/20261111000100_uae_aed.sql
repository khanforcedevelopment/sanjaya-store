-- Sanjaya Store moves to the UAE market (2026-11-11): AED prices, emirate-based delivery, Dubai time.
--
-- Money: every *_paise column now holds fils (1 AED = 100 fils). The column names are kept so the
-- app, functions and tests do not need a risky rename; only the currency changed.
-- Delivery: the UAE has no postal codes. The "pincode" fields now hold a 3-letter emirate code
-- (AUH, DXB, SHJ, AJM, UAQ, RAK, FUJ), and public.pincodes has one row per emirate.

-- ---------------------------------------------------------------------------
-- Delivery areas: emirates instead of Indian pincodes
-- ---------------------------------------------------------------------------
delete from public.pincode_prefixes;
delete from public.pincodes;

alter table public.addresses drop constraint if exists addresses_pincode_check;
alter table public.addresses add constraint addresses_pincode_check
  check (pincode in ('AUH', 'DXB', 'SHJ', 'AJM', 'UAQ', 'RAK', 'FUJ'));
alter table public.pincodes drop constraint if exists pincodes_pincode_check;
alter table public.pincodes add constraint pincodes_pincode_check check (pincode ~ '^[A-Z]{3}$');
alter table public.pincode_prefixes drop constraint if exists pincode_prefixes_prefix_check;
alter table public.pincode_prefixes add constraint pincode_prefixes_prefix_check check (prefix ~ '^[A-Z]{1,3}$');


insert into public.delivery_zones (code, name, min_days, max_days, is_remote, sort_order) values
  ('UAE-NORTH', 'Dubai, Sharjah & Ajman', 1, 2, false, 1),
  ('UAE-WIDE', 'Abu Dhabi, Umm Al Quwain, Ras Al Khaimah & Fujairah', 2, 3, false, 2)
on conflict (code) do nothing;

-- Indian zones: delete when unused, otherwise switch off.
delete from public.delivery_zones z
where z.code in ('MMR', 'METRO', 'REST', 'REMOTE')
  and not exists (select 1 from public.orders o where o.zone_id = z.id);
update public.delivery_zones set is_active = false where code in ('MMR', 'METRO', 'REST', 'REMOTE');

insert into public.pincodes (pincode, zone_id, city, state)
select x.code, z.id, x.city, x.emirate from (values
  ('DXB', 'UAE-NORTH', 'Dubai', 'Dubai'),
  ('SHJ', 'UAE-NORTH', 'Sharjah', 'Sharjah'),
  ('AJM', 'UAE-NORTH', 'Ajman', 'Ajman'),
  ('AUH', 'UAE-WIDE', 'Abu Dhabi', 'Abu Dhabi'),
  ('UAQ', 'UAE-WIDE', 'Umm Al Quwain', 'Umm Al Quwain'),
  ('RAK', 'UAE-WIDE', 'Ras Al Khaimah', 'Ras Al Khaimah'),
  ('FUJ', 'UAE-WIDE', 'Fujairah', 'Fujairah')
) as x(code, zone_code, city, emirate) join public.delivery_zones z on z.code = x.zone_code
on conflict (pincode) do update set zone_id = excluded.zone_id, city = excluded.city, state = excluded.state;

-- ---------------------------------------------------------------------------
-- Settings in AED
-- ---------------------------------------------------------------------------
update public.site_settings set value = value
  || jsonb_build_object('dispatch_address', 'Ajman, United Arab Emirates', 'country', 'AE', 'currency', 'AED', 'vat_rate_percent', 5)
  || jsonb_build_object('trn', coalesce(value->'trn', 'null'::jsonb))
  where key = 'store';
update public.site_settings set value = value - 'gstin' where key = 'store';
-- Delivery AED 15 after the free first order.
update public.site_settings set value = value || jsonb_build_object('default_fee_paise', 1500, 'origin_pincode', 'AJM')
  where key = 'delivery';
-- Installments between AED 1,000 and AED 10,000.
update public.site_settings set value = value || jsonb_build_object('min_order_total_paise', 100000, 'max_order_total_paise', 1000000)
  where key = 'installments';
-- Only the currency changes; live_enabled stays as the owner set it.
update public.site_settings set value = value || jsonb_build_object('currency', 'aed') where key = 'payments';

alter table public.payments alter column currency set default 'aed';

-- Default promotions converted to AED.
update public.coupons set min_subtotal_paise = 10000 where code = 'WELCOME10' and min_subtotal_paise = 200000;
update public.referral_campaigns set reward_value = 2500, reward_description = 'Free gift voucher worth AED 25'
  where reward_description = 'Free gift voucher worth ₹500';

-- ---------------------------------------------------------------------------
-- Functions: Dubai time, emirate codes, AED wording, CSV import in AED
-- (CSV columns price_aed / mrp_aed; the old price_rupees / mrp_rupees names still work.)
-- ---------------------------------------------------------------------------
create or replace function public.ist_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Dubai')::date $$;

create or replace function public.resolve_pincode(p_pincode text)
returns table (zone_id uuid, zone_code text, zone_name text, min_days int, max_days int,
               is_remote boolean, fee_override_paise bigint, serviceable boolean, city text, state text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_pincode is null or upper(p_pincode) !~ '^[A-Z]{3}$' then
    return;
  end if;

  return query
    select z.id, z.code, z.name, z.min_days, z.max_days, z.is_remote, z.fee_override_paise,
           (p.is_serviceable and z.is_active), p.city, p.state
    from pincodes p join delivery_zones z on z.id = p.zone_id
    where p.pincode = upper(p_pincode);
  if found then return; end if;

  return query
    select z.id, z.code, z.name, z.min_days, z.max_days, z.is_remote, z.fee_override_paise,
           (x.is_serviceable and z.is_active), null::text, x.state
    from pincode_prefixes x join delivery_zones z on z.id = x.zone_id
    where upper(p_pincode) like x.prefix || '%'
    order by length(x.prefix) desc
    limit 1;
end $$;

create or replace function public.evaluate_coupon(p_code text, p_user_id uuid, p_subtotal bigint, p_is_first_order boolean)
returns table (coupon_id uuid, discount_paise bigint, error text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare c coupons; v_used int; v_user_used int; v_discount bigint;
begin
  select * into c from coupons where code = upper(trim(p_code));
  if not found or not c.is_active then return query select null::uuid, 0::bigint, 'This coupon code is not valid'; return; end if;
  if c.starts_at is not null and now() < c.starts_at then return query select null::uuid, 0::bigint, 'This coupon is not active yet'; return; end if;
  if c.ends_at is not null and now() > c.ends_at then return query select null::uuid, 0::bigint, 'This coupon has expired'; return; end if;
  if c.assigned_user_id is not null and c.assigned_user_id is distinct from p_user_id then
    return query select null::uuid, 0::bigint, 'This coupon is not valid'; return;
  end if;
  if p_subtotal < c.min_subtotal_paise then
    return query select null::uuid, 0::bigint, format('Add items worth AED %s more to use this coupon', ((c.min_subtotal_paise - p_subtotal) / 100.0)::numeric(12,2)); return;
  end if;
  if c.first_order_only and not p_is_first_order then return query select null::uuid, 0::bigint, 'This coupon is for first orders only'; return; end if;

  select count(*) into v_used from coupon_redemptions where coupon_id = c.id and not is_released;
  if c.usage_limit is not null and v_used >= c.usage_limit then return query select null::uuid, 0::bigint, 'This coupon has been fully used'; return; end if;
  if p_user_id is not null then
    select count(*) into v_user_used from coupon_redemptions where coupon_id = c.id and user_id = p_user_id and not is_released;
    if v_user_used >= c.per_user_limit then return query select null::uuid, 0::bigint, 'You have already used this coupon'; return; end if;
  end if;

  if c.discount_type = 'percent' then
    v_discount := (p_subtotal * c.discount_value) / 100;
  else
    v_discount := c.discount_value;
  end if;
  if c.max_discount_paise is not null then v_discount := least(v_discount, c.max_discount_paise); end if;
  v_discount := least(v_discount, p_subtotal);
  return query select c.id, v_discount, null::text;
end $$;

create or replace function public.evaluate_installment_eligibility(p_user_id uuid, p_order_total bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb := coalesce(setting('installments'), '{}'::jsonb);
  v_reasons text[] := '{}';
  v_profile profiles;
  v_kyc kyc_status;
  v_active int;
  v_delivered int;
  v_overdue int;
begin
  if p_user_id is null then
    return jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('Please sign in'));
  end if;
  select * into v_profile from profiles where id = p_user_id;
  if not coalesce((r->>'enabled')::boolean, false) then v_reasons := array_append(v_reasons, 'Installments are not available right now'::text); end if;
  if v_profile.is_blocked then v_reasons := array_append(v_reasons, 'Account is restricted'::text); end if;

  if coalesce((r->>'require_phone_verified')::boolean, true)
     and not exists (select 1 from auth.users u where u.id = p_user_id and u.phone_confirmed_at is not null) then
    v_reasons := array_append(v_reasons, 'Verify your mobile number with OTP'::text);
  end if;

  if coalesce((r->>'require_kyc')::boolean, true) then
    select status into v_kyc from kyc_applications where user_id = p_user_id order by created_at desc limit 1;
    if v_kyc is distinct from 'approved' then v_reasons := array_append(v_reasons, 'Complete identity verification (KYC)'::text); end if;
  end if;

  if v_profile.created_at > now() - make_interval(days => coalesce((r->>'min_account_age_days')::int, 0)) then
    v_reasons := v_reasons || format('Account must be at least %s days old', (r->>'min_account_age_days'));
  end if;

  select count(*) into v_active from installment_plans where user_id = p_user_id and status in ('pending_first_payment', 'active');
  if v_active >= coalesce((r->>'max_active_plans')::int, 1) then
    v_reasons := array_append(v_reasons, 'You already have the maximum number of active installment plans'::text);
  end if;

  select count(*) into v_overdue from installments i join installment_plans p on p.id = i.plan_id
  where p.user_id = p_user_id and i.status = 'overdue';
  if v_overdue > 0 then v_reasons := array_append(v_reasons, 'You have an overdue installment'::text); end if;

  select count(*) into v_delivered from orders where user_id = p_user_id and status = 'delivered';
  if v_delivered < coalesce((r->>'min_delivered_orders')::int, 0) then
    v_reasons := v_reasons || format('At least %s delivered order(s) needed', r->>'min_delivered_orders');
  end if;

  if p_order_total is not null then
    if p_order_total < coalesce((r->>'min_order_total_paise')::bigint, 0) then
      v_reasons := v_reasons || format('Order must be at least AED %s', (coalesce((r->>'min_order_total_paise')::bigint, 0) / 100));
    end if;
    if r ? 'max_order_total_paise' and p_order_total > (r->>'max_order_total_paise')::bigint then
      v_reasons := v_reasons || format('Order must be at most AED %s', ((r->>'max_order_total_paise')::bigint / 100));
    end if;
  end if;

  return jsonb_build_object('eligible', cardinality(v_reasons) = 0, 'reasons', to_jsonb(v_reasons));
end $$;

create or replace function public.place_order(
  p_items jsonb,
  p_address jsonb,
  p_coupon_code text default null,
  p_payment_mode public.payment_mode default 'full',
  p_customer_note text default null,
  p_agreement_version text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles;
  q jsonb;
  v_order_id uuid;
  v_order_number text;
  v_line jsonb;
  v_updated int;
  v_pincode text := upper(coalesce(p_address->>'pincode', ''));
  v_addr jsonb;
  v_window int := coalesce((setting('delivery')->>'payment_window_minutes')::int, 60);
  v_plan_id uuid;
  v_split bigint[];
  v_elig jsonb;
  v_amount_due bigint;
  i int;
begin
  if v_uid is null then raise exception 'Please sign in to place an order' using errcode = '42501'; end if;
  -- serialise orders per customer so "first order free" cannot be claimed twice at the same moment
  select * into v_profile from profiles where id = v_uid for update;
  if v_profile.is_blocked then raise exception 'Your account cannot place orders. Please contact support.'; end if;

  -- address must be confirmed in full
  if coalesce(trim(p_address->>'recipient_name'), '') = '' or coalesce(trim(p_address->>'house'), '') = ''
     or coalesce(trim(p_address->>'street'), '') = '' or coalesce(trim(p_address->>'city'), '') = ''
     or coalesce(trim(p_address->>'state'), '') = '' then
    raise exception 'Please complete building or villa, street, area and emirate';
  end if;
  if coalesce(p_address->>'phone', '') !~ '^\+?[0-9]{10,15}$' then raise exception 'Please enter a valid mobile number'; end if;
  if v_pincode !~ '^[A-Z]{3}$' then raise exception 'Please choose your emirate'; end if;

  v_addr := jsonb_build_object(
    'recipient_name', left(trim(p_address->>'recipient_name'), 120), 'phone', p_address->>'phone',
    'house', left(trim(p_address->>'house'), 120), 'street', left(trim(p_address->>'street'), 200),
    'landmark', left(nullif(trim(coalesce(p_address->>'landmark', '')), ''), 200),
    'city', left(trim(p_address->>'city'), 80), 'state', left(trim(p_address->>'state'), 80),
    'pincode', v_pincode,
    'location_source', case when p_address->>'location_source' = 'gps' then 'gps' else 'manual' end);

  q := compute_quote(v_uid, p_items, v_pincode, p_coupon_code);

  if jsonb_array_length(q->'errors') > 0 then raise exception '%', q->'errors'->>0; end if;
  if not (q->'delivery'->>'serviceable')::boolean then raise exception 'Sorry, we do not deliver to % yet', v_pincode; end if;
  if q->'coupon'->>'error' is not null then raise exception '%', q->'coupon'->>'error'; end if;

  if p_payment_mode = 'installment' then
    if not (q->'installment'->>'products_eligible')::boolean then
      raise exception 'One or more items in your cart are not available on installments';
    end if;
    v_elig := evaluate_installment_eligibility(v_uid, (q->>'total_paise')::bigint);
    if not (v_elig->>'eligible')::boolean then raise exception 'Installments not available: %', v_elig->'reasons'->>0; end if;
    if coalesce(p_agreement_version, '') = '' then raise exception 'Please accept the installment agreement'; end if;
  end if;

  insert into orders (
    user_id, status, payment_mode, shipping_address, pincode, latitude, longitude, zone_id,
    subtotal_paise, discount_paise, delivery_fee_paise, total_paise, free_delivery_applied,
    coupon_id, coupon_code, estimated_min_date, estimated_max_date, customer_note, payment_expires_at)
  values (
    v_uid, 'order_placed', p_payment_mode, v_addr, v_pincode,
    case when p_address->>'location_source' = 'gps' then (p_address->>'latitude')::double precision end,
    case when p_address->>'location_source' = 'gps' then (p_address->>'longitude')::double precision end,
    (q->'delivery'->>'zone_id')::uuid,
    (q->>'subtotal_paise')::bigint, (q->>'discount_paise')::bigint, (q->>'delivery_fee_paise')::bigint, (q->>'total_paise')::bigint,
    (q->'delivery'->>'first_order_free')::boolean,
    (q->'coupon'->>'coupon_id')::uuid, q->'coupon'->>'code',
    (q->'delivery'->>'estimated_min_date')::date, (q->'delivery'->>'estimated_max_date')::date,
    left(nullif(trim(coalesce(p_customer_note, '')), ''), 500),
    now() + make_interval(mins => v_window))
  returning id, order_number into v_order_id, v_order_number;

  -- reserve stock (conditional update prevents overselling under concurrency)
  for v_line in select * from jsonb_array_elements(q->'lines') loop
    update product_variants set stock = stock - (v_line->>'quantity')::int
    where id = (v_line->>'variant_id')::uuid and stock >= (v_line->>'quantity')::int;
    get diagnostics v_updated = row_count;
    if v_updated = 0 then raise exception 'Sorry, % just sold out', v_line->>'product_name'; end if;
    insert into inventory_movements (variant_id, delta, reason, order_id, actor_id)
    values ((v_line->>'variant_id')::uuid, -(v_line->>'quantity')::int, 'order_reserved', v_order_id, v_uid);

    insert into order_items (order_id, product_id, variant_id, product_name, variant_name, sku, image_url,
                             unit_price_paise, quantity, line_total_paise)
    values (v_order_id, (v_line->>'product_id')::uuid, (v_line->>'variant_id')::uuid, v_line->>'product_name',
            v_line->>'variant_name', v_line->>'sku', v_line->>'image_url',
            (v_line->>'unit_price_paise')::bigint, (v_line->>'quantity')::int, (v_line->>'line_total_paise')::bigint);
  end loop;

  if (q->'coupon'->>'coupon_id') is not null then
    insert into coupon_redemptions (coupon_id, user_id, order_id, discount_paise)
    values ((q->'coupon'->>'coupon_id')::uuid, v_uid, v_order_id, (q->>'discount_paise')::bigint);
  end if;

  v_amount_due := (q->>'total_paise')::bigint;
  if p_payment_mode = 'installment' then
    v_split := installment_split((q->>'total_paise')::bigint, (q->'installment'->>'count')::int);
    insert into installment_plans (order_id, user_id, installment_count, total_paise, agreement_version, agreement_accepted_at,
                                   agreement_ip)
    values (v_order_id, v_uid, array_length(v_split, 1), (q->>'total_paise')::bigint, p_agreement_version, now(),
            nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for')
    returning id into v_plan_id;
    for i in 1 .. array_length(v_split, 1) loop
      insert into installments (plan_id, seq, amount_paise, due_date, status)
      values (v_plan_id, i, v_split[i], (ist_today() + make_interval(months => i - 1))::date,
              case when i = 1 then 'due'::installment_status else 'scheduled'::installment_status end);
    end loop;
    v_amount_due := v_split[1];
  end if;

  perform _add_status_event(v_order_id, 'order_placed', null, true, v_uid);
  update orders set status = 'payment_pending' where id = v_order_id;
  perform _add_status_event(v_order_id, 'payment_pending', null, true, v_uid);

  return jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number,
    'total_paise', (q->>'total_paise')::bigint, 'amount_due_now_paise', v_amount_due,
    'payment_mode', p_payment_mode, 'payment_expires_at', now() + make_interval(mins => v_window));
end $$;

create or replace function public.record_refund(
  p_payment_intent text, p_stripe_refund_id text, p_amount bigint, p_status text, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p payments; v_prev text; v_total_refunded bigint; o orders; v_points int;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  select * into p from payments where stripe_payment_intent_id = p_payment_intent for update;
  if not found then return jsonb_build_object('result', 'unknown_payment'); end if;

  select status into v_prev from refunds where stripe_refund_id = p_stripe_refund_id;
  insert into refunds (payment_id, order_id, amount_paise, reason, stripe_refund_id, status)
  values (p.id, p.order_id, p_amount, p_reason, p_stripe_refund_id, p_status)
  on conflict (stripe_refund_id) do update set status = excluded.status, updated_at = now();

  if p_status = 'succeeded' and v_prev is distinct from 'succeeded' then
    select coalesce(sum(amount_paise), 0) into v_total_refunded from refunds where payment_id = p.id and status = 'succeeded';
    update payments set amount_refunded_paise = v_total_refunded,
      status = case when v_total_refunded >= amount_paise then 'refunded'::payment_status else 'partially_refunded'::payment_status end
    where id = p.id;
    update orders set amount_refunded_paise = (select coalesce(sum(r.amount_paise), 0) from refunds r where r.order_id = p.order_id and r.status = 'succeeded')
    where id = p.order_id returning * into o;

    if o.amount_refunded_paise >= o.amount_paid_paise and o.amount_paid_paise > 0 then
      if o.status not in ('cancelled', 'returned', 'refunded') then
        perform _release_order_reservations(o.id, null);
      end if;
      perform _apply_status(o.id, 'refunded', 'Refund completed', true, null);
      -- take back loyalty points earned on this order
      select points into v_points from loyalty_ledger where order_id = o.id and reason = 'order_delivered';
      if v_points is not null and not exists (select 1 from loyalty_ledger where order_id = o.id and reason = 'order_reversed') then
        insert into loyalty_ledger (user_id, points, reason, order_id) values (o.user_id, -v_points, 'order_reversed', o.id);
      end if;
    else
      perform _add_status_event(o.id, o.status, format('Partial refund of AED %s processed', (p_amount / 100.0)::numeric(12,2)), true, null);
    end if;
  end if;
  return jsonb_build_object('result', 'recorded');
end $$;

create or replace function public.admin_dashboard(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := coalesce(p_from, ist_today() - 29)::timestamp at time zone 'Asia/Dubai';
  v_to timestamptz := (coalesce(p_to, ist_today()) + 1)::timestamp at time zone 'Asia/Dubai';
begin
  if not has_any_role(array['operations', 'support', 'collections']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'gross_paid_paise', (select coalesce(sum(amount_paise), 0) from payments where status in ('succeeded', 'refunded', 'partially_refunded') and paid_at >= v_from and paid_at < v_to),
    'refunded_paise', (select coalesce(sum(amount_paise), 0) from refunds where status = 'succeeded' and created_at >= v_from and created_at < v_to),
    'orders_count', (select count(*) from orders where created_at >= v_from and created_at < v_to and status not in ('order_placed', 'payment_pending', 'cancelled') ),
    'new_customers', (select count(*) from profiles where created_at >= v_from and created_at < v_to),
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from orders group by status) s),
    'awaiting_approval', (select count(*) from orders where status = 'awaiting_approval'),
    'delayed', (select count(*) from orders where is_delayed),
    'low_stock', (select count(*) from product_variants where is_active and stock <= low_stock_threshold),
    'overdue_installments', (select count(*) from installments where status = 'overdue'),
    'outstanding_installments_paise', (select coalesce(sum(amount_paise), 0) from installments i join installment_plans p on p.id = i.plan_id where p.status = 'active' and i.status in ('scheduled', 'due', 'overdue')),
    'kyc_manual_review', (select count(*) from kyc_applications where status = 'manual_review'),
    'late_payments_needing_refund', (select count(*) from audit_log a where action = 'late_payment_needs_refund'
        and not exists (select 1 from refunds r where r.order_id = a.entity_id::uuid)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'paid_paise', coalesce(x.paid, 0), 'orders', coalesce(x.n, 0)) order by d), '[]'::jsonb)
              from generate_series(coalesce(p_from, ist_today() - 29), coalesce(p_to, ist_today()), interval '1 day') d
              left join (select (paid_at at time zone 'Asia/Dubai')::date as pday, sum(amount_paise) as paid, count(distinct order_id) as n
                         from payments where status in ('succeeded', 'refunded', 'partially_refunded') and paid_at >= v_from and paid_at < v_to group by 1) x on x.pday = d::date),
    'top_products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select i.product_name, sum(i.quantity) units, sum(i.line_total_paise) revenue_paise
              from order_items i join orders o on o.id = i.order_id
              where o.created_at >= v_from and o.created_at < v_to and o.status not in ('order_placed', 'payment_pending', 'cancelled', 'refunded')
              group by i.product_name order by revenue_paise desc limit 10) t)
  );
end $$;

create or replace function public.import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_idx int := 0; v_errors jsonb := '[]'::jsonb; v_cat uuid; v_product uuid;
  v_new_products int := 0; v_updated_variants int := 0; v_new_variants int := 0; v_existing uuid;
  v_price bigint; v_mrp bigint; v_url text; v_i int;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Import at most 5,000 rows at a time'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    begin
      if coalesce(r->>'product_slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'product_slug must be lowercase words joined by hyphens'; end if;
      if coalesce(trim(r->>'sku'), '') = '' then raise exception 'sku is required'; end if;
      v_price := round(coalesce(nullif(r->>'price_aed', ''), r->>'price_rupees')::numeric * 100);
      if v_price is null or v_price <= 0 then raise exception 'price_aed must be more than 0'; end if;
      v_mrp := case when coalesce(nullif(r->>'mrp_aed', ''), nullif(r->>'mrp_rupees', '')) is null then null
                else round(coalesce(nullif(r->>'mrp_aed', ''), r->>'mrp_rupees')::numeric * 100) end;
      if v_mrp is not null and v_mrp < v_price then raise exception 'mrp_aed cannot be lower than price_aed'; end if;
      if coalesce((r->>'stock')::int, 0) < 0 then raise exception 'stock cannot be negative'; end if;

      select id into v_cat from categories where slug = r->>'category_slug';
      if v_cat is null then raise exception 'Unknown category_slug "%"', r->>'category_slug'; end if;

      select id into v_product from products where slug = r->>'product_slug';
      if v_product is null then
        if coalesce(trim(r->>'product_name'), '') = '' then raise exception 'product_name is required for a new product'; end if;
        insert into products (slug, name, brand, category_id, short_description, description, tags, is_active)
        values (r->>'product_slug', trim(r->>'product_name'), nullif(trim(coalesce(r->>'brand', '')), ''), v_cat,
                nullif(r->>'short_description', ''), nullif(r->>'description', ''),
                coalesce((select array_agg(trim(t)) from unnest(string_to_array(coalesce(r->>'tags', ''), ',')) t where trim(t) <> ''), '{}'),
                coalesce((r->>'is_active')::boolean, true))
        returning id into v_product;
        v_new_products := v_new_products + 1;
        v_i := 0;
        for v_url in select trim(u) from unnest(string_to_array(coalesce(r->>'image_urls', ''), '|')) u where trim(u) ~ '^(https://|/)' loop
          insert into product_images (product_id, url, alt, sort_order) values (v_product, v_url, trim(r->>'product_name'), v_i);
          v_i := v_i + 1;
        end loop;
      end if;

      select id into v_existing from product_variants where sku = trim(r->>'sku');
      if v_existing is not null then
        update product_variants set price_paise = v_price, mrp_paise = v_mrp,
          name = coalesce(nullif(trim(r->>'variant_name'), ''), name),
          options = coalesce(r->'options', options)
        where id = v_existing;
        v_updated_variants := v_updated_variants + 1;
      else
        insert into product_variants (product_id, sku, name, options, price_paise, mrp_paise, stock)
        values (v_product, trim(r->>'sku'), coalesce(nullif(trim(r->>'variant_name'), ''), 'Default'),
                coalesce(r->'options', '{}'::jsonb), v_price, v_mrp, coalesce((r->>'stock')::int, 0));
        v_new_variants := v_new_variants + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', sqlerrm);
    end;
  end loop;

  if p_dry_run or jsonb_array_length(v_errors) > 0 then
    -- undo everything: a failed or test import changes nothing
    raise exception using errcode = 'P0001', message = 'IMPORT_PREVIEW', detail = jsonb_build_object(
      'dry_run', p_dry_run, 'errors', v_errors, 'new_products', v_new_products,
      'new_variants', v_new_variants, 'updated_variants', v_updated_variants)::text;
  end if;
  insert into audit_log(actor_id, action, entity, details) values (auth.uid(), 'import_products', 'products',
    jsonb_build_object('new_products', v_new_products, 'new_variants', v_new_variants, 'updated_variants', v_updated_variants));
  return jsonb_build_object('dry_run', false, 'errors', '[]'::jsonb, 'new_products', v_new_products,
    'new_variants', v_new_variants, 'updated_variants', v_updated_variants);
end $$;

-- ---------------------------------------------------------------------------
-- Home page banners: replace the India copy (matched by the original text, so edited banners are left alone)
-- ---------------------------------------------------------------------------
update public.banners set title = 'Luxury, delivered across the UAE',
  subtitle = 'Kitchen, electronics and everyday essentials, delivered to all seven emirates.',
  cta_label = 'Shop kitchen & dining', cta_href = '/c/kitchen-dining'
  where title = 'Luxury, delivered across India';
update public.banners set subtitle = 'Gadgets and appliances at sharp AED prices.', cta_href = '/c/electronics'
  where title = 'The flagship collection' and cta_href = '/c/laptops-tablets';
update public.banners set subtitle = replace(subtitle, 'a ₹500 gift voucher', 'an AED 25 gift voucher')
  where subtitle like '%₹500 gift voucher%';
update public.banners set subtitle = 'Then just AED 15 per order. Delivered in 1–3 days anywhere in the UAE.', cta_label = 'Check your emirate'
  where placement = 'strip' and subtitle like '%Mumbai%';
-- Fashion promos point at categories that no longer exist: switch them off (they can be edited and re-enabled in Admin → Marketing).
update public.banners set is_active = false
  where placement = 'promo' and cta_href in ('/c/ethnic-wear', '/c/men', '/c/watches', '/c/sarees', '/c/women');
update public.coupons set description = '10% off up to AED 50', max_discount_paise = 5000
  where code = 'WELCOME10' and description = '10% off up to ₹1,000';


-- ---------------------------------------------------------------------------
-- Identity check: UAE documents (Emirates ID, passport, UAE driving licence)
-- ---------------------------------------------------------------------------
alter table public.kyc_applications drop constraint if exists kyc_applications_document_type_check;
alter table public.kyc_applications add constraint kyc_applications_document_type_check
  check (document_type in ('emirates_id', 'passport', 'driving_licence', 'aadhaar', 'pan', 'voter_id'));

create or replace function public.register_manual_kyc(
  p_user uuid, p_document_type text, p_document_number_hash text, p_document_last4 text,
  p_name_on_document text, p_paths text[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_status kyc_status; v_flags text[] := '{}'; v_reasons text[] := '{}'; p text;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  if p_document_type not in ('emirates_id', 'passport', 'driving_licence') then raise exception 'Unsupported document type'; end if;
  if cardinality(p_paths) < 2 or cardinality(p_paths) > 3 then raise exception 'Upload the ID photo and a selfie'; end if;
  foreach p in array p_paths loop
    if split_part(p, '/', 1) <> p_user::text then raise exception 'Invalid file'; end if;
  end loop;
  perform 1 from profiles where id = p_user for update;
  if exists (select 1 from kyc_applications where user_id = p_user and status = 'approved') then raise exception 'Your identity is already verified'; end if;
  if exists (select 1 from kyc_applications where user_id = p_user and status in ('pending', 'manual_review')) then
    raise exception 'Your documents are already being reviewed';
  end if;
  if (select count(*) from kyc_applications where user_id = p_user and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Too many attempts today. Please try again tomorrow.';
  end if;

  if exists (select 1 from kyc_applications k where k.document_number_hash = p_document_number_hash and k.user_id <> p_user
             and k.status in ('approved', 'pending', 'manual_review')) then
    v_flags := array['duplicate_identity'];
    v_reasons := array['This ID is already linked to another account'];
    v_status := 'rejected';
  else
    v_status := 'manual_review';
  end if;

  insert into kyc_applications (user_id, status, provider, document_type, document_number_hash, document_last4, name_on_document,
                                document_paths, risk_flags, decision_reasons, consent_at, decided_at)
  values (p_user, v_status, 'manual', p_document_type, p_document_number_hash, p_document_last4, left(trim(p_name_on_document), 120),
          p_paths, v_flags, v_reasons, now(), case when v_status = 'rejected' then now() end)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', v_status, 'reasons', to_jsonb(v_reasons));
end $$;
