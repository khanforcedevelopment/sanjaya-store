-- Sanjaya Store: default configuration. All values are editable by the Super Admin.

insert into public.site_settings (key, value, is_public) values
  ('store', jsonb_build_object(
     'name', 'Sanjaya Store', 'legal_name', 'Sanjaya Trading FZE',
     'support_email', 'admin@sanjayatrading.com', 'support_phone', '+971 56 911 0077', 'whatsapp', '971569110077',
     'registered_address', 'Office BLV-6F-SF60793, Ajman Boulevard-A Building, Business District, Ajman Free Zone, UAE',
     'dispatch_address', 'Mumbai, Maharashtra, India',
     'gstin', null, 'grievance_officer', null), true),
  ('delivery', jsonb_build_object(
     'first_order_free', true, 'default_fee_paise', 5000, 'origin_pincode', '400001',
     'payment_window_minutes', 60, 'require_delivery_code', true), true),
  ('installments', jsonb_build_object(
     'enabled', true, 'live_enabled', false, 'count', 6, 'grace_days', 3,
     'require_kyc', true, 'require_phone_verified', true, 'min_account_age_days', 0,
     'max_active_plans', 1, 'min_delivered_orders', 0,
     'min_order_total_paise', 500000, 'max_order_total_paise', 20000000,
     'agreement_version', '2026-11-draft-1'), true),
  ('kyc', jsonb_build_object('provider', 'sandbox', 'auto_approve', true, 'face_match_threshold', 80), false),
  ('payments', jsonb_build_object('live_enabled', false, 'currency', 'inr'), true),
  ('loyalty', jsonb_build_object('points_per_100_inr', 1, 'paise_per_point', 10, 'min_redeem_points', 500), true),
  ('returns', jsonb_build_object('window_days', 7), true),
  ('notifications', jsonb_build_object('email_enabled', true, 'whatsapp_enabled', true), false)
on conflict (key) do nothing;

-- Order lifecycle. 'system' = only the server (payments, webhooks, delivery completion).
insert into public.order_status_transitions (from_status, to_status, allowed_roles) values
  ('order_placed', 'payment_pending', '{system}'),
  ('payment_pending', 'payment_confirmed', '{system}'),
  ('payment_pending', 'cancelled', '{customer,operations}'),
  ('payment_confirmed', 'awaiting_approval', '{system}'),
  ('awaiting_approval', 'order_confirmed', '{super_admin}'),
  ('awaiting_approval', 'cancelled', '{customer}'),
  ('order_confirmed', 'processing', '{operations}'),
  ('order_confirmed', 'cancelled', '{customer,operations}'),
  ('processing', 'packed', '{operations}'),
  ('processing', 'cancelled', '{operations}'),
  ('packed', 'dispatched', '{operations,delivery}'),
  ('packed', 'cancelled', '{operations}'),
  ('dispatched', 'in_transit', '{operations,delivery}'),
  ('dispatched', 'out_for_delivery', '{operations,delivery}'),
  ('in_transit', 'out_for_delivery', '{operations,delivery}'),
  ('out_for_delivery', 'in_transit', '{operations,delivery}'),
  ('delivery_failed', 'out_for_delivery', '{operations,delivery}'),
  ('delivery_failed', 'in_transit', '{operations,delivery}'),
  ('delivery_failed', 'cancelled', '{operations}'),
  ('delivered', 'return_requested', '{customer,support}'),
  ('return_requested', 'returned', '{operations}'),
  ('return_requested', 'delivered', '{operations,support}')
on conflict do nothing;

-- Delivery zones (Mumbai dispatch). Fees follow the default (₹50) unless overridden.
insert into public.delivery_zones (code, name, min_days, max_days, is_remote, sort_order) values
  ('MMR', 'Mumbai, Thane & Navi Mumbai', 2, 3, false, 1),
  ('METRO', 'Maharashtra & metro cities', 3, 5, false, 2),
  ('REST', 'Rest of India', 5, 7, false, 3),
  ('REMOTE', 'Remote areas (North-East, J&K, Ladakh, islands)', 10, 13, true, 4)
on conflict (code) do nothing;

