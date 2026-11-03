-- Sanjaya Store: installments servicing, KYC decisions, referrals, loyalty,
-- reviews, notifications and admin reporting.

-- =========================================================================
-- Installments servicing (cron) and collections
-- =========================================================================
create or replace function public.refresh_installment_statuses()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_grace int := coalesce((setting('installments')->>'grace_days')::int, 3); v_due int; v_overdue int;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  update installments i set status = 'due'
  from installment_plans p
  where p.id = i.plan_id and p.status = 'active' and i.status = 'scheduled' and i.due_date <= ist_today() + 3;
  get diagnostics v_due = row_count;

  update installments i set status = 'overdue'
  from installment_plans p
  where p.id = i.plan_id and p.status = 'active' and i.status = 'due' and i.due_date < ist_today() - v_grace;
  get diagnostics v_overdue = row_count;

  insert into collection_tasks (installment_id)
  select i.id from installments i
  where i.status = 'overdue' and not exists (select 1 from collection_tasks t where t.installment_id = i.id and t.status <> 'resolved');

  return jsonb_build_object('marked_due', v_due, 'marked_overdue', v_overdue);
end $$;

-- Queues reminder messages; the dispatch-notifications function sends them.
create or replace function public.queue_installment_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  for r in
    select i.id, i.seq, i.amount_paise, i.due_date, i.status, p.user_id, p.installment_count, o.order_number, o.id as order_id
    from installments i join installment_plans p on p.id = i.plan_id join orders o on o.id = p.order_id
    where p.status = 'active' and i.status in ('due', 'overdue')
      and (i.last_reminder_at is null or i.last_reminder_at < now() - interval '3 days')
  loop
    insert into notification_outbox (user_id, channel, template, payload)
    select r.user_id, ch, 'installment_reminder',
      jsonb_build_object('order_number', r.order_number, 'order_id', r.order_id, 'installment_id', r.id, 'seq', r.seq,
                         'count', r.installment_count, 'amount_paise', r.amount_paise, 'due_date', r.due_date, 'overdue', r.status = 'overdue')
    from unnest(array['email', 'whatsapp']) ch;
    update installments set last_reminder_at = now(), reminder_count = reminder_count + 1 where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.update_collection_task(p_task uuid, p_status text, p_note text default null, p_promised_date date default null)
