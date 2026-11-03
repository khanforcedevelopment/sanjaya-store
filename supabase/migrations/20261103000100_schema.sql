-- Sanjaya Store: core schema
-- All money is integer paise (1 INR = 100 paise). All times are timestamptz (UTC).

create extension if not exists pgcrypto with schema extensions;

-- =========================================================================
-- Enums
-- =========================================================================
create type public.app_role as enum ('super_admin', 'operations', 'delivery', 'collections', 'support');

create type public.order_status as enum (
  'order_placed', 'payment_pending', 'payment_confirmed', 'awaiting_approval', 'order_confirmed',
  'processing', 'packed', 'dispatched', 'in_transit', 'out_for_delivery', 'delivered',
  'delayed', 'delivery_failed', 'cancelled', 'return_requested', 'returned', 'refunded'
);

create type public.payment_mode as enum ('full', 'installment');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'expired', 'refunded', 'partially_refunded');
create type public.installment_status as enum ('scheduled', 'due', 'paid', 'overdue', 'waived', 'cancelled');
create type public.kyc_status as enum ('not_started', 'pending', 'approved', 'rejected', 'manual_review');

-- =========================================================================
-- Utility
-- =========================================================================
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =========================================================================
-- Identity
-- =========================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  email text,
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  referral_code text unique not null default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  referred_by uuid references public.profiles(id) on delete set null,
  marketing_opt_in boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_referral check (referred_by is null or referred_by <> id)
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.staff_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'Home' check (char_length(label) <= 40),
  recipient_name text not null check (char_length(recipient_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  house text not null check (char_length(house) between 1 and 120),
  street text not null check (char_length(street) between 2 and 200),
  landmark text check (char_length(landmark) <= 200),
  city text not null check (char_length(city) between 2 and 80),
  state text not null check (char_length(state) between 2 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  location_source text not null default 'manual' check (location_source in ('manual', 'gps')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_user_idx on public.addresses(user_id);
create unique index addresses_one_default on public.addresses(user_id) where is_default;
create trigger addresses_touch before update on public.addresses for each row execute function public.touch_updated_at();

-- =========================================================================
-- Settings and audit
-- =========================================================================
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);

-- =========================================================================
-- Catalogue
-- =========================================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  installment_eligible boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.immutable_array_to_text(text[]) returns text
  language sql immutable parallel safe as $$ select array_to_string($1, ' ') $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 200),
  brand text,
  short_description text,
  description text,
  category_id uuid not null references public.categories(id),
  -- null means "follow the category"; true/false overrides it
  installment_eligible boolean,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  specs jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  rating_avg numeric(3,2) not null default 0,
  rating_count int not null default 0,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('simple', public.immutable_array_to_text(tags)), 'B') ||
    setweight(to_tsvector('simple', coalesce(short_description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);
create index products_search_idx on public.products using gin(search);
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null,
  name text not null default 'Default',
  options jsonb not null default '{}'::jsonb,   -- e.g. {"colour":"Black","storage":"128 GB"}
  price_paise bigint not null check (price_paise > 0),
  mrp_paise bigint check (mrp_paise is null or mrp_paise >= price_paise),
  stock int not null default 0 check (stock >= 0),
  low_stock_threshold int not null default 5,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants(product_id);
create trigger product_variants_touch before update on public.product_variants for each row execute function public.touch_updated_at();

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order int not null default 0
);
create index product_images_product_idx on public.product_images(product_id);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('restock', 'adjustment', 'order_reserved', 'order_released', 'return')),
  order_id uuid,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text check (char_length(title) <= 120),
  body text check (char_length(body) <= 2000),
  is_verified_purchase boolean not null default false,
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- =========================================================================
-- Delivery configuration
-- =========================================================================
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  min_days int not null check (min_days >= 0),
  max_days int not null,
  is_remote boolean not null default false,
  -- null means "use the default fee from settings"
  fee_override_paise bigint check (fee_override_paise is null or fee_override_paise >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  check (max_days >= min_days)
);

create table public.pincodes (
  pincode text primary key check (pincode ~ '^[1-9][0-9]{5}$'),
  zone_id uuid not null references public.delivery_zones(id),
  city text,
  state text,
  is_serviceable boolean not null default true
);
create index pincodes_zone_idx on public.pincodes(zone_id);

-- Pincode prefixes let one row cover a whole region (e.g. "40" = Mumbai area).
-- The longest matching prefix wins; an exact row in public.pincodes beats any prefix.
create table public.pincode_prefixes (
  prefix text primary key check (prefix ~ '^[1-9][0-9]{0,5}$'),
  zone_id uuid not null references public.delivery_zones(id),
  state text,
  is_serviceable boolean not null default true
);

-- =========================================================================
-- Promotions
-- =========================================================================
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value bigint not null check (discount_value > 0),  -- percent (1-100) or paise
  max_discount_paise bigint,
  min_subtotal_paise bigint not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit int,
  per_user_limit int not null default 1,
  first_order_only boolean not null default false,
  -- personal coupons (rewards) can only be used by this customer
  assigned_user_id uuid references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.banners (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'hero' check (placement in ('hero', 'strip', 'promo')),
  eyebrow text,
  title text not null,
  subtitle text,
  cta_label text,
  cta_href text check (cta_href is null or cta_href ~ '^(/|https://)'),
  image_url text,
  theme text not null default 'navy' check (theme in ('navy', 'ivory', 'gold')),
  sort_order int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- Orders
-- =========================================================================
create sequence public.order_number_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('SNJ' || nextval('public.order_number_seq')),
  user_id uuid not null references public.profiles(id),
  status public.order_status not null default 'order_placed',
  payment_mode public.payment_mode not null default 'full',
  -- address snapshot: the order keeps the address as confirmed at checkout
  shipping_address jsonb not null,
  pincode text not null,
  latitude double precision,
  longitude double precision,
  zone_id uuid references public.delivery_zones(id),
  subtotal_paise bigint not null check (subtotal_paise >= 0),
  discount_paise bigint not null default 0 check (discount_paise >= 0),
  delivery_fee_paise bigint not null default 0 check (delivery_fee_paise >= 0),
  total_paise bigint not null check (total_paise >= 0),
  amount_paid_paise bigint not null default 0,
  amount_refunded_paise bigint not null default 0,
  free_delivery_applied boolean not null default false,
  is_delayed boolean not null default false,
  coupon_id uuid references public.coupons(id),
  coupon_code text,
  estimated_min_date date,
  estimated_max_date date,
  customer_note text check (char_length(customer_note) <= 500),
  payment_expires_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  delivered_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_paise = subtotal_paise - discount_paise + delivery_fee_paise)
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  variant_id uuid not null references public.product_variants(id),
  product_name text not null,
  variant_name text not null,
  sku text not null,
  image_url text,
  unit_price_paise bigint not null check (unit_price_paise > 0),
  quantity int not null check (quantity between 1 and 20),
  line_total_paise bigint not null,
  check (line_total_paise = unit_price_paise * quantity)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null,
  note text check (char_length(note) <= 500),
  is_customer_visible boolean not null default true,
  actor_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index order_status_events_order_idx on public.order_status_events(order_id, created_at);

-- Allowed status changes and which roles may make them. 'system' = server only.
create table public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  allowed_roles text[] not null,
  primary key (from_status, to_status)
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  discount_paise bigint not null,
  is_released boolean not null default false,
  created_at timestamptz not null default now(),
  unique (order_id)
);

