-- Sanjaya Store: order lifecycle, payments, delivery operations.

-- =========================================================================
-- Internal helpers
-- =========================================================================
create or replace function public._add_status_event(p_order uuid, p_status public.order_status, p_note text, p_visible boolean, p_actor uuid)
returns void language sql security definer set search_path = public as $$
  insert into order_status_events (order_id, status, note, is_customer_visible, actor_id)
  values (p_order, p_status, p_note, p_visible, p_actor)
$$;

create or replace function public._release_order_reservations(p_order uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare it record;
begin
  -- only release once
  if exists (select 1 from inventory_movements where order_id = p_order and reason = 'order_released') then return; end if;
  for it in select variant_id, quantity from order_items where order_id = p_order loop
    update product_variants set stock = stock + it.quantity where id = it.variant_id;
    insert into inventory_movements (variant_id, delta, reason, order_id, actor_id)
    values (it.variant_id, it.quantity, 'order_released', p_order, p_actor);
  end loop;
  update coupon_redemptions set is_released = true where order_id = p_order;
  update installment_plans set status = 'cancelled' where order_id = p_order and status in ('pending_first_payment', 'active');
  update installments set status = 'cancelled'
    where plan_id in (select id from installment_plans where order_id = p_order) and status in ('scheduled', 'due', 'overdue');
end $$;

-- Applies a status change. Callers have already checked permissions.
create or replace function public._apply_status(p_order uuid, p_to public.order_status, p_note text, p_visible boolean, p_actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if o.status = p_to then return; end if;

  update orders set
    status = p_to,
    approved_by = case when p_to = 'order_confirmed' then p_actor else approved_by end,
    approved_at = case when p_to = 'order_confirmed' then now() else approved_at end,
    delivered_at = case when p_to = 'delivered' then now() else delivered_at end,
    is_delayed = case when p_to in ('delivered', 'cancelled') then false else is_delayed end,
    cancelled_reason = case when p_to = 'cancelled' then coalesce(p_note, cancelled_reason) else cancelled_reason end
  where id = p_order;

  if p_to = 'cancelled' then
    perform _release_order_reservations(p_order, p_actor);
  end if;

  if p_to = 'dispatched' and not exists (select 1 from order_delivery_codes where order_id = p_order) then
    insert into order_delivery_codes (order_id, code) values (p_order, lpad((floor(random() * 10000))::int::text, 4, '0'));
  end if;

  perform _add_status_event(p_order, p_to, p_note, p_visible, p_actor);
end $$;

-- =========================================================================
-- Place order (customer)
-- =========================================================================
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
  v_pincode text := p_address->>'pincode';
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
    raise exception 'Please complete house number, street, city and state';
  end if;
  if coalesce(p_address->>'phone', '') !~ '^\+?[0-9]{10,15}$' then raise exception 'Please enter a valid mobile number'; end if;
  if coalesce(v_pincode, '') !~ '^[1-9][0-9]{5}$' then raise exception 'Please enter a valid 6-digit pincode'; end if;

  v_addr := jsonb_build_object(
    'recipient_name', left(trim(p_address->>'recipient_name'), 120), 'phone', p_address->>'phone',
    'house', left(trim(p_address->>'house'), 120), 'street', left(trim(p_address->>'street'), 200),
    'landmark', left(nullif(trim(coalesce(p_address->>'landmark', '')), ''), 200),
    'city', left(trim(p_address->>'city'), 80), 'state', left(trim(p_address->>'state'), 80),
    'pincode', v_pincode,
    'location_source', case when p_address->>'location_source' = 'gps' then 'gps' else 'manual' end);

  q := compute_quote(v_uid, p_items, v_pincode, p_coupon_code);

  if jsonb_array_length(q->'errors') > 0 then raise exception '%', q->'errors'->>0; end if;
  if not (q->'delivery'->>'serviceable')::boolean then raise exception 'Sorry, we do not deliver to pincode % yet', v_pincode; end if;
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

-- =========================================================================
-- Status changes by staff and customers
-- =========================================================================
create or replace function public.can_transition(p_order uuid, p_to public.order_status)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare o orders; v_roles text[];
begin
  select * into o from orders where id = p_order;
  if not found then return false; end if;
  select allowed_roles into v_roles from order_status_transitions where from_status = o.status and to_status = p_to;
  if v_roles is null then return false; end if;

  if 'customer' = any(v_roles) and o.user_id = auth.uid() then return true; end if;
  if has_role('super_admin') and not (v_roles = array['system']) then return true; end if;
  if 'delivery' = any(v_roles) and has_role('delivery')
     and exists (select 1 from delivery_assignments a where a.order_id = p_order and a.staff_id = auth.uid() and a.is_active) then
    return true;
  end if;
  return exists (
    select 1 from staff_roles s where s.user_id = auth.uid() and s.role::text = any(v_roles) and s.role::text <> 'delivery'
  );
end $$;

create or replace function public.transition_order(p_order uuid, p_to public.order_status, p_note text default null, p_customer_visible boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if not can_transition(p_order, p_to) then
    raise exception 'You cannot change this order from % to %', o.status, p_to using errcode = '42501';
  end if;
  if p_to = 'delivered' then
    raise exception 'Use complete_delivery to mark an order delivered';
  end if;
  if p_to = 'return_requested' and o.delivered_at < now() - make_interval(days => coalesce((setting('returns')->>'window_days')::int, 7)) then
    raise exception 'The return window for this order has closed';
  end if;
  perform _apply_status(p_order, p_to, left(p_note, 500), p_customer_visible, auth.uid());
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'order_status', 'orders', p_order::text, jsonb_build_object('from', o.status, 'to', p_to, 'note', p_note));
end $$;

create or replace function public.approve_order(p_order uuid, p_note text default null)
returns void language sql security definer set search_path = public as $$
  select transition_order(p_order, 'order_confirmed', coalesce(p_note, 'Your order has been approved'), true)
$$;

create or replace function public.report_delay(p_order uuid, p_note text, p_new_max_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if not (has_any_role(array['operations', 'support'])
          or (has_role('delivery') and exists (select 1 from delivery_assignments a where a.order_id = p_order and a.staff_id = auth.uid() and a.is_active))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if o.status in ('delivered', 'cancelled', 'refunded', 'returned', 'payment_pending', 'order_placed') then
    raise exception 'This order cannot be marked delayed';
  end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Please give the customer a reason for the delay'; end if;
  update orders set is_delayed = true,
    estimated_max_date = greatest(coalesce(p_new_max_date, estimated_max_date), estimated_max_date)
  where id = p_order;
  perform _add_status_event(p_order, 'delayed', left(p_note, 500), true, auth.uid());
end $$;

-- =========================================================================
-- Payments (called only by the Stripe webhook Edge Function, with the service role)
-- =========================================================================
create or replace function public.create_payment_record(
  p_order uuid, p_installment uuid, p_purpose text, p_amount bigint, p_session_id text, p_livemode boolean
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; o orders;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  select * into o from orders where id = p_order;
  insert into payments (order_id, installment_id, user_id, purpose, amount_paise, stripe_checkout_session_id, livemode)
  values (p_order, p_installment, o.user_id, p_purpose, p_amount, p_session_id, p_livemode)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.record_checkout_paid(
  p_session_id text, p_payment_intent text, p_amount bigint, p_currency text, p_livemode boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare p payments; o orders; v_plan installment_plans;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  select * into p from payments where stripe_checkout_session_id = p_session_id for update;
  if not found then return jsonb_build_object('result', 'unknown_session'); end if;
  if p.status = 'succeeded' then return jsonb_build_object('result', 'already_recorded'); end if;

  if p_amount <> p.amount_paise or lower(p_currency) <> p.currency then
    update payments set status = 'failed', failure_reason = format('Amount mismatch: expected %s %s, got %s %s', p.amount_paise, p.currency, p_amount, p_currency)
    where id = p.id;
    insert into audit_log(action, entity, entity_id, details) values ('payment_amount_mismatch', 'payments', p.id::text,
      jsonb_build_object('expected', p.amount_paise, 'got', p_amount, 'currency', p_currency));
    return jsonb_build_object('result', 'amount_mismatch');
  end if;

  update payments set status = 'succeeded', stripe_payment_intent_id = p_payment_intent, paid_at = now(), livemode = p_livemode
  where id = p.id;
  update orders set amount_paid_paise = amount_paid_paise + p_amount where id = p.order_id returning * into o;

  if p.purpose in ('full', 'first_installment') then
    if o.status = 'payment_pending' then
      perform _apply_status(o.id, 'payment_confirmed', 'Payment received', true, null);
      perform _apply_status(o.id, 'awaiting_approval', null, true, null);
    else
      -- paid after the order was cancelled (e.g. payment window passed): flag for a refund
      perform _add_status_event(o.id, o.status, 'Payment received after the order was closed. Refund required.', false, null);
      insert into audit_log(action, entity, entity_id, details)
      values ('late_payment_needs_refund', 'orders', o.id::text, jsonb_build_object('payment_id', p.id));
    end if;
  end if;

  if p.installment_id is not null then
    update installments set status = 'paid', paid_at = now() where id = p.installment_id;
    update collection_tasks set status = 'resolved', updated_at = now() where installment_id = p.installment_id and status <> 'resolved';
    select * into v_plan from installment_plans where id = (select plan_id from installments where id = p.installment_id);
    if v_plan.status = 'pending_first_payment' then update installment_plans set status = 'active' where id = v_plan.id; end if;
    if not exists (select 1 from installments where plan_id = v_plan.id and status not in ('paid', 'waived')) then
      update installment_plans set status = 'completed' where id = v_plan.id;
    end if;
  end if;

  return jsonb_build_object('result', 'recorded', 'order_id', o.id, 'payment_id', p.id);
end $$;

create or replace function public.record_checkout_expired(p_session_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  update payments set status = 'expired' where stripe_checkout_session_id = p_session_id and status = 'pending';
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
      perform _add_status_event(o.id, o.status, format('Partial refund of ₹%s processed', (p_amount / 100.0)::numeric(12,2)), true, null);
    end if;
  end if;
  return jsonb_build_object('result', 'recorded');
end $$;

-- Closes unpaid orders whose payment window has passed. Run every 10 minutes by cron.
create or replace function public.expire_unpaid_orders()
returns int language plpgsql security definer set search_path = public as $$
declare o record; n int := 0;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  for o in select id from orders where status in ('order_placed', 'payment_pending') and payment_expires_at < now() - interval '5 minutes' for update skip locked loop
    update payments set status = 'expired' where order_id = o.id and status = 'pending';
    perform _apply_status(o.id, 'cancelled', 'Payment was not completed in time', true, null);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Customer-facing data the Edge Function needs to start a Stripe Checkout.
create or replace function public.payment_intent_for_order(p_order uuid, p_installment uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o orders; inst installments; v_plan installment_plans;
begin
  select * into o from orders where id = p_order;
  if not found or (o.user_id <> auth.uid() and not is_service_role()) then raise exception 'Order not found'; end if;

  if p_installment is null then
    if o.status <> 'payment_pending' or o.payment_expires_at < now() then
      raise exception 'This order is not awaiting payment';
    end if;
    if o.payment_mode = 'installment' then
      select i.* into inst from installments i join installment_plans pl on pl.id = i.plan_id
      where pl.order_id = o.id and i.seq = 1;
      return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'installment_id', inst.id,
        'purpose', 'first_installment', 'amount_paise', inst.amount_paise, 'expires_at', o.payment_expires_at,
        'description', format('Order %s: installment 1', o.order_number));
    end if;
    return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'installment_id', null,
      'purpose', 'full', 'amount_paise', o.total_paise, 'expires_at', o.payment_expires_at,
      'description', format('Order %s', o.order_number));
  end if;

  select i.* into inst from installments i where i.id = p_installment;
  select * into v_plan from installment_plans where id = inst.plan_id;
  if v_plan.order_id <> o.id or v_plan.status <> 'active' then raise exception 'Installment not found'; end if;
  if inst.status not in ('scheduled', 'due', 'overdue') then raise exception 'This installment is already settled'; end if;
  if exists (select 1 from installments where plan_id = v_plan.id and seq < inst.seq and status not in ('paid', 'waived')) then
    raise exception 'Please pay earlier installments first';
  end if;
  return jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'installment_id', inst.id,
    'purpose', 'installment', 'amount_paise', inst.amount_paise, 'expires_at', null,
    'description', format('Order %s: installment %s of %s', o.order_number, inst.seq, v_plan.installment_count));
end $$;

-- =========================================================================
-- Delivery operations
-- =========================================================================
create or replace function public.assign_delivery(p_order uuid, p_staff uuid, p_scheduled_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from staff_roles where user_id = p_staff and role = 'delivery') then
    raise exception 'That person is not delivery staff';
  end if;
  select * into o from orders where id = p_order for update;
  if o.status not in ('order_confirmed', 'processing', 'packed', 'dispatched', 'in_transit', 'out_for_delivery', 'delivery_failed') then
    raise exception 'Order must be approved before it can be assigned';
  end if;
  update delivery_assignments set is_active = false where order_id = p_order and is_active;
  insert into delivery_assignments (order_id, staff_id, assigned_by, scheduled_date)
  values (p_order, p_staff, auth.uid(), p_scheduled_date);
  perform _add_status_event(p_order, o.status, 'Assigned to delivery partner', false, auth.uid());
end $$;

create or replace function public.record_delivery_attempt(
  p_order uuid, p_outcome text, p_note text default null, p_rescheduled_for date default null,
  p_latitude double precision default null, p_longitude double precision default null
) returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not (has_any_role(array['operations'])
          or exists (select 1 from delivery_assignments a where a.order_id = p_order and a.staff_id = auth.uid() and a.is_active)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_outcome = 'delivered' then raise exception 'Use complete_delivery for successful deliveries'; end if;
  select * into o from orders where id = p_order for update;
  if o.status not in ('out_for_delivery', 'in_transit', 'dispatched') then raise exception 'Order is not out for delivery'; end if;

  insert into delivery_attempts (order_id, staff_id, outcome, note, rescheduled_for, latitude, longitude)
  values (p_order, auth.uid(), p_outcome, left(p_note, 500), p_rescheduled_for, p_latitude, p_longitude);

  perform _apply_status(p_order, 'delivery_failed',
    case p_outcome
      when 'customer_unavailable' then 'Delivery attempted: you were not available'
      when 'address_issue' then 'Delivery attempted: we could not find the address'
      when 'refused' then 'Delivery refused'
      when 'rescheduled' then 'Delivery rescheduled' || coalesce(' to ' || to_char(p_rescheduled_for, 'DD Mon YYYY'), '')
      else 'Delivery attempt was not successful'
    end || coalesce('. ' || nullif(trim(p_note), ''), ''), true, auth.uid());
  if p_rescheduled_for is not null then
    update orders set estimated_max_date = greatest(estimated_max_date, p_rescheduled_for) where id = p_order;
  end if;
end $$;

create or replace function public.complete_delivery(
  p_order uuid, p_recipient_name text, p_delivery_code text default null, p_photo_path text default null,
  p_latitude double precision default null, p_longitude double precision default null
) returns void language plpgsql security definer set search_path = public as $$
declare o orders; v_code text; v_require boolean := coalesce((setting('delivery')->>'require_delivery_code')::boolean, true);
begin
  if not (has_role('super_admin')
          or (has_role('delivery') and exists (select 1 from delivery_assignments a where a.order_id = p_order and a.staff_id = auth.uid() and a.is_active))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into o from orders where id = p_order for update;
  if o.status not in ('out_for_delivery', 'in_transit', 'dispatched', 'delivery_failed') then raise exception 'Order is not out for delivery'; end if;
  if coalesce(trim(p_recipient_name), '') = '' then raise exception 'Enter the name of the person who received the parcel'; end if;
  select code into v_code from order_delivery_codes where order_id = p_order;
  if v_require and not has_role('super_admin') and (p_delivery_code is null or p_delivery_code <> v_code) then
    raise exception 'Delivery code does not match. Ask the customer for the 4-digit code shown in their order.';
  end if;

  insert into proof_of_delivery (order_id, staff_id, recipient_name, photo_path, delivery_code_verified, latitude, longitude)
  values (p_order, auth.uid(), left(trim(p_recipient_name), 120), p_photo_path, p_delivery_code is not null and p_delivery_code = v_code,
          p_latitude, p_longitude)
  on conflict (order_id) do update set recipient_name = excluded.recipient_name, photo_path = excluded.photo_path,
    delivery_code_verified = excluded.delivery_code_verified, created_at = now();
  insert into delivery_attempts (order_id, staff_id, outcome, latitude, longitude) values (p_order, auth.uid(), 'delivered', p_latitude, p_longitude);
  perform _apply_status(p_order, 'delivered', 'Delivered to ' || left(trim(p_recipient_name), 120), true, auth.uid());
end $$;

-- Delivery partner's own list
create or replace function public.my_delivery_queue()
returns table (order_id uuid, order_number text, status public.order_status, shipping_address jsonb,
               latitude double precision, longitude double precision, scheduled_date date, items int,
               total_paise bigint, amount_paid_paise bigint, is_delayed boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.order_number, o.status, o.shipping_address, o.latitude, o.longitude, a.scheduled_date,
         (select sum(quantity)::int from order_items where order_id = o.id), o.total_paise, o.amount_paid_paise,
         o.is_delayed, o.created_at
  from delivery_assignments a join orders o on o.id = a.order_id
  where a.staff_id = auth.uid() and a.is_active and o.status not in ('delivered', 'cancelled', 'refunded', 'returned')
  order by a.scheduled_date nulls last, o.created_at
$$;

-- =========================================================================
-- Customer cancellations and public tracking
-- =========================================================================
create or replace function public.cancel_my_order(p_order uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if not can_transition(p_order, 'cancelled') then raise exception 'This order can no longer be cancelled. Please contact support.'; end if;
  perform _apply_status(p_order, 'cancelled',
    'Cancelled by customer' || coalesce(': ' || nullif(trim(left(p_reason, 300)), ''), '') ||
    case when o.amount_paid_paise > 0 then '. Your refund will be processed to the original payment method.' else '' end,
    true, auth.uid());
end $$;
