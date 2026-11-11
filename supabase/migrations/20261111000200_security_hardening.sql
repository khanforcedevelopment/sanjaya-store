-- Security hardening (audit 2026-11-11). Additive only: no data is deleted or rewritten.
--
--   1. Storage: size and file-type limits on every bucket, enforced by Supabase Storage itself
--      (so a staff account or a script cannot upload an HTML/SVG/executable file or a huge file).
--   2. Sign-in: a per-IP limit on wrong passwords and reset requests (password spraying across many
--      emails), and the same work for an unknown email as for a wrong password (no timing hint).
--   3. setting(): direct calls from the website only see public settings, like the table itself.
--   4. Functions that need a signed-in user are no longer callable without one (defence in depth;
--      each already checked auth.uid() / roles inside).
--   5. Support messages: at most 30 per customer per hour (spam / abuse).
--
-- Rollback: every statement is a create-or-replace / grant / bucket update; re-run the previous
-- definitions from 20261103001600_login_two_step.sql and 20261103000200_core_functions.sql, and
-- set file_size_limit / allowed_mime_types back to null.

-- ---------------------------------------------------------------------------------------------
-- 1. Storage limits
-- ---------------------------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
 where id in ('product-images', 'banner-images');

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'delivery-proofs';

-- ---------------------------------------------------------------------------------------------
-- 2. Sign-in throttling
-- ---------------------------------------------------------------------------------------------
alter table public.login_failures add column if not exists ip text;
create index if not exists login_failures_ip_at on public.login_failures (ip, at desc) where ip is not null;

-- Caller IP as set by Supabase's edge (Cloudflare). Null when unknown (SQL editor, local tests).
-- x-forwarded-for is not used: its first entry is chosen by the client.
create or replace function public.request_ip()
returns text language sql stable set search_path = public as $$
  select nullif(left(coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip'), 64), '')
$$;
revoke execute on function public.request_ip() from public, anon, authenticated;

create or replace function public.start_password_login(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip text := public.request_ip();
  v_user auth.users%rowtype;
  -- bcrypt hash of a random string: an unknown email costs the same time as a wrong password
  v_dummy constant text := '$2a$10$/3TcL0rZ6wmSvvczq9kL4ONGEPNJMNV5nm3fUlv.UZDZSyHlvZSsK';
begin
  if (select count(*) from public.login_failures where email = v_email and at > now() - interval '15 minutes') >= 5 then
    return 'too_many_attempts';
  end if;
  if v_ip is not null and (select count(*) from public.login_failures where ip = v_ip and at > now() - interval '15 minutes') >= 30 then
    return 'too_many_attempts';
  end if;
  delete from public.login_failures where at < now() - interval '1 day';

  select * into v_user from auth.users
   where lower(email) = v_email and deleted_at is null and encrypted_password is not null and encrypted_password <> ''
   limit 1;
  if v_user.id is null then
    perform extensions.crypt(coalesce(p_password, ''), v_dummy);
    insert into public.login_failures(email, ip) values (v_email, v_ip);
    return 'invalid_credentials';
  end if;
  if extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    insert into public.login_failures(email, ip) values (v_email, v_ip);
    return 'invalid_credentials';
  end if;
  if v_user.email_confirmed_at is null then return 'email_not_confirmed'; end if;
  if v_user.banned_until is not null and v_user.banned_until > now() then return 'invalid_credentials'; end if;

  insert into public.login_challenges(user_id, passed_at) values (v_user.id, now())
    on conflict (user_id) do update set passed_at = excluded.passed_at;
  delete from public.login_failures where email = v_email;
  return 'ok';
end $$;
revoke execute on function public.start_password_login(text, text) from public;
grant execute on function public.start_password_login(text, text) to anon, authenticated;

create or replace function public.start_password_reset(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_ip text := public.request_ip();
  v_user uuid;
begin
  if (select count(*) from public.login_failures where email = 'reset:' || v_email and at > now() - interval '1 hour') >= 3 then
    return 'too_many_attempts';
  end if;
  if v_ip is not null and (select count(*) from public.login_failures where ip = v_ip and email like 'reset:%' and at > now() - interval '1 hour') >= 10 then
    return 'too_many_attempts';
  end if;
  insert into public.login_failures(email, ip) values ('reset:' || v_email, v_ip);
  select id into v_user from auth.users where lower(email) = v_email and deleted_at is null and email_confirmed_at is not null limit 1;
  if v_user is not null then
    insert into public.login_challenges(user_id, passed_at) values (v_user, now())
      on conflict (user_id) do update set passed_at = excluded.passed_at;
  end if;
  return 'ok';
end $$;
revoke execute on function public.start_password_reset(text) from public;
grant execute on function public.start_password_reset(text) to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. setting(): runs as the caller, so the site_settings RLS policy (public keys, or staff) applies
--    to website calls. Database functions that call it run as the owner and still see every key.
-- ---------------------------------------------------------------------------------------------
create or replace function public.setting(p_key text)
returns jsonb language sql stable security invoker set search_path = public as $$
  select value from site_settings where key = p_key
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Signed-in-only functions: not callable anonymously
-- ---------------------------------------------------------------------------------------------
do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'adjust_stock', 'admin_dashboard', 'admin_referrals', 'apply_referral_code', 'approve_order',
      'assign_collection_task', 'assign_delivery', 'cancel_my_order', 'complete_delivery', 'decide_kyc',
      'find_user_for_staff', 'import_products', 'preview_or_import_products', 'loyalty_balance',
      'my_delivery_queue', 'my_installment_eligibility', 'my_referral_summary', 'payment_intent_for_order',
      'place_order', 'record_delivery_attempt', 'redeem_points', 'reject_referral', 'remove_demo_products',
      'report_delay', 'set_staff_role', 'transition_order', 'update_collection_task', 'update_setting',
      'waive_installment',
      -- trigger functions are never called directly
      'handle_new_user', 'handle_user_updated', 'on_order_status_change', 'on_status_event',
      'on_support_message', 'refresh_product_rating', 'support_ticket_limits'])
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;
-- triggers keep working: Postgres checks EXECUTE only when a trigger is created, not when it fires.
do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'adjust_stock', 'admin_dashboard', 'admin_referrals', 'apply_referral_code', 'approve_order',
      'assign_collection_task', 'assign_delivery', 'cancel_my_order', 'complete_delivery', 'decide_kyc',
      'find_user_for_staff', 'import_products', 'preview_or_import_products', 'loyalty_balance',
      'my_delivery_queue', 'my_installment_eligibility', 'my_referral_summary', 'payment_intent_for_order',
      'place_order', 'record_delivery_attempt', 'redeem_points', 'reject_referral', 'remove_demo_products',
      'report_delay', 'set_staff_role', 'transition_order', 'update_collection_task', 'update_setting',
      'waive_installment'])
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 5. Support message flood limit (customers only; staff replies are not limited)
-- ---------------------------------------------------------------------------------------------
create or replace function public.support_message_limits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not new.is_staff and (select count(*) from support_messages
      where author_id = new.author_id and not is_staff and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You have sent many messages in the last hour. Please wait a little before writing again.';
  end if;
  return new;
end $$;
revoke execute on function public.support_message_limits() from public, anon, authenticated;
drop trigger if exists support_message_limits on public.support_messages;
create trigger support_message_limits before insert on public.support_messages
  for each row execute function public.support_message_limits();
