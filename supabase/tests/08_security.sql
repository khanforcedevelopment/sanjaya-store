-- Security hardening (20261111000200_security_hardening.sql)
reset role;

-- Storage limits
select tests.eq((select allowed_mime_types from storage.buckets where id = 'product-images'),
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], 'product photos accept only image types');
select tests.eq((select file_size_limit from storage.buckets where id = 'banner-images'), 10485760::bigint, 'banner photos are limited to 10 MB');
select tests.ok(not exists (select 1 from storage.buckets where 'image/svg+xml' = any (allowed_mime_types) or allowed_mime_types is null), 'SVG (script-capable) uploads are refused');

-- Per-IP sign-in limit: 30 wrong passwords from one address, spread over many emails
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.9"}', false);
set role anon;
select start_password_login('spray' || g || '@example.com', 'guess') from generate_series(1, 30) g;
select tests.eq(start_password_login('twostep@example.com', 'Right-pass-1'), 'too_many_attempts', 'password spraying from one IP is stopped');
reset role;
select set_config('request.headers', '{"cf-connecting-ip":"198.51.100.7"}', false);
delete from login_failures where email = 'twostep@example.com';
set role anon;
select tests.eq(start_password_login('twostep@example.com', 'Right-pass-1'), 'ok', 'another IP is not affected');
select tests.eq(start_password_login('nobody-at-all@example.com', 'x'), 'invalid_credentials', 'unknown email still gives the same answer');
reset role;
select set_config('request.headers', '', false);

-- setting(): website callers see public keys only; database functions see all
update site_settings set is_public = false where key = 'returns';
select tests.as_anon();
set role anon;
select tests.eq(setting('returns'), null::jsonb, 'a private setting is hidden from the website');
select tests.ok(setting('delivery') is not null, 'a public setting is still readable');
reset role;
select tests.ok(setting('returns') is not null, 'database functions still read private settings');
update site_settings set is_public = true where key = 'returns';

-- Signed-in-only functions refuse anonymous callers before running
set role anon;
select tests.throws($$select admin_dashboard(current_date, current_date)$$, 'permission denied', 'anonymous visitors cannot call admin functions');
select tests.throws($$select set_staff_role(gen_random_uuid(), 'super_admin', true)$$, 'permission denied', 'anonymous visitors cannot grant roles');
select tests.throws($$select place_order('[]'::jsonb, '{}'::jsonb, null, 'full', null, null)$$, 'permission denied', 'anonymous visitors cannot place orders');
select tests.ok(has_function_privilege('anon', 'public.search_products(text,text,text[],bigint,bigint,boolean,text,boolean,text,integer,integer,uuid[])', 'execute'), 'catalogue search stays public');
reset role;
select tests.ok(has_function_privilege('authenticated', 'public.place_order(jsonb,jsonb,text,public.payment_mode,text,text)', 'execute'), 'signed-in customers can still place orders');

-- Support message flood limit
select tests.as_user(tests.id('alice'));
set role authenticated;
insert into support_tickets (id, user_id, subject) values ('00000000-0000-0000-0000-0000000000f9', tests.id('alice'), 'Flood test');
insert into support_messages (ticket_id, author_id, body) select '00000000-0000-0000-0000-0000000000f9', tests.id('alice'), 'msg ' || g
  from generate_series(1, 30 - (select count(*)::int from support_messages where author_id = tests.id('alice') and not is_staff)) g;
select tests.throws($$insert into support_messages (ticket_id, author_id, body) values ('00000000-0000-0000-0000-0000000000f9', tests.id('alice'), 'one too many')$$, 'many messages', 'customers are limited to 30 messages an hour');
reset role;
