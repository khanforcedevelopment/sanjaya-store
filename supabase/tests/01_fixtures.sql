-- Test users and a small catalogue (local test database only)
insert into tests.ids values
  ('admin', '00000000-0000-0000-0000-0000000000a1'), ('ops', '00000000-0000-0000-0000-0000000000a2'),
  ('rider', '00000000-0000-0000-0000-0000000000a3'), ('rider2', '00000000-0000-0000-0000-0000000000a4'),
  ('collector', '00000000-0000-0000-0000-0000000000a5'), ('support', '00000000-0000-0000-0000-0000000000a6'),
  ('alice', '00000000-0000-0000-0000-0000000000c1'), ('bob', '00000000-0000-0000-0000-0000000000c2');

insert into auth.users (id, email, phone, raw_user_meta_data)
select id, name || '@test.local', null, jsonb_build_object('full_name', initcap(name) || ' Test') from tests.ids;

-- Bob signs up with Alice's referral link
update profiles set referred_by = null where id = tests.id('bob');
insert into referrals (referrer_id, referee_id) values (tests.id('alice'), tests.id('bob'));
update profiles set referred_by = tests.id('alice') where id = tests.id('bob');

select grant_initial_super_admin('admin@test.local');
insert into staff_roles (user_id, role) values
  (tests.id('ops'), 'operations'), (tests.id('rider'), 'delivery'), (tests.id('rider2'), 'delivery'),
  (tests.id('collector'), 'collections'), (tests.id('support'), 'support');

insert into tests.ids
select 'cat_' || slug, id from categories;

insert into products (id, slug, name, brand, category_id, short_description, tags) values
  ('00000000-0000-0000-0000-00000000b001', 'test-phone', 'Test Phone X', 'Acme', tests.id('cat_mobiles'), 'A phone', '{phone,5g}'),
  ('00000000-0000-0000-0000-00000000b002', 'test-laptop', 'Test Laptop 14', 'Acme', tests.id('cat_laptops-tablets'), 'A laptop', '{laptop}'),
  ('00000000-0000-0000-0000-00000000b003', 'test-saree', 'Silk Saree', 'Weaves', tests.id('cat_sarees'), 'Silk saree', '{silk,saree}'),
  ('00000000-0000-0000-0000-00000000b004', 'hidden-item', 'Hidden Item', null, tests.id('cat_bags'), null, '{}');
update products set is_active = false where slug = 'hidden-item';

insert into product_variants (id, product_id, sku, name, price_paise, mrp_paise, stock) values
  ('00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000b001', 'PH-128', '128 GB', 2000000, 2500000, 10),
  ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000b002', 'LP-16', '16 GB', 6000000, null, 3),
  ('00000000-0000-0000-0000-00000000d003', '00000000-0000-0000-0000-00000000b003', 'SR-RED', 'Red', 349900, 499900, 5),
  ('00000000-0000-0000-0000-00000000d004', '00000000-0000-0000-0000-00000000b004', 'HD-1', 'Default', 100000, null, 5);

insert into coupons (code, discount_type, discount_value, max_discount_paise, min_subtotal_paise, per_user_limit)
values ('SAVE10', 'percent', 10, 50000, 100000, 1), ('FLAT200', 'fixed', 20000, null, 0, 5);