-- =========================================================================
-- Payments
-- =========================================================================
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  installment_id uuid,  -- fk added below
  user_id uuid not null references public.profiles(id),
  provider text not null default 'stripe',
  purpose text not null check (purpose in ('full', 'first_installment', 'installment')),
  amount_paise bigint not null check (amount_paise > 0),
  currency text not null default 'inr',
  status public.payment_status not null default 'pending',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  livemode boolean not null default false,
  failure_reason text,
  amount_refunded_paise bigint not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id),
  order_id uuid not null references public.orders(id),
  amount_paise bigint not null check (amount_paise > 0),
  reason text,
  stripe_refund_id text unique,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'canceled')),
  requested_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every Stripe webhook event, stored once. Primary key makes processing idempotent.
create table public.stripe_events (
  id text primary key,
  type text not null,
  livemode boolean not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

-- =========================================================================
-- Delivery operations
-- =========================================================================
create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  scheduled_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index delivery_assignments_one_active on public.delivery_assignments(order_id) where is_active;
create index delivery_assignments_staff_idx on public.delivery_assignments(staff_id) where is_active;

create table public.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  outcome text not null check (outcome in ('delivered', 'customer_unavailable', 'address_issue', 'refused', 'rescheduled', 'other')),
  note text check (char_length(note) <= 500),
  rescheduled_for date,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);
create index delivery_attempts_order_idx on public.delivery_attempts(order_id);

