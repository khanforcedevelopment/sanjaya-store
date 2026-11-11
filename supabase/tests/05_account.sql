-- Customer account: addresses, default address, profile edits and wishlist cards.
\set ON_ERROR_STOP 1
reset role;
delete from addresses where user_id = tests.id('bob');
set role authenticated; select tests.as_user(tests.id('bob'));
insert into addresses (user_id, label, recipient_name, phone, house, street, city, state, pincode)
  values (tests.id('bob'), 'Home', 'Bob B', '+971501234567', '12', 'Linking Road', 'Dubai', 'Dubai', 'DXB');
select tests.ok((select is_default from addresses where user_id = tests.id('bob') and label = 'Home'), 'first address becomes the default');
insert into addresses (user_id, label, recipient_name, phone, house, street, city, state, pincode, is_default)
  values (tests.id('bob'), 'Office', 'Bob B', '+971501234567', '4F', 'BKC', 'Dubai', 'Dubai', 'DXB', true);
select tests.eq((select label from addresses where user_id = tests.id('bob') and is_default), 'Office', 'a new default replaces the old one');
select set_default_address((select id from addresses where user_id = tests.id('bob') and label = 'Home'));
select tests.eq((select label from addresses where user_id = tests.id('bob') and is_default), 'Home', 'set_default_address switches the default');
select tests.throws($$insert into addresses (user_id, recipient_name, phone, house, street, city, state, pincode) values (tests.id('alice'), 'X Y', '+971501234567', '1', 'Road', 'Abu Dhabi', 'Abu Dhabi', 'AUH')$$, 'row-level security', 'cannot add an address for someone else');
select tests.throws($$insert into addresses (user_id, recipient_name, phone, house, street, city, state, pincode) values (tests.id('bob'), 'X Y', '+971501234567', '1', 'Road', 'Mumbai', 'Maharashtra', '400050')$$, 'addresses_pincode_check', 'Indian pincodes are no longer accepted');

select tests.as_user(tests.id('alice'));
select tests.throws($$select set_default_address((select id from addresses where user_id = tests.id('bob') limit 1))$$, 'ADDRESS_NOT_FOUND', 'cannot touch another customer''s address');
select tests.eq((select count(*) from addresses where user_id = tests.id('bob'))::int, 0, 'other customers'' addresses are invisible');
update profiles set full_name = 'Alice Renamed', marketing_opt_in = true where id = tests.id('alice');
select tests.eq((select full_name from profiles where id = tests.id('alice')), 'Alice Renamed', 'customer can edit own name');
select tests.throws($$update profiles set referral_code = 'HACKED1' where id = tests.id('alice')$$, 'permission denied', 'referral code cannot be edited');

set role anon; select tests.as_anon();
select tests.eq((search_products(p_ids => array[(select id from products where is_active and slug <> 'new-kurta' limit 1)])->'facets'->>'total')::int, 1, 'search by product ids');
select tests.eq((search_products(p_ids => array[]::uuid[])->'facets'->>'total')::int, 0, 'empty id list returns nothing');
reset role;

-- Staff panel helpers
set role authenticated; select tests.as_user(tests.id('alice'));
select tests.throws($$select * from list_delivery_staff()$$, 'Not allowed', 'customers cannot list riders');
select tests.throws($$select * from list_staff()$$, 'Not allowed', 'customers cannot list staff');
select tests.as_user(tests.id('ops'));
select tests.ok((select count(*) from list_delivery_staff()) >= 0, 'operations can list riders');
select tests.throws($$select * from list_staff()$$, 'Not allowed', 'operations cannot list all staff');
select tests.as_user(tests.id('admin'));
select tests.ok((select count(*) from list_staff()) >= 1, 'super admin lists staff');
reset role;

-- Installment split: whole rupees, total preserved
select tests.eq(installment_split(9419900, 6), array[1570400, 1569900, 1569900, 1569900, 1569900, 1569900]::bigint[], 'split 94,199 into 6 whole-rupee payments');
select tests.eq((select sum(x) from unnest(installment_split(1234567, 6)) x)::bigint, 1234567::bigint, 'split keeps the total');
select tests.eq(installment_split(12, 6), array[2, 2, 2, 2, 2, 2]::bigint[], 'tiny totals fall back to paise');