insert into public.pincode_prefixes (prefix, zone_id, state)
select x.prefix, z.id, x.state from (values
  -- Mumbai Metropolitan Region
  ('400', 'MMR', 'Maharashtra'), ('4012', 'MMR', 'Maharashtra'), ('4013', 'MMR', 'Maharashtra'), ('4102', 'MMR', 'Maharashtra'),
  ('4210', 'MMR', 'Maharashtra'), ('4212', 'MMR', 'Maharashtra'), ('4213', 'MMR', 'Maharashtra'), ('4215', 'MMR', 'Maharashtra'),
  -- Maharashtra & Goa
  ('40', 'METRO', 'Maharashtra'), ('41', 'METRO', 'Maharashtra'), ('42', 'METRO', 'Maharashtra'), ('43', 'METRO', 'Maharashtra'), ('44', 'METRO', 'Maharashtra'),
  ('403', 'METRO', 'Goa'),
  -- metro cities
  ('110', 'METRO', 'Delhi'), ('560', 'METRO', 'Karnataka'), ('600', 'METRO', 'Tamil Nadu'), ('500', 'METRO', 'Telangana'),
  ('700', 'METRO', 'West Bengal'), ('380', 'METRO', 'Gujarat'), ('122', 'METRO', 'Haryana'), ('201', 'METRO', 'Uttar Pradesh'),
  -- rest of India by first digit
  ('1', 'REST', null), ('2', 'REST', null), ('3', 'REST', null), ('4', 'REST', null), ('5', 'REST', null),
  ('6', 'REST', null), ('7', 'REST', null), ('8', 'REST', null),
  -- remote
  ('18', 'REMOTE', 'Jammu & Kashmir'), ('190', 'REMOTE', 'Jammu & Kashmir'), ('191', 'REMOTE', 'Jammu & Kashmir'),
  ('192', 'REMOTE', 'Jammu & Kashmir'), ('193', 'REMOTE', 'Jammu & Kashmir'), ('194', 'REMOTE', 'Ladakh'),
  ('78', 'REMOTE', 'Assam'), ('79', 'REMOTE', 'North-East'), ('737', 'REMOTE', 'Sikkim'),
  ('744', 'REMOTE', 'Andaman & Nicobar'), ('68255', 'REMOTE', 'Lakshadweep')
) as x(prefix, zone_code, state) join public.delivery_zones z on z.code = x.zone_code
on conflict (prefix) do nothing;

-- Store categories. Installments: off for mobile phones (per owner), on for selected categories.
insert into public.categories (slug, name, sort_order, installment_eligible, description) values
  ('mobiles', 'Mobile Phones', 1, false, 'Smartphones and feature phones'),
  ('laptops-tablets', 'Laptops & Tablets', 2, true, 'Laptops, tablets and 2-in-1s'),
  ('electronics', 'Electronics & Accessories', 3, true, 'Audio, wearables, chargers and more'),
  ('ethnic-wear', 'Ethnic Fashion', 4, false, 'Sarees, kurtis and dresses'),
  ('men', 'Men''s Clothing', 5, false, 'Shirts, trousers, ethnic and casual wear'),
  ('women', 'Women''s Clothing', 6, false, 'Tops, dresses and western wear'),
  ('footwear', 'Footwear', 7, false, 'Shoes, sandals and sneakers'),
  ('watches', 'Watches', 8, true, 'Analogue, digital and smart watches'),
  ('bags', 'Handbags', 9, true, 'Handbags, totes and clutches'),
  ('accessories', 'Fashion Accessories', 10, false, 'Jewellery, belts, sunglasses'),
  ('home-lifestyle', 'Home & Lifestyle', 11, false, 'Decor, kitchen and living')
on conflict (slug) do nothing;

insert into public.categories (slug, name, parent_id, sort_order)
select x.slug, x.name, c.id, x.sort from (values
  ('sarees', 'Sarees', 'ethnic-wear', 1), ('kurtis', 'Kurtis', 'ethnic-wear', 2), ('ethnic-dresses', 'Dresses', 'ethnic-wear', 3)
) as x(slug, name, parent, sort) join public.categories c on c.slug = x.parent
on conflict (slug) do nothing;

insert into public.referral_campaigns (name, headline, required_referrals, reward_type, reward_value, reward_description)
select 'Invite 5 friends', 'Invite 5 friends and get a free gift', 5, 'gift', 50000, 'Free gift voucher worth ₹500'
where not exists (select 1 from public.referral_campaigns);
