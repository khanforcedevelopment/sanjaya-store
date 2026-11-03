-- Two-step sign-in: password first, then a 6-digit code sent to the account's email.
--
-- Enforced on the server, so it cannot be skipped by calling the auth API directly:
--   1. `start_password_login(email, password)` checks the password (rate limited) and opens a
--      10-minute window for that account. It returns the same answer for an unknown email and a
--      wrong password.
--   2. The browser then asks Supabase Auth to email a code. Supabase Auth's "custom access token"
--      hook only issues a session for an email/SMS code while the window is open, and closes it.
--   3. Supabase's own password grant is refused by the hook, so a password alone never gives a session.
--   4. "Forgot password": `start_password_reset(email)` (rate limited) opens the same window, so the
--      emailed code alone signs the customer in, and the website then makes them choose a new password.
--      This is the usual email-based reset; it gives no more access than owning the mailbox.
-- Allowed as they are: confirming a new account (the code that confirms the email or mobile in the
-- same request) and refreshing an existing session.

create table if not exists public.login_challenges (
  user_id uuid primary key references auth.users(id) on delete cascade,
  passed_at timestamptz not null default now()
);
create table if not exists public.login_failures (
  email text not null,
  at timestamptz not null default now()
);
create index if not exists login_failures_email_at on public.login_failures (email, at desc);
alter table public.login_challenges enable row level security;
alter table public.login_failures enable row level security;
-- no policies: only the functions below touch these tables
revoke all on public.login_challenges, public.login_failures from anon, authenticated, public;
grant select, insert, update, delete on public.login_challenges to supabase_auth_admin;

create or replace function public.start_password_login(p_email text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user auth.users%rowtype;
begin
  if (select count(*) from public.login_failures where email = v_email and at > now() - interval '15 minutes') >= 5 then
    return 'too_many_attempts';
  end if;
  delete from public.login_failures where at < now() - interval '1 day';

  select * into v_user from auth.users
   where lower(email) = v_email and deleted_at is null and encrypted_password is not null and encrypted_password <> ''
   limit 1;
  if v_user.id is null or extensions.crypt(coalesce(p_password, ''), v_user.encrypted_password) <> v_user.encrypted_password then
    insert into public.login_failures(email) values (v_email);
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
  v_user uuid;
begin
  if (select count(*) from public.login_failures where email = 'reset:' || v_email and at > now() - interval '1 hour') >= 3 then
    return 'too_many_attempts';
  end if;
  insert into public.login_failures(email) values ('reset:' || v_email);
  select id into v_user from auth.users where lower(email) = v_email and deleted_at is null and email_confirmed_at is not null limit 1;
  if v_user is not null then
    insert into public.login_challenges(user_id, passed_at) values (v_user, now())
      on conflict (user_id) do update set passed_at = excluded.passed_at;
  end if;
  return 'ok';
end $$;

revoke execute on function public.start_password_reset(text) from public;
grant execute on function public.start_password_reset(text) to anon, authenticated;

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (event->>'user_id')::uuid;
  v_method text := coalesce(event->>'authentication_method', '');
  v_ok boolean;
begin
  if v_method = 'password' then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'email_code_required'));
  end if;

  if v_method in ('otp', 'magiclink', 'sms') then
    -- this code just confirmed the account's email or mobile (new account, or mobile verification)
    if exists (select 1 from auth.users u where u.id = v_user
               and (u.email_confirmed_at >= now() or u.phone_confirmed_at >= now())) then
      return jsonb_build_object('claims', event->'claims');
    end if;
    delete from public.login_challenges
      where user_id = v_user and passed_at > now() - interval '10 minutes'
      returning true into v_ok;
    if v_ok is null then
      return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'password_required'));
    end if;
  end if;

  return jsonb_build_object('claims', event->'claims');
end $$;

revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated, public;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
