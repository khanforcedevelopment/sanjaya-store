-- Sanjaya Store: role helpers, settings, profiles, delivery and checkout logic.
-- Every function that changes data is SECURITY DEFINER with a fixed search_path
-- and does its own permission checks, so the browser can never bypass them.

-- =========================================================================
-- Roles
-- =========================================================================
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_roles where user_id = auth.uid() and role = p_role)
$$;

-- True when the caller holds any of the given roles. super_admin always passes.
create or replace function public.has_any_role(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from staff_roles
    where user_id = auth.uid() and (role = 'super_admin' or role::text = any(p_roles))
  )
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff_roles where user_id = auth.uid())
$$;

create or replace function public.my_roles()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(role::text order by role), '{}') from staff_roles where user_id = auth.uid()
$$;

-- True for the Edge Functions (service_role key) and for the database owner in the
-- SQL editor or cron (no JWT at all). Uses session_user, which SECURITY DEFINER does not change.
create or replace function public.is_service_role()
returns boolean language sql stable as $$
  select coalesce(auth.role() = 'service_role', false)
      or (auth.role() is null and session_user in ('postgres', 'supabase_admin'))
$$;

-- =========================================================================
-- Settings
-- =========================================================================
create or replace function public.setting(p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select value from site_settings where key = p_key
$$;

create or replace function public.update_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('super_admin') then raise exception 'Only the Super Admin can change settings' using errcode = '42501'; end if;
  update site_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  if not found then raise exception 'Unknown setting %', p_key; end if;
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'update_setting', 'site_settings', p_key, p_value);
end $$;

create or replace function public.ist_today()
returns date language sql stable as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- =========================================================================
-- Profiles: created automatically when someone signs up
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_referrer uuid;
  v_code text := upper(trim(coalesce(new.raw_user_meta_data->>'referral_code', '')));
begin
  if v_code <> '' then
    select id into v_referrer from profiles where referral_code = v_code;
  end if;

  insert into profiles (id, email, phone, full_name, referred_by)
  values (
    new.id, new.email,
    case when new.phone ~ '^\+?[0-9]{10,15}$' then new.phone end,
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120), ''),
    v_referrer
  );

  if v_referrer is not null then
    insert into referrals (referrer_id, referee_id) values (v_referrer, new.id);
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email/phone in step with the verified login details
create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set
    email = new.email,
    phone = case when new.phone ~ '^\+?[0-9]{10,15}$' then new.phone else phone end
  where id = new.id;
  return new;
end $$;

create trigger on_auth_user_updated after update of email, phone on auth.users
  for each row execute function public.handle_user_updated();