returns void language plpgsql security definer set search_path = public as $$
declare t collection_tasks;
begin
  select * into t from collection_tasks where id = p_task for update;
  if not found then raise exception 'Task not found'; end if;
  if not (has_role('super_admin') or (has_role('collections') and (t.assigned_to = auth.uid() or t.assigned_to is null))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update collection_tasks set status = p_status, promised_date = coalesce(p_promised_date, promised_date),
    assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now()
  where id = p_task;
  if nullif(trim(coalesce(p_note, '')), '') is not null then
    insert into collection_notes (task_id, author_id, note) values (p_task, auth.uid(), left(p_note, 1000));
  end if;
end $$;

create or replace function public.assign_collection_task(p_task uuid, p_staff uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('super_admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from staff_roles where user_id = p_staff and role = 'collections') then raise exception 'That person is not collections staff'; end if;
  update collection_tasks set assigned_to = p_staff, updated_at = now() where id = p_task;
end $$;

create or replace function public.waive_installment(p_installment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_plan uuid;
begin
  if not has_role('super_admin') then raise exception 'Only the Super Admin can waive installments' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update installments set status = 'waived' where id = p_installment and status in ('scheduled', 'due', 'overdue') returning plan_id into v_plan;
  if v_plan is null then raise exception 'Installment cannot be waived'; end if;
  update collection_tasks set status = 'resolved' where installment_id = p_installment;
  if not exists (select 1 from installments where plan_id = v_plan and status not in ('paid', 'waived')) then
    update installment_plans set status = 'completed' where id = v_plan;
  end if;
  insert into audit_log(actor_id, action, entity, entity_id, details) values (auth.uid(), 'waive_installment', 'installments', p_installment::text, jsonb_build_object('reason', p_reason));
end $$;

-- =========================================================================
-- KYC
-- =========================================================================
-- Called by the KYC Edge Function (service role) when the provider reports a result.
-- Applies the automatic decision rules from settings.
create or replace function public.apply_kyc_result(
  p_application uuid, p_document_type text, p_document_number_hash text, p_name_on_document text,
  p_liveness_passed boolean, p_face_match_score numeric, p_provider_flags text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a kyc_applications;
  r jsonb := coalesce(setting('kyc'), '{}'::jsonb);
  v_flags text[] := coalesce(p_provider_flags, '{}');
  v_reasons text[] := '{}';
  v_status kyc_status;
  v_threshold numeric := coalesce((r->>'face_match_threshold')::numeric, 80);
begin
  if not is_service_role() then raise exception 'Server only' using errcode = '42501'; end if;
  select * into a from kyc_applications where id = p_application for update;
  if not found then raise exception 'KYC application not found'; end if;

  if p_document_number_hash is not null and exists (
    select 1 from kyc_applications k where k.document_number_hash = p_document_number_hash and k.user_id <> a.user_id
      and k.status in ('approved', 'pending', 'manual_review')) then
    v_flags := array_append(v_flags, 'duplicate_identity'::text);
  end if;

  if not coalesce(p_liveness_passed, false) then v_reasons := array_append(v_reasons, 'Selfie liveness check did not pass'::text); end if;
  if coalesce(p_face_match_score, 0) < v_threshold then v_reasons := array_append(v_reasons, 'Selfie did not match the ID photo closely enough'::text); end if;
  if 'duplicate_identity' = any(v_flags) then v_reasons := array_append(v_reasons, 'This ID is already linked to another account'::text); end if;
  if cardinality(v_flags) > 0 and not ('duplicate_identity' = any(v_flags) and cardinality(v_flags) = 1) then
    v_reasons := v_reasons || ('Risk flags: ' || array_to_string(v_flags, ', '));
  end if;

  if cardinality(v_reasons) = 0 and coalesce((r->>'auto_approve')::boolean, true) then
    v_status := 'approved';
  elsif 'duplicate_identity' = any(v_flags) then
    v_status := 'rejected';
  else
    v_status := 'manual_review';
  end if;

  update kyc_applications set status = v_status, document_type = p_document_type, document_number_hash = p_document_number_hash,
    name_on_document = p_name_on_document, liveness_passed = p_liveness_passed, face_match_score = p_face_match_score,
    risk_flags = v_flags, decision_reasons = v_reasons,
    decided_at = case when v_status in ('approved', 'rejected') then now() end
  where id = p_application;

  insert into notification_outbox (user_id, channel, template, payload)
  values (a.user_id, 'email', 'kyc_update', jsonb_build_object('status', v_status));
  return jsonb_build_object('status', v_status, 'reasons', to_jsonb(v_reasons));
end $$;

create or replace function public.decide_kyc(p_application uuid, p_status public.kyc_status, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a kyc_applications;
begin
  if not has_role('super_admin') then raise exception 'Only the Super Admin can decide KYC' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Decision must be approved or rejected'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required'; end if;
  update kyc_applications set status = p_status, decided_by = auth.uid(), decided_at = now(),
    decision_reasons = decision_reasons || ('Manual decision: ' || p_reason)
  where id = p_application returning * into a;
  if not found then raise exception 'KYC application not found'; end if;
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'decide_kyc', 'kyc_applications', p_application::text, jsonb_build_object('status', p_status, 'reason', p_reason));
  insert into notification_outbox (user_id, channel, template, payload)
  values (a.user_id, 'email', 'kyc_update', jsonb_build_object('status', p_status));
end $$;

-- =========================================================================
-- Referrals, rewards and loyalty (run when an order is delivered)
-- =========================================================================
create or replace function public._issue_personal_coupon(p_user uuid, p_value bigint, p_description text, p_prefix text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into coupons (code, description, discount_type, discount_value, per_user_limit, assigned_user_id, ends_at)
  values (p_prefix || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_description, 'fixed', p_value, 1, p_user,
          now() + interval '90 days')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public._process_referral_rewards(p_referrer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c referral_campaigns; v_qualified int; v_milestone int; v_coupon uuid;
begin
  select count(*) into v_qualified from referrals where referrer_id = p_referrer and status = 'qualified';
  for c in select * from referral_campaigns where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()) loop
    for v_milestone in 1 .. (v_qualified / c.required_referrals) loop
      if exists (select 1 from reward_grants where user_id = p_referrer and campaign_id = c.id and milestone = v_milestone) then continue; end if;
      v_coupon := null;
      if c.reward_type in ('coupon', 'gift') and c.reward_value > 0 then
        v_coupon := _issue_personal_coupon(p_referrer, c.reward_value, c.reward_description, 'GIFT');
      end if;
      insert into reward_grants (user_id, campaign_id, milestone, reward_type, coupon_id, points)
      values (p_referrer, c.id, v_milestone, c.reward_type, v_coupon, case when c.reward_type = 'points' then c.reward_value end);
      if c.reward_type = 'points' then
        insert into loyalty_ledger (user_id, points, reason, note) values (p_referrer, c.reward_value, 'referral_reward', c.name);
      end if;
      insert into notification_outbox (user_id, channel, template, payload)
      values (p_referrer, 'email', 'referral_reward', jsonb_build_object('campaign', c.name, 'reward', c.reward_description));
    end loop;
  end loop;
end $$;

create or replace function public.on_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ref referrals; v_rate int := coalesce((setting('loyalty')->>'points_per_100_inr')::int, 1);
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    -- loyalty points on the amount actually paid
    if v_rate > 0 and new.total_paise >= 10000 then
      insert into loyalty_ledger (user_id, points, reason, order_id)
      values (new.user_id, (new.total_paise / 10000) * v_rate, 'order_delivered', new.id)
      on conflict do nothing;
    end if;
    -- referral qualifies on the friend's first delivered order
    select * into v_ref from referrals where referee_id = new.user_id and status = 'joined';
    if found then
      update referrals set status = 'qualified', qualifying_order_id = new.id, qualified_at = now() where id = v_ref.id;
      perform _process_referral_rewards(v_ref.referrer_id);
    end if;
    -- reviews become "verified purchase"
    update reviews set is_verified_purchase = true
    where user_id = new.user_id and product_id in (select product_id from order_items where order_id = new.id);
  end if;
  return new;
end $$;

create trigger orders_status_change after update of status on public.orders
  for each row execute function public.on_order_status_change();

create or replace function public.loyalty_balance(p_user uuid default null)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from loyalty_ledger
  where user_id = coalesce(p_user, auth.uid()) and (p_user is null or p_user = auth.uid() or is_staff())
$$;

create or replace function public.redeem_points(p_points int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb := coalesce(setting('loyalty'), '{}'::jsonb);
  v_min int := coalesce((r->>'min_redeem_points')::int, 500);
  v_value int := coalesce((r->>'paise_per_point')::int, 10);
  v_balance int; v_coupon uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  perform 1 from profiles where id = auth.uid() for update;
  v_balance := loyalty_balance();
  if p_points < v_min then raise exception 'Redeem at least % points', v_min; end if;
  if p_points > v_balance then raise exception 'You only have % points', v_balance; end if;
  v_coupon := _issue_personal_coupon(auth.uid(), p_points::bigint * v_value, format('%s loyalty points', p_points), 'PTS');
  insert into loyalty_ledger (user_id, points, reason, note) values (auth.uid(), -p_points, 'redeemed', (select code from coupons where id = v_coupon));
  select code into v_code from coupons where id = v_coupon;
  return jsonb_build_object('code', v_code, 'value_paise', p_points::bigint * v_value);
end $$;

create or replace function public.my_referral_summary()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'referral_code', (select referral_code from profiles where id = auth.uid()),
    'joined', (select count(*) from referrals where referrer_id = auth.uid()),
    'qualified', (select count(*) from referrals where referrer_id = auth.uid() and status = 'qualified'),
    'friends', coalesce((select jsonb_agg(jsonb_build_object(
        'name', coalesce(split_part(p.full_name, ' ', 1), 'Friend'),
        'status', r.status, 'joined_at', r.created_at, 'qualified_at', r.qualified_at) order by r.created_at desc)
      from referrals r join profiles p on p.id = r.referee_id where r.referrer_id = auth.uid()), '[]'::jsonb),
    'campaign', (select to_jsonb(c) - 'created_at' from referral_campaigns c
                 where is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())
                 order by created_at limit 1),
    'rewards', coalesce((select jsonb_agg(jsonb_build_object('milestone', g.milestone, 'reward_type', g.reward_type,
        'status', g.status, 'coupon_code', c.code, 'coupon_value_paise', c.discount_value, 'expires_at', c.ends_at,
        'coupon_used', exists (select 1 from coupon_redemptions cr where cr.coupon_id = c.id and not cr.is_released),
        'created_at', g.created_at) order by g.created_at desc)
      from reward_grants g left join coupons c on c.id = g.coupon_id where g.user_id = auth.uid()), '[]'::jsonb),
    'points', loyalty_balance()
  )
$$;

-- =========================================================================
-- Reviews: one per customer per product, rating summary kept on products
-- =========================================================================
-- SECURITY INVOKER on purpose: current_user tells us whether a customer is making the change.
create or replace function public.on_review_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if current_user in ('authenticated', 'anon') and not public.has_any_role(array['support']) then
      new.is_verified_purchase := old.is_verified_purchase;
      new.status := old.status;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_verified_purchase := exists (
      select 1 from orders o join order_items i on i.order_id = o.id
      where o.user_id = new.user_id and i.product_id = new.product_id and o.status = 'delivered');
    return new;
  end if;
  return coalesce(new, old);
end $$;
create trigger reviews_before_write before insert or update on public.reviews for each row execute function public.on_review_change();

create or replace function public.refresh_product_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update products set
    rating_avg = coalesce((select round(avg(rating)::numeric, 2) from reviews where product_id = v_product and status = 'published'), 0),
    rating_count = (select count(*) from reviews where product_id = v_product and status = 'published')
  where id = v_product;
  return null;
end $$;
create trigger reviews_after_change after insert or update or delete on public.reviews for each row execute function public.refresh_product_rating();

-- =========================================================================
-- Notifications: each customer-visible status event queues email + WhatsApp
-- =========================================================================
create or replace function public.on_status_event()
returns trigger language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  if not new.is_customer_visible or new.status in ('order_placed') then return new; end if;
  select * into o from orders where id = new.order_id;
  insert into notification_outbox (user_id, channel, template, payload)
  select o.user_id, ch, 'order_status',
    jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'status', new.status, 'note', new.note,
                       'estimated_max_date', o.estimated_max_date, 'total_paise', o.total_paise)
  from unnest(array['email', 'whatsapp']) ch;
  return new;
end $$;
create trigger order_status_events_notify after insert on public.order_status_events for each row execute function public.on_status_event();

-- =========================================================================
-- Inventory adjustments by staff
-- =========================================================================
create or replace function public.adjust_stock(p_variant uuid, p_delta int, p_reason text, p_note text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_stock int;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_reason not in ('restock', 'adjustment', 'return') then raise exception 'Invalid reason'; end if;
  update product_variants set stock = stock + p_delta where id = p_variant and stock + p_delta >= 0 returning stock into v_stock;
  if v_stock is null then raise exception 'Stock cannot go below zero'; end if;
  insert into inventory_movements (variant_id, delta, reason, actor_id, note) values (p_variant, p_delta, p_reason, auth.uid(), left(p_note, 300));
  return v_stock;
end $$;

-- =========================================================================
-- Admin dashboard
-- =========================================================================
create or replace function public.admin_dashboard(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := coalesce(p_from, ist_today() - 29)::timestamp at time zone 'Asia/Kolkata';
  v_to timestamptz := (coalesce(p_to, ist_today()) + 1)::timestamp at time zone 'Asia/Kolkata';
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
              left join (select (paid_at at time zone 'Asia/Kolkata')::date as pday, sum(amount_paise) as paid, count(distinct order_id) as n
                         from payments where status in ('succeeded', 'refunded', 'partially_refunded') and paid_at >= v_from and paid_at < v_to group by 1) x on x.pday = d::date),
    'top_products', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
              select i.product_name, sum(i.quantity) units, sum(i.line_total_paise) revenue_paise
              from order_items i join orders o on o.id = i.order_id
              where o.created_at >= v_from and o.created_at < v_to and o.status not in ('order_placed', 'payment_pending', 'cancelled', 'refunded')
              group by i.product_name order by revenue_paise desc limit 10) t)
  );
end $$;
