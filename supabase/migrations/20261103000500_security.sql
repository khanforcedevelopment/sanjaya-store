-- Sanjaya Store: Row Level Security, grants and storage buckets.
-- Rule of thumb: customers read their own data; staff read what their role needs;
-- anything that changes money, stock or order status goes through the functions.

-- Enable RLS everywhere
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update using (public.has_role('super_admin'));
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, marketing_opt_in) on public.profiles to authenticated;
grant update (is_blocked) on public.profiles to authenticated;  -- only passes RLS for super_admin (trigger below)

create or replace function public.guard_profile_admin_columns() returns trigger language plpgsql as $$
begin
  if new.is_blocked is distinct from old.is_blocked and not public.has_role('super_admin') and not public.is_service_role() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_admin_columns();

-- ---------- staff roles ----------
create policy staff_roles_read on public.staff_roles for select using (user_id = auth.uid() or public.has_role('super_admin'));
revoke insert, update, delete on public.staff_roles from anon, authenticated;

-- ---------- addresses ----------
create policy addresses_own on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.addresses for select using (public.has_any_role(array['operations', 'support']));

-- ---------- settings / audit ----------
create policy settings_public_read on public.site_settings for select using (is_public or public.is_staff());
revoke insert, update, delete on public.site_settings from anon, authenticated;
create policy audit_admin_read on public.audit_log for select using (public.has_role('super_admin'));
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- ---------- catalogue ----------
create policy categories_read on public.categories for select using (is_active or public.has_any_role(array['operations']));
create policy categories_write on public.categories for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

create policy products_read on public.products for select using (is_active or public.has_any_role(array['operations', 'support']));
create policy products_write on public.products for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

create policy variants_read on public.product_variants for select using (
  (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active)) or public.has_any_role(array['operations', 'support']));
create policy variants_write on public.product_variants for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));
-- stock only changes through adjust_stock / orders so every change is recorded

create or replace function public.guard_variant_stock() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.stock is distinct from old.stock and current_user in ('authenticated', 'anon') then
    raise exception 'Use adjust_stock to change stock' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger variants_guard_stock before update on public.product_variants for each row execute function public.guard_variant_stock();

create policy images_read on public.product_images for select using (true);
create policy images_write on public.product_images for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

create policy inventory_read on public.inventory_movements for select using (public.has_any_role(array['operations']));
revoke insert, update, delete on public.inventory_movements from anon, authenticated;

create policy reviews_read on public.reviews for select using (status = 'published' or user_id = auth.uid() or public.has_any_role(array['support']));
create policy reviews_insert on public.reviews for insert with check (user_id = auth.uid() and status = 'published');
create policy reviews_update_own on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid() and status = 'published');
create policy reviews_delete_own on public.reviews for delete using (user_id = auth.uid() or public.has_any_role(array['support']));
create policy reviews_moderate on public.reviews for update using (public.has_any_role(array['support']));

create policy wishlists_own on public.wishlists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- delivery config ----------
create policy zones_read on public.delivery_zones for select using (true);
create policy zones_write on public.delivery_zones for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));
create policy pincodes_read on public.pincodes for select using (true);
create policy pincodes_write on public.pincodes for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));
create policy prefixes_read on public.pincode_prefixes for select using (true);
create policy prefixes_write on public.pincode_prefixes for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

-- ---------- promotions ----------
-- coupon codes are not listable by the public (prevents guessing); customers see only their personal coupons
create policy coupons_own on public.coupons for select using (assigned_user_id = auth.uid() or public.has_any_role(array['operations', 'support']));
create policy coupons_write on public.coupons for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));
create policy banners_read on public.banners for select using (
  (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now())) or public.has_any_role(array['operations']));
create policy banners_write on public.banners for all using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

-- ---------- orders ----------
create or replace function public.can_view_order(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders o where o.id = p_order and o.user_id = auth.uid())
      or has_any_role(array['operations', 'support', 'collections'])
      or exists (select 1 from delivery_assignments a where a.order_id = p_order and a.staff_id = auth.uid() and a.is_active)
$$;

create policy orders_read on public.orders for select using (public.can_view_order(id));
revoke insert, update, delete on public.orders from anon, authenticated;
create policy order_items_read on public.order_items for select using (public.can_view_order(order_id));
revoke insert, update, delete on public.order_items from anon, authenticated;
create policy status_events_read on public.order_status_events for select using (
  public.can_view_order(order_id) and (is_customer_visible or public.is_staff()));
revoke insert, update, delete on public.order_status_events from anon, authenticated;
create policy transitions_read on public.order_status_transitions for select using (true);
revoke insert, update, delete on public.order_status_transitions from anon, authenticated;
create policy redemptions_read on public.coupon_redemptions for select using (user_id = auth.uid() or public.has_any_role(array['operations', 'support']));
revoke insert, update, delete on public.coupon_redemptions from anon, authenticated;

-- ---------- payments ----------
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.has_any_role(array['operations', 'support', 'collections']));
revoke insert, update, delete on public.payments from anon, authenticated;
create policy refunds_read on public.refunds for select using (public.can_view_order(order_id) and (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or public.has_any_role(array['operations', 'support'])));
revoke insert, update, delete on public.refunds from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;

-- ---------- delivery operations ----------
create policy assignments_read on public.delivery_assignments for select using (staff_id = auth.uid() or public.has_any_role(array['operations', 'support']));
revoke insert, update, delete on public.delivery_assignments from anon, authenticated;
create policy attempts_read on public.delivery_attempts for select using (staff_id = auth.uid() or public.has_any_role(array['operations', 'support']));
revoke insert, update, delete on public.delivery_attempts from anon, authenticated;
create policy pod_read on public.proof_of_delivery for select using (public.can_view_order(order_id));
revoke insert, update, delete on public.proof_of_delivery from anon, authenticated;
-- the door code is visible to the customer only (and the Super Admin), never to the rider
create policy delivery_codes_read on public.order_delivery_codes for select using (
  exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()) or public.has_role('super_admin'));
