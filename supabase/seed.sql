-- LOCAL DEVELOPMENT DEMO DATA ONLY (loaded by `supabase db reset`, never by `supabase db push`).
-- Placeholder line-art images live in public/demo/. Replace with real products via the admin panel.

-- Products: see supabase/demo/demo_catalogue.sql (loaded after this file).

insert into public.banners (placement, eyebrow, title, subtitle, cta_label, cta_href, image_url, theme, sort_order) values
  ('hero', 'The Festive Edit', 'Luxury, delivered across India', 'Flagship phones, heirloom silks and statement watches. Dispatched from Mumbai.', 'Shop the edit', '/c/sarees', '/demo/saree-crimson.svg', 'navy', 1),
  ('hero', 'New season electronics', 'The flagship collection', 'Six easy installments on laptops, watches and more.', 'Explore electronics', '/c/laptops-tablets', '/demo/laptop-silver.svg', 'navy', 2),
  ('hero', 'Invite 5 friends', 'Share Sanjaya, get a free gift', 'When five friends receive their first order, a ₹500 gift voucher is yours.', 'Start inviting', '/account/referrals', '/demo/handbag-cognac.svg', 'ivory', 3),
  ('strip', null, 'Free delivery on your first order', 'Then just ₹50 per order. Dispatch from Mumbai in 2–7 days.', 'Check your pincode', '/delivery', null, 'gold', 1),
  ('promo', 'Fashion', 'Heirloom sarees & kurtis', 'Banarasi, Kanjeevaram and Lucknowi craft.', 'Shop ethnic wear', '/c/ethnic-wear', '/demo/kurti-rose.svg', 'ivory', 1),
  ('promo', 'Timepieces', 'Watches that mean business', 'Automatic, smart and everything between.', 'Shop watches', '/c/watches', '/demo/watch-gold.svg', 'navy', 2);

update public.site_settings set value = jsonb_build_object('enabled', true, 'title', 'Flash Sale', 'tag', 'flash-sale',
  'ends_at', (now() + interval '3 days')) where key = 'flash_sale';

insert into public.coupons (code, description, discount_type, discount_value, max_discount_paise, min_subtotal_paise, per_user_limit)
values ('WELCOME10', '10% off up to ₹1,000', 'percent', 10, 100000, 200000, 1) on conflict (code) do nothing;

insert into public.pincodes (pincode, zone_id, city, state)
select x.pin, z.id, x.city, x.state from (values ('400001','MMR','Mumbai','Maharashtra'), ('400050','MMR','Mumbai','Maharashtra'),
  ('411001','METRO','Pune','Maharashtra'), ('110001','METRO','New Delhi','Delhi'), ('560001','METRO','Bengaluru','Karnataka'))
  as x(pin, zone, city, state) join public.delivery_zones z on z.code = x.zone
on conflict do nothing;
