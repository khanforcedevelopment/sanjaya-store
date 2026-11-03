-- Customer account: addresses, default address, profile edits and wishlist cards.
\set ON_ERROR_STOP 1
reset role;
delete from addresses where user_id = tests.id('bob');
set role authenticated; select tests.as_user(tests.id('bob'));
insert into addresses (user_id, label, recipient_name, phone, house, street, city, state, pincode)
  values (tests.id('bob'), 'Home', 'Bob B', '9876543210', '12', 'Linking Road', 'Mumbai', 'Maharashtra', '400050');
select tests.ok((select is_default from addresses where user_id = tests.id('bob') and label = 'Home'), 'first address becomes the default');
insert into addresses (user_id, label, recipient_name, phone, house, street, city, state, pincode, is_default)
  values (tests.id('bob'), 'Office', 'Bob B', '9876543210', '4F', 'BKC', 'Mumbai', 'Maharashtra', '400051', true);
select tests.eq((select label from addresses where user_id = tests.id('bob') and is_default), 'Office', 'a new default replaces the old one');
select set_default_address((select id from addresses where user_id = tests.id('bob') and label = 'Home'));
select tests.eq((select label from addresses where user_id = tests.id('bob') and is_default), 'Home', 'set_default_address switches the default');
select tests.throws($$insert into addresses (user_id, recipient_name, phone, house, street, city, state, pincode) values (tests.id('alice'), 'X Y', '9876543210', '1', 'Road', 'Pune', 'Maharashtra', '411001')$$, 'row-level security', 'cannot add an address for someone else');

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