revoke insert, update, delete on public.order_delivery_codes from anon, authenticated;

-- ---------- installments ----------
create policy plans_read on public.installment_plans for select using (user_id = auth.uid() or public.has_any_role(array['collections', 'support', 'operations']));
revoke insert, update, delete on public.installment_plans from anon, authenticated;
create policy installments_read on public.installments for select using (
  exists (select 1 from public.installment_plans p where p.id = plan_id and p.user_id = auth.uid())
  or public.has_any_role(array['collections', 'support', 'operations']));
revoke insert, update, delete on public.installments from anon, authenticated;
create policy collection_tasks_read on public.collection_tasks for select using (public.has_any_role(array['collections']));
revoke insert, update, delete on public.collection_tasks from anon, authenticated;
create policy collection_notes_read on public.collection_notes for select using (public.has_any_role(array['collections']));
revoke insert, update, delete on public.collection_notes from anon, authenticated;

-- ---------- KYC ----------
create policy kyc_read on public.kyc_applications for select using (user_id = auth.uid() or public.has_role('super_admin'));
revoke insert, update, delete on public.kyc_applications from anon, authenticated;

-- ---------- referrals / loyalty ----------
create policy campaigns_read on public.referral_campaigns for select using (is_active or public.has_role('super_admin'));
create policy campaigns_write on public.referral_campaigns for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));
create policy referrals_read on public.referrals for select using (referrer_id = auth.uid() or referee_id = auth.uid() or public.has_any_role(array['support']));
revoke insert, update, delete on public.referrals from anon, authenticated;
create policy grants_read on public.reward_grants for select using (user_id = auth.uid() or public.has_any_role(array['support', 'operations']));
create policy grants_admin on public.reward_grants for update using (public.has_any_role(array['operations']));
revoke insert, delete on public.reward_grants from anon, authenticated;
create policy loyalty_read on public.loyalty_ledger for select using (user_id = auth.uid() or public.has_any_role(array['support']));
revoke insert, update, delete on public.loyalty_ledger from anon, authenticated;

-- ---------- notifications / support ----------
create policy outbox_admin_read on public.notification_outbox for select using (public.has_role('super_admin'));
revoke insert, update, delete on public.notification_outbox from anon, authenticated;

create policy tickets_read on public.support_tickets for select using (user_id = auth.uid() or public.has_any_role(array['support']));
create policy tickets_insert on public.support_tickets for insert with check (user_id = auth.uid() and status = 'open');
create policy tickets_staff_update on public.support_tickets for update using (public.has_any_role(array['support']));
create policy messages_read on public.support_messages for select using (
  exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or public.has_any_role(array['support']))));
create policy messages_insert on public.support_messages for insert with check (
  author_id = auth.uid() and (
    (is_staff = false and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()))
    or (is_staff = true and public.has_any_role(array['support']))));

-- =========================================================================
-- Function permissions: server-only functions are not callable from the browser
-- =========================================================================
do $$ declare f text; begin
  foreach f in array array[
    'public.create_payment_record(uuid, uuid, text, bigint, text, boolean)',
    'public.record_checkout_paid(text, text, bigint, text, boolean)',
    'public.record_checkout_expired(text)',
    'public.record_refund(text, text, bigint, text, text)',
    'public.expire_unpaid_orders()',
    'public.refresh_installment_statuses()',
    'public.queue_installment_reminders()',
    'public.apply_kyc_result(uuid, text, text, text, boolean, numeric, text[])',
    'public.grant_initial_super_admin(text)',
    'public._apply_status(uuid, public.order_status, text, boolean, uuid)',
    'public._add_status_event(uuid, public.order_status, text, boolean, uuid)',
    'public._release_order_reservations(uuid, uuid)',
    'public._issue_personal_coupon(uuid, bigint, text, text)',
    'public._process_referral_rewards(uuid)',
    'public.compute_quote(uuid, jsonb, text, text, uuid)',
    'public.evaluate_coupon(text, uuid, bigint, boolean)',
    'public.first_order_free_available(uuid, uuid)',
    'public.evaluate_installment_eligibility(uuid, bigint)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- =========================================================================
-- Storage buckets
-- =========================================================================
insert into storage.buckets (id, name, public) values
  ('product-images', 'product-images', true),
  ('banner-images', 'banner-images', true),
  ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

create policy "public images readable" on storage.objects for select
  using (bucket_id in ('product-images', 'banner-images'));
create policy "staff upload images" on storage.objects for insert
  with check (bucket_id in ('product-images', 'banner-images') and public.has_any_role(array['operations']));
create policy "staff manage images" on storage.objects for delete
  using (bucket_id in ('product-images', 'banner-images') and public.has_any_role(array['operations']));
-- proof photos: path must be <order_id>/<file>, uploaded by the assigned rider
create policy "rider uploads proof" on storage.objects for insert
  with check (bucket_id = 'delivery-proofs' and exists (
    select 1 from public.delivery_assignments a
    where a.order_id::text = (storage.foldername(name))[1] and a.staff_id = auth.uid() and a.is_active));
create policy "proof readable by order viewers" on storage.objects for select
  using (bucket_id = 'delivery-proofs' and public.can_view_order(((storage.foldername(name))[1])::uuid));