create table public.proof_of_delivery (
  order_id uuid primary key references public.orders(id) on delete cascade,
  staff_id uuid not null references public.profiles(id),
  recipient_name text not null,
  photo_path text,           -- path in the private 'delivery-proofs' bucket
  delivery_code_verified boolean not null default false,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

-- 4-digit code the customer gives the rider at the door (shown in their account)
create table public.order_delivery_codes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4}$')
);

-- =========================================================================
-- Installments
-- =========================================================================
create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  installment_count int not null default 6 check (installment_count between 2 and 12),
  total_paise bigint not null,
  status text not null default 'pending_first_payment'
    check (status in ('pending_first_payment', 'active', 'completed', 'defaulted', 'cancelled')),
  agreement_version text not null,
  agreement_accepted_at timestamptz not null,
  agreement_ip text,
  created_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  seq int not null check (seq >= 1),
  amount_paise bigint not null check (amount_paise > 0),
  due_date date not null,
  status public.installment_status not null default 'scheduled',
  paid_at timestamptz,
  last_reminder_at timestamptz,
  reminder_count int not null default 0,
  unique (plan_id, seq)
);
alter table public.payments add constraint payments_installment_fk
  foreign key (installment_id) references public.installments(id) on delete set null;

create table public.collection_tasks (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  status text not null default 'open' check (status in ('open', 'contacted', 'promised', 'resolved', 'escalated')),
  promised_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index collection_tasks_one_open on public.collection_tasks(installment_id) where status <> 'resolved';

create table public.collection_notes (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.collection_tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  note text not null check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

-- =========================================================================
-- KYC
-- =========================================================================
create table public.kyc_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.kyc_status not null default 'pending',
  provider text not null,
  provider_reference text,
  document_type text check (document_type in ('aadhaar', 'pan', 'passport', 'driving_licence', 'voter_id')),
  -- salted hash of the ID number for duplicate detection; the raw number is never stored
  document_number_hash text,
  name_on_document text,
  liveness_passed boolean,
  face_match_score numeric(5,2),
  risk_flags text[] not null default '{}',
  decision_reasons text[] not null default '{}',
  decided_by uuid references public.profiles(id),  -- null = automatic
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kyc_applications_user_idx on public.kyc_applications(user_id, created_at desc);
create index kyc_applications_hash_idx on public.kyc_applications(document_number_hash);
create unique index kyc_applications_provider_ref on public.kyc_applications(provider, provider_reference);
create trigger kyc_touch before update on public.kyc_applications for each row execute function public.touch_updated_at();

-- =========================================================================
-- Referrals and loyalty
-- =========================================================================
create table public.referral_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  headline text not null,
  required_referrals int not null default 5 check (required_referrals between 1 and 100),
  reward_type text not null check (reward_type in ('coupon', 'gift', 'points')),
  reward_value bigint not null default 0,     -- paise for coupon, points for points
  reward_description text not null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid unique not null references public.profiles(id) on delete cascade,
  status text not null default 'joined' check (status in ('joined', 'qualified', 'rejected')),
  qualifying_order_id uuid references public.orders(id),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_id <> referee_id)
);
create index referrals_referrer_idx on public.referrals(referrer_id);

create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.referral_campaigns(id),
  milestone int not null default 1,
  reward_type text not null,
  coupon_id uuid references public.coupons(id),
  points int,
  status text not null default 'issued' check (status in ('issued', 'fulfilled', 'cancelled')),
  fulfilled_order_id uuid references public.orders(id),
  created_at timestamptz not null default now(),
  unique (user_id, campaign_id, milestone)
);

create table public.loyalty_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  reason text not null check (reason in ('order_delivered', 'referral_reward', 'redeemed', 'adjustment', 'order_reversed')),
  order_id uuid references public.orders(id),
  note text,
  created_at timestamptz not null default now()
);
create index loyalty_ledger_user_idx on public.loyalty_ledger(user_id);
create unique index loyalty_one_earn_per_order on public.loyalty_ledger(order_id) where reason = 'order_delivered';

-- =========================================================================
-- Notifications outbox (sent by the dispatch-notifications Edge Function)
-- =========================================================================
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'sms')),
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notification_outbox_queued on public.notification_outbox(created_at) where status = 'queued';

-- Support tickets (customer dashboard → support staff)
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (char_length(subject) between 3 and 150),
  status text not null default 'open' check (status in ('open', 'pending_customer', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.support_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  is_staff boolean not null default false,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