-- A customer who signed up without a link can add a referral code before their first order.
create or replace function public.apply_referral_code(p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare v_referrer uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Please sign in' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = v_uid and referred_by is not null) then
    raise exception 'A referral code is already applied to your account';
  end if;
  if exists (select 1 from orders where user_id = v_uid) then
    raise exception 'Referral codes can only be added before your first order';
  end if;
  select id into v_referrer from profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then raise exception 'Referral code not found'; end if;
  if v_referrer = v_uid then raise exception 'You cannot use your own referral code'; end if;
  update profiles set referred_by = v_referrer where id = v_uid;
  insert into referrals (referrer_id, referee_id) values (v_referrer, v_uid);
end $$;

-- One-time bootstrap: run in the Supabase SQL editor after the owner signs up.
create or replace function public.grant_initial_super_admin(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_service_role() then raise exception 'Run this from the Supabase SQL editor' using errcode = '42501'; end if;
  select id into v_id from profiles where lower(email) = lower(p_email);
  if v_id is null then raise exception 'No account with email % (sign up on the website first)', p_email; end if;
  insert into staff_roles (user_id, role) values (v_id, 'super_admin') on conflict do nothing;
  insert into audit_log(action, entity, entity_id) values ('bootstrap_super_admin', 'staff_roles', v_id::text);
end $$;

create or replace function public.set_staff_role(p_user_id uuid, p_role public.app_role, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_role('super_admin') then raise exception 'Only the Super Admin can manage staff' using errcode = '42501'; end if;
  if p_grant then
    insert into staff_roles (user_id, role, granted_by) values (p_user_id, p_role, auth.uid()) on conflict do nothing;
  else
    if p_role = 'super_admin' and (select count(*) from staff_roles where role = 'super_admin') <= 1
       and exists (select 1 from staff_roles where user_id = p_user_id and role = 'super_admin') then
      raise exception 'Cannot remove the last Super Admin';
    end if;
    delete from staff_roles where user_id = p_user_id and role = p_role;
  end if;
  insert into audit_log(actor_id, action, entity, entity_id, details)
  values (auth.uid(), case when p_grant then 'grant_role' else 'revoke_role' end, 'staff_roles', p_user_id::text,
          jsonb_build_object('role', p_role));
end $$;

-- Super Admin finds a customer by email or phone to make them staff
create or replace function public.find_user_for_staff(p_query text)
returns table (id uuid, full_name text, email text, phone text, roles text[])
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not has_role('super_admin') then raise exception 'Not allowed' using errcode = '42501'; end if;
  return query
    select p.id, p.full_name, p.email, p.phone,
           coalesce((select array_agg(s.role::text) from staff_roles s where s.user_id = p.id), '{}')
    from profiles p
    where lower(p.email) = lower(trim(p_query)) or p.phone = trim(p_query)
    limit 5;
end $$;

-- =========================================================================
-- Delivery: pincode lookup, fee and estimate
-- =========================================================================
create or replace function public.resolve_pincode(p_pincode text)
returns table (zone_id uuid, zone_code text, zone_name text, min_days int, max_days int,
               is_remote boolean, fee_override_paise bigint, serviceable boolean, city text, state text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_pincode is null or p_pincode !~ '^[1-9][0-9]{5}$' then
    return;
  end if;

  return query
    select z.id, z.code, z.name, z.min_days, z.max_days, z.is_remote, z.fee_override_paise,
           (p.is_serviceable and z.is_active), p.city, p.state
    from pincodes p join delivery_zones z on z.id = p.zone_id
    where p.pincode = p_pincode;
  if found then return; end if;

  return query
    select z.id, z.code, z.name, z.min_days, z.max_days, z.is_remote, z.fee_override_paise,
           (x.is_serviceable and z.is_active), null::text, x.state
    from pincode_prefixes x join delivery_zones z on z.id = x.zone_id
    where p_pincode like x.prefix || '%'
    order by length(x.prefix) desc
    limit 1;
end $$;

-- Has this customer already used their free first delivery?
-- Orders that were cancelled/refunded, or unpaid orders whose payment window has passed, do not count.
create or replace function public.first_order_free_available(p_user_id uuid, p_exclude_order uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((setting('delivery')->>'first_order_free')::boolean, true)
     and not exists (
       select 1 from orders o
       where o.user_id = p_user_id
         and o.id is distinct from p_exclude_order
         and o.status not in ('cancelled', 'refunded')
         and not (o.status in ('order_placed', 'payment_pending') and o.payment_expires_at < now())
     )
$$;

-- =========================================================================
-- Coupons
-- =========================================================================
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
    return query select null::uuid, 0::bigint, format('Add items worth ₹%s more to use this coupon', ((c.min_subtotal_paise - p_subtotal) / 100.0)::numeric(12,2)); return;
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

-- =========================================================================
-- Installment eligibility
-- =========================================================================
create or replace function public.product_installment_eligible(p_product_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(p.installment_eligible, c.installment_eligible, false)
  from products p join categories c on c.id = p.category_id where p.id = p_product_id
$$;

create or replace function public.installment_split(p_total bigint, p_count int)
returns bigint[] language plpgsql immutable as $$
declare v_each bigint := p_total / p_count; v_first bigint := p_total - (p_total / p_count) * (p_count - 1);
begin
  if p_count < 1 or p_total < p_count then raise exception 'Invalid installment split'; end if;
  return array[v_first] || array_fill(v_each, array[p_count - 1]);
end $$;

-- Automatic decision for "can this customer buy on installments?". Rules come from settings.
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
      v_reasons := v_reasons || format('Order must be at least ₹%s', (coalesce((r->>'min_order_total_paise')::bigint, 0) / 100));
    end if;
    if r ? 'max_order_total_paise' and p_order_total > (r->>'max_order_total_paise')::bigint then
      v_reasons := v_reasons || format('Order must be at most ₹%s', ((r->>'max_order_total_paise')::bigint / 100));
    end if;
  end if;

  return jsonb_build_object('eligible', cardinality(v_reasons) = 0, 'reasons', to_jsonb(v_reasons));
end $$;

create or replace function public.my_installment_eligibility()
returns jsonb language sql stable security definer set search_path = public as $$
  select evaluate_installment_eligibility(auth.uid())
$$;

-- =========================================================================
-- Checkout quote: every price, discount and fee is calculated here, from the database.
-- =========================================================================
create or replace function public.compute_quote(
  p_user_id uuid, p_items jsonb, p_pincode text, p_coupon_code text, p_exclude_order uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_lines jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_item jsonb;
  v_qty int;
  v_row record;
  v_all_installment boolean := true;
  v_zone record;
  v_first_free boolean;
  v_fee bigint := 0;
  v_default_fee bigint := coalesce((setting('delivery')->>'default_fee_paise')::bigint, 5000);
  v_coupon record;
  v_coupon_id uuid;
  v_discount bigint := 0;
  v_coupon_error text;
  v_total bigint;
  v_errors text[] := '{}';
  v_inst jsonb := coalesce(setting('installments'), '{}'::jsonb);
  v_count int := coalesce((v_inst->>'count')::int, 6);
  v_seen uuid[] := '{}';
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Too many items in one order'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 or v_qty > 20 then raise exception 'Quantity must be between 1 and 20'; end if;
    if (v_item->>'variant_id')::uuid = any(v_seen) then raise exception 'Duplicate item in cart'; end if;
    v_seen := v_seen || (v_item->>'variant_id')::uuid;

    select v.id as variant_id, v.sku, v.name as variant_name, v.price_paise, v.mrp_paise, v.stock, v.is_active as v_active,
           p.id as product_id, p.name as product_name, p.slug, p.is_active as p_active,
           (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url,
           product_installment_eligible(p.id) as installment_ok
    into v_row
    from product_variants v join products p on p.id = v.product_id
    where v.id = (v_item->>'variant_id')::uuid;

    if not found or not v_row.v_active or not v_row.p_active then
      v_errors := array_append(v_errors, 'An item in your cart is no longer available'::text);
      continue;
    end if;
    if v_row.stock < v_qty then
      v_errors := v_errors || format('Only %s left of %s', v_row.stock, v_row.product_name);
    end if;
    v_all_installment := v_all_installment and v_row.installment_ok;
    v_subtotal := v_subtotal + v_row.price_paise * v_qty;
    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_row.variant_id, 'product_id', v_row.product_id, 'product_name', v_row.product_name,
      'slug', v_row.slug, 'variant_name', v_row.variant_name, 'sku', v_row.sku, 'image_url', v_row.image_url,
      'unit_price_paise', v_row.price_paise, 'mrp_paise', v_row.mrp_paise, 'quantity', v_qty,
      'line_total_paise', v_row.price_paise * v_qty, 'in_stock', v_row.stock >= v_qty,
      'installment_eligible', v_row.installment_ok);
  end loop;

  -- delivery
  select * into v_zone from resolve_pincode(p_pincode);
  if p_user_id is null then
    v_first_free := coalesce((setting('delivery')->>'first_order_free')::boolean, true);
  else
    v_first_free := first_order_free_available(p_user_id, p_exclude_order);
  end if;
  if v_zone.zone_id is not null and v_zone.serviceable then
    v_fee := case when v_first_free then 0 else coalesce(v_zone.fee_override_paise, v_default_fee) end;
  end if;

  -- coupon
  if nullif(trim(coalesce(p_coupon_code, '')), '') is not null then
    select * into v_coupon from evaluate_coupon(p_coupon_code, p_user_id, v_subtotal, v_first_free);
    v_discount := coalesce(v_coupon.discount_paise, 0);
    v_coupon_error := v_coupon.error;
    v_coupon_id := v_coupon.coupon_id;
  end if;

  v_total := v_subtotal - v_discount + v_fee;

  return jsonb_build_object(
    'lines', v_lines,
    'subtotal_paise', v_subtotal,
    'discount_paise', v_discount,
    'delivery_fee_paise', v_fee,
    'total_paise', v_total,
    'errors', to_jsonb(v_errors),
    'coupon', jsonb_build_object('code', upper(nullif(trim(coalesce(p_coupon_code, '')), '')),
                                 'coupon_id', v_coupon_id, 'error', v_coupon_error),
    'delivery', jsonb_build_object(
      'pincode', p_pincode,
      'known', v_zone.zone_id is not null,
      'serviceable', coalesce(v_zone.serviceable, false),
      'zone_id', v_zone.zone_id, 'zone_name', v_zone.zone_name, 'is_remote', coalesce(v_zone.is_remote, false),
      'min_days', v_zone.min_days, 'max_days', v_zone.max_days,
      'estimated_min_date', ist_today() + v_zone.min_days,
      'estimated_max_date', ist_today() + v_zone.max_days,
      'city', v_zone.city, 'state', v_zone.state,
      'first_order_free', v_first_free,
      'first_order_assumed', p_user_id is null,
      'standard_fee_paise', coalesce(v_zone.fee_override_paise, v_default_fee)),
    'installment', jsonb_build_object(
      'products_eligible', v_all_installment and jsonb_array_length(v_lines) > 0,
      'count', v_count,
      'schedule_paise', case when v_all_installment and v_total >= v_count then to_jsonb(installment_split(v_total, v_count)) else null end)
  );
end $$;

-- Public wrapper used by the cart and checkout pages.
create or replace function public.quote_cart(p_items jsonb, p_pincode text default null, p_coupon_code text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select compute_quote(auth.uid(), p_items, p_pincode, p_coupon_code)
$$;

create or replace function public.check_pincode(p_pincode text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((
    select jsonb_build_object('known', true, 'serviceable', serviceable, 'zone_name', zone_name,
      'is_remote', is_remote, 'min_days', min_days, 'max_days', max_days, 'city', city, 'state', state,
      'estimated_min_date', ist_today() + min_days, 'estimated_max_date', ist_today() + max_days,
      'first_order_free', case when auth.uid() is null then coalesce((setting('delivery')->>'first_order_free')::boolean, true)
                               else first_order_free_available(auth.uid()) end,
      'standard_fee_paise', coalesce(fee_override_paise, (setting('delivery')->>'default_fee_paise')::bigint, 5000))
    from resolve_pincode(p_pincode)), jsonb_build_object('known', false, 'serviceable', false))
$$;
