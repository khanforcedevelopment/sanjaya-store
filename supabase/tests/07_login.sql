-- Two-step sign-in: password, then emailed code (enforced by the access token hook)
reset role;
insert into auth.users (id, email, email_confirmed_at, encrypted_password)
values ('00000000-0000-0000-0000-00000000aa01', 'twostep@example.com', now() - interval '1 day', extensions.crypt('Right-pass-1', extensions.gen_salt('bf')));
create temp table ev as select jsonb_build_object('user_id', '00000000-0000-0000-0000-00000000aa01', 'claims', '{"role":"authenticated"}'::jsonb) as e;
grant select on ev to anon;

set role anon;
select tests.eq(start_password_login('twostep@example.com', 'wrong'), 'invalid_credentials', 'wrong password is refused');
select tests.eq(start_password_login('nobody@example.com', 'x'), 'invalid_credentials', 'unknown email gives the same answer');
select tests.throws($$select custom_access_token_hook((select e from ev))$$, 'permission denied', 'the hook is not callable from the website');
reset role;

select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"password"}' from ev))->'error'->>'message', 'email_code_required', 'a password alone never gives a session');
select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"otp"}' from ev))->'error'->>'message', 'password_required', 'an emailed code alone never gives a session');
select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"token_refresh"}' from ev)) ? 'claims', true, 'refreshing a session is allowed');

set role anon;
select tests.eq(start_password_login('TwoStep@example.com ', 'Right-pass-1'), 'ok', 'right password opens the code step');
reset role;
select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"otp"}' from ev)) ? 'claims', true, 'password then code gives a session');
select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"otp"}' from ev))->'error'->>'message', 'password_required', 'the window closes after one use');

set role anon;
select start_password_login('twostep@example.com', 'bad' || g) from generate_series(1, 5) g;
select tests.eq(start_password_login('twostep@example.com', 'Right-pass-1'), 'too_many_attempts', 'five wrong passwords lock the account for 15 minutes');
select tests.eq(start_password_reset('twostep@example.com'), 'ok', 'reset request accepted');
reset role;
select tests.eq(custom_access_token_hook((select e || '{"authentication_method":"otp"}' from ev)) ? 'claims', true, 'reset code signs in once');
set role anon;
select start_password_reset('twostep@example.com'); select start_password_reset('twostep@example.com');
select tests.eq(start_password_reset('twostep@example.com'), 'too_many_attempts', 'at most 3 reset codes an hour');
reset role;
select tests.eq((select count(*) from login_challenges where user_id = '00000000-0000-0000-0000-00000000aa01')::int, 1, 'challenge rows only through the functions');
