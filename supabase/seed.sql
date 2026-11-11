-- LOCAL DEVELOPMENT DEMO DATA ONLY (loaded by `supabase db reset`, never by `supabase db push`).
-- Placeholder line-art images live in public/demo/. Replace with real products via the admin panel.
-- Emirates and delivery zones come from migration 20261111000100_uae_aed.sql.

-- Products: see supabase/demo/demo_catalogue.sql (loaded after this file).

insert into public.banners (placement, eyebrow, title, subtitle, cta_label, cta_href, image_url, theme, sort_order) values
  ('hero', 'Sanjaya Store', 'Luxury, delivered across the UAE', 'Kitchen, electronics and everyday essentials, delivered to all seven emirates.', 'Shop kitchen & dining', '/c/kitchen-dining', '/demo/saree-crimson.svg', 'navy', 1),
  ('hero', 'New season electronics', 'The flagship collection', 'Gadgets and appliances at sharp AED prices.', 'Explore electronics', '/c/electronics', '/demo/laptop-silver.svg', 'navy', 2),
  ('hero', 'Invite 5 friends', 'Share Sanjaya, get a free gift', 'When five friends receive their first order, an AED 25 gift voucher is yours.', 'Start inviting', '/account/referrals', '/demo/handbag-cognac.svg', 'ivory', 3),
  ('strip', null, 'Free delivery on your first order', 'Then just AED 15 per order. Delivered in 1–3 days anywhere in the UAE.', 'Check your emirate', '/delivery', null, 'gold', 1);

update public.site_settings set value = jsonb_build_object('enabled', true, 'title', 'Flash Sale', 'tag', 'flash-sale',
  'ends_at', (now() + interval '3 days')) where key = 'flash_sale';

insert into public.coupons (code, description, discount_type, discount_value, max_discount_paise, min_subtotal_paise, per_user_limit)
values ('WELCOME10', '10% off up to AED 50', 'percent', 10, 5000, 10000, 1) on conflict (code) do nothing;
