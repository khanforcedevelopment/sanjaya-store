-- Test helpers (local test database only)
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.ok(p_cond boolean, p_msg text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'FAILED: %', p_msg; end if;
  raise notice 'ok - %', p_msg;
end $$;

create or replace function tests.eq(p_got anyelement, p_want anyelement, p_msg text) returns void language plpgsql as $$
begin
  if p_got is distinct from p_want then raise exception 'FAILED: % (got %, want %)', p_msg, p_got, p_want; end if;
  raise notice 'ok - %', p_msg;
end $$;

-- Runs SQL as the current role and asserts it raises an error matching the pattern.
create or replace function tests.throws(p_sql text, p_pattern text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm ~* p_pattern then raise notice 'ok - % (%)', p_msg, sqlerrm; return; end if;
    raise exception 'FAILED: % (wrong error: %)', p_msg, sqlerrm;
  end;
  raise exception 'FAILED: % (no error raised)', p_msg;
end $$;

-- Act as a signed-in user, the anon visitor or the service role, like PostgREST does.
create or replace function tests.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;
create or replace function tests.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
end $$;
create or replace function tests.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
end $$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Fixed ids used across test files
create table tests.ids (name text primary key, id uuid not null);
grant select on tests.ids to anon, authenticated, service_role;
create or replace function tests.id(p_name text) returns uuid language sql stable as $$ select id from tests.ids where name = p_name $$;
grant execute on function tests.id(text) to anon, authenticated, service_role;
