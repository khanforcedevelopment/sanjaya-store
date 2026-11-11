-- Admin tools: product filters + bulk edit, glass dashboard data, delivery fleet.
-- Everything here is read or changed through security-definer functions that check the staff role first.

-- =========================================================================
-- 1. Cost prices (staff only: kept out of product_variants, which the public can read)
-- =========================================================================
create table if not exists public.variant_costs (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  cost_paise bigint not null check (cost_paise >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.variant_costs enable row level security;
drop policy if exists variant_costs_staff on public.variant_costs;
create policy variant_costs_staff on public.variant_costs for all
  using (public.has_any_role(array['operations'])) with check (public.has_any_role(array['operations']));

-- Dashboard settings (monthly target, warehouse pin for the fleet map)
insert into public.site_settings (key, value, is_public)
values ('dashboard', jsonb_build_object('monthly_target_paise', 10000000, 'warehouse_lat', 25.2048, 'warehouse_lng', 55.2708, 'warehouse_name', 'Sanjaya warehouse'), false)
on conflict (key) do nothing;

-- =========================================================================
-- 2. Admin product list with filters
-- =========================================================================
create or replace function public.admin_list_products(
  p_query text default null,
  p_category uuid default null,        -- includes sub-categories
  p_status text default null,          -- live | hidden
  p_featured boolean default null,
  p_stock text default null,           -- in | out | low
  p_brand text default null,
  p_min_paise bigint default null,
  p_max_paise bigint default null,
  p_tag text default null,
  p_images text default null,          -- with | without
  p_sort text default 'newest',        -- newest | oldest | name | price_asc | price_desc | stock_asc | stock_desc
  p_limit int default 50,
  p_offset int default 0,
  p_ids_only boolean default false     -- return just the ids of every match (select all), up to 5,000
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_result jsonb;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;

  with cat as (
    select id from categories where id = p_category
    union select id from categories where parent_id = p_category
  ),
  base as (
    select p.id, p.slug, p.name, p.brand, p.is_active, p.is_featured, p.tags, p.created_at,
           c.name as category_name, p.category_id,
           coalesce(v.min_price, 0) as min_price, coalesce(v.stock, 0) as stock,
           coalesce(v.variants, 0) as variants, coalesce(v.low, 0) as low_variants,
           (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url
    from products p
    join categories c on c.id = p.category_id
    left join lateral (
      select min(price_paise) as min_price, sum(stock)::int as stock, count(*)::int as variants,
             count(*) filter (where stock <= low_stock_threshold)::int as low
      from product_variants where product_id = p.id and is_active
    ) v on true
    where (p_category is null or p.category_id in (select id from cat))
      and (v_q is null or p.name ilike '%' || v_q || '%' or p.brand ilike '%' || v_q || '%' or p.slug ilike '%' || v_q || '%'
           or exists (select 1 from product_variants pv where pv.product_id = p.id and pv.sku ilike '%' || v_q || '%'))
      and (p_status is null or (p_status = 'live' and p.is_active) or (p_status = 'hidden' and not p.is_active))
      and (p_featured is null or p.is_featured = p_featured)
      and (p_brand is null or p.brand = p_brand)
      and (p_tag is null or p_tag = any(p.tags))
      and (p_min_paise is null or v.min_price >= p_min_paise)
      and (p_max_paise is null or v.min_price <= p_max_paise)
      and (p_stock is null
           or (p_stock = 'in' and coalesce(v.stock, 0) > 0)
           or (p_stock = 'out' and coalesce(v.stock, 0) = 0)
           or (p_stock = 'low' and coalesce(v.low, 0) > 0))
      and (p_images is null
           or (p_images = 'with' and exists (select 1 from product_images i where i.product_id = p.id))
           or (p_images = 'without' and not exists (select 1 from product_images i where i.product_id = p.id)))
  )
  select case when p_ids_only then
    jsonb_build_object('total', (select count(*) from base),
                       'ids', coalesce((select jsonb_agg(id) from (select id from base order by created_at desc limit 5000) x), '[]'::jsonb))
  else jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select jsonb_agg(to_jsonb(r) - 'created_at') from (
        select * from base order by
          case when p_sort = 'name' then name end asc,
          case when p_sort = 'price_asc' then min_price end asc,
          case when p_sort = 'price_desc' then min_price end desc,
          case when p_sort = 'stock_asc' then stock end asc,
          case when p_sort = 'stock_desc' then stock end desc,
          case when p_sort = 'oldest' then created_at end asc,
          created_at desc, id
        limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)) r), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(b order by b) from (select distinct brand b from products where brand is not null) x), '[]'::jsonb)
  ) end into v_result;
  return v_result;
end $$;

-- =========================================================================
-- 3. Bulk edit
-- p_changes keys (all optional):
--   is_active bool, is_featured bool, category_id uuid, brand text ('' clears),
--   installment 'inherit' | 'yes' | 'no', add_tags text[], remove_tags text[],
--   price {mode: set|percent|amount, value: number}   (percent: +10 = 10% up; amount in AED, may be negative)
--   mrp {mode: set|clear|markup, value: number}        (markup: was-price = price + value %)
--   cost {mode: set|clear, value: number}              (AED, staff only)
--   stock {mode: set|add, value: int}
--   low_stock_threshold int
-- =========================================================================
create or replace function public.admin_bulk_update_products(p_ids uuid[], p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  c jsonb := coalesce(p_changes, '{}'::jsonb);
  v_products int := 0; v_variants int := 0; n int;
  v_mode text; v_val numeric; r record;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Select at least one product'; end if;
  if cardinality(p_ids) > 5000 then raise exception 'Edit at most 5,000 products at a time'; end if;

  -- product fields
  if c ? 'is_active' then update products set is_active = (c->>'is_active')::boolean where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n); end if;
  if c ? 'is_featured' then update products set is_featured = (c->>'is_featured')::boolean where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n); end if;
  if c ? 'category_id' then
    if not exists (select 1 from categories where id = (c->>'category_id')::uuid) then raise exception 'Unknown category'; end if;
    update products set category_id = (c->>'category_id')::uuid where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n);
  end if;
  if c ? 'brand' then update products set brand = nullif(trim(c->>'brand'), '') where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n); end if;
  if c ? 'installment' then
    if c->>'installment' not in ('inherit', 'yes', 'no') then raise exception 'installment must be inherit, yes or no'; end if;
    update products set installment_eligible = case c->>'installment' when 'yes' then true when 'no' then false else null end where id = any(p_ids);
    get diagnostics n = row_count; v_products := greatest(v_products, n);
  end if;
  if jsonb_typeof(c->'add_tags') = 'array' and jsonb_array_length(c->'add_tags') > 0 then
    update products p set tags = (select array_agg(distinct t order by t) from unnest(p.tags || array(
        select lower(trim(x)) from jsonb_array_elements_text(c->'add_tags') x where trim(x) <> '')) t)
    where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n);
  end if;
  if jsonb_typeof(c->'remove_tags') = 'array' and jsonb_array_length(c->'remove_tags') > 0 then
    update products p set tags = coalesce(array(select t from unnest(p.tags) t
        where t <> all(array(select lower(trim(x)) from jsonb_array_elements_text(c->'remove_tags') x))), '{}')
    where id = any(p_ids); get diagnostics n = row_count; v_products := greatest(v_products, n);
  end if;

  -- prices (every variant of the selected products)
  if jsonb_typeof(c->'price') = 'object' then
    v_mode := c->'price'->>'mode'; v_val := (c->'price'->>'value')::numeric;
    if v_mode is null or v_mode not in ('set', 'percent', 'amount') then raise exception 'price mode must be set, percent or amount'; end if;
    if v_val is null then raise exception 'Enter a price value'; end if;
    if v_mode = 'set' and v_val <= 0 then raise exception 'Price must be more than 0'; end if;
    if v_mode = 'percent' and v_val <= -100 then raise exception 'Percent must be above -100'; end if;
    -- drop a was-price that would end up below the new price (the table does not allow it)
    update product_variants set
      price_paise = greatest(1, case v_mode
        when 'set' then round(v_val * 100)
        when 'percent' then round(price_paise * (1 + v_val / 100))
        when 'amount' then price_paise + round(v_val * 100)
        else null end)::bigint,
      mrp_paise = case when mrp_paise is not null and mrp_paise < greatest(1, case v_mode
        when 'set' then round(v_val * 100)
        when 'percent' then round(price_paise * (1 + v_val / 100))
        when 'amount' then price_paise + round(v_val * 100) end) then null else mrp_paise end
    where product_id = any(p_ids);
    get diagnostics n = row_count; v_variants := greatest(v_variants, n);
  end if;

  if jsonb_typeof(c->'mrp') = 'object' then
    v_mode := c->'mrp'->>'mode'; v_val := (c->'mrp'->>'value')::numeric;
    if v_mode = 'clear' then
      update product_variants set mrp_paise = null where product_id = any(p_ids);
    elsif v_mode = 'set' then
      if v_val is null or v_val <= 0 then raise exception 'Enter the was-price in AED'; end if;
      update product_variants set mrp_paise = case when round(v_val * 100) >= price_paise then round(v_val * 100)::bigint else null end where product_id = any(p_ids);
    elsif v_mode = 'markup' then
      if v_val is null or v_val <= 0 then raise exception 'Markup must be more than 0%%'; end if;
      update product_variants set mrp_paise = round(price_paise * (1 + v_val / 100))::bigint where product_id = any(p_ids);
    else raise exception 'mrp mode must be set, clear or markup'; end if;
    get diagnostics n = row_count; v_variants := greatest(v_variants, n);
  end if;

  if jsonb_typeof(c->'cost') = 'object' then
    v_mode := c->'cost'->>'mode'; v_val := (c->'cost'->>'value')::numeric;
    if v_mode = 'clear' then
      delete from variant_costs where variant_id in (select id from product_variants where product_id = any(p_ids));
    elsif v_mode = 'set' then
      if v_val is null or v_val < 0 then raise exception 'Enter the cost in AED'; end if;
      insert into variant_costs (variant_id, cost_paise, updated_by)
      select id, round(v_val * 100)::bigint, auth.uid() from product_variants where product_id = any(p_ids)
      on conflict (variant_id) do update set cost_paise = excluded.cost_paise, updated_by = excluded.updated_by, updated_at = now();
    else raise exception 'cost mode must be set or clear'; end if;
    get diagnostics n = row_count; v_variants := greatest(v_variants, n);
  end if;

  if c ? 'low_stock_threshold' then
    if (c->>'low_stock_threshold')::int < 0 then raise exception 'Low-stock level cannot be negative'; end if;
    update product_variants set low_stock_threshold = (c->>'low_stock_threshold')::int where product_id = any(p_ids);
    get diagnostics n = row_count; v_variants := greatest(v_variants, n);
  end if;

  if jsonb_typeof(c->'stock') = 'object' then
    v_mode := c->'stock'->>'mode'; v_val := (c->'stock'->>'value')::int;
    if v_val is null then raise exception 'Enter a stock number'; end if;
    if v_mode not in ('set', 'add') then raise exception 'stock mode must be set or add'; end if;
    if v_mode = 'set' and v_val < 0 then raise exception 'Stock cannot be negative'; end if;
    n := 0;
    for r in select id, stock from product_variants where product_id = any(p_ids) for update loop
      declare d int := case when v_mode = 'set' then v_val::int - r.stock else greatest(v_val::int, -r.stock) end;
      begin
        if d <> 0 then
          update product_variants set stock = stock + d where id = r.id;
          insert into inventory_movements (variant_id, delta, reason, actor_id, note)
          values (r.id, d, case when d > 0 then 'restock' else 'adjustment' end, auth.uid(), 'Bulk edit');
        end if;
        n := n + 1;
      end;
    end loop;
    v_variants := greatest(v_variants, n);
  end if;

  insert into audit_log (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'bulk_update_products', 'products', null,
          jsonb_build_object('count', cardinality(p_ids), 'changes', c));
  return jsonb_build_object('products', greatest(v_products, (select count(*) from products where id = any(p_ids))), 'variants', v_variants);
end $$;

-- =========================================================================
-- 4. Glass dashboard data
-- =========================================================================
-- Orders that count as a sale: paid or past payment, not cancelled.
create or replace function public._is_sale(s public.order_status) returns boolean language sql immutable as $$
  select s not in ('order_placed', 'payment_pending', 'cancelled')
$$;

create or replace function public.admin_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 366);
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_from timestamptz := (v_today - (v_days - 1))::timestamp at time zone 'Asia/Dubai';
  v_prev timestamptz := (v_today - (2 * v_days - 1))::timestamp at time zone 'Asia/Dubai';
  v_month timestamptz := date_trunc('month', v_today)::timestamp at time zone 'Asia/Dubai';
begin
  if not has_any_role(array['operations', 'support', 'collections']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'days', v_days,
    'revenue_paise', (select coalesce(sum(total_paise), 0) from orders where _is_sale(status) and created_at >= v_from),
    'prev_revenue_paise', (select coalesce(sum(total_paise), 0) from orders where _is_sale(status) and created_at >= v_prev and created_at < v_from),
    'orders', (select count(*) from orders where _is_sale(status) and created_at >= v_from),
    'prev_orders', (select count(*) from orders where _is_sale(status) and created_at >= v_prev and created_at < v_from),
    'new_customers', (select count(*) from profiles where created_at >= v_from),
    'prev_new_customers', (select count(*) from profiles where created_at >= v_prev and created_at < v_from),
    'refunds_paise', (select coalesce(sum(amount_paise), 0) from refunds where status = 'succeeded' and created_at >= v_from),
    'prev_refunds_paise', (select coalesce(sum(amount_paise), 0) from refunds where status = 'succeeded' and created_at >= v_prev and created_at < v_from),
    'month_revenue_paise', (select coalesce(sum(total_paise), 0) from orders where _is_sale(status) and created_at >= v_month),
    'monthly_target_paise', coalesce((select (value->>'monthly_target_paise')::bigint from site_settings where key = 'dashboard'), 0),
    'split', jsonb_build_object(
      'full', (select coalesce(sum(total_paise), 0) from orders where _is_sale(status) and created_at >= v_from and payment_mode = 'full'),
      'installment', (select coalesce(sum(total_paise), 0) from orders where _is_sale(status) and created_at >= v_from and payment_mode = 'installment')),
    'awaiting_approval', (select count(*) from orders where status = 'awaiting_approval'),
    'delayed', (select count(*) from orders where is_delayed),
    'low_stock', (select count(*) from product_variants where is_active and stock <= low_stock_threshold),
    'late_payments_needing_refund', (select count(*) from audit_log a where action = 'late_payment_needs_refund'
        and not exists (select 1 from refunds r where r.order_id = a.entity_id::uuid)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'sales_paise', coalesce(x.sales, 0), 'cost_paise', coalesce(x.cost, 0), 'orders', coalesce(x.n, 0)) order by d), '[]'::jsonb)
      from generate_series(v_today - (v_days - 1), v_today, interval '1 day') d
      left join (
        select (o.created_at at time zone 'Asia/Dubai')::date as day, sum(i.line_total_paise) sales,
               sum(i.quantity * coalesce(vc.cost_paise, 0)) cost, count(distinct o.id) n
        from orders o join order_items i on i.order_id = o.id left join variant_costs vc on vc.variant_id = i.variant_id
        where _is_sale(o.status) and o.created_at >= v_from group by 1) x on x.day = d::date)
  );
end $$;

create or replace function public.admin_stock_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_today date := (now() at time zone 'Asia/Dubai')::date;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'stock_value_paise', (select coalesce(sum(price_paise * stock), 0) from product_variants where is_active),
    'stock_cost_paise', (select coalesce(sum(vc.cost_paise * v.stock), 0) from product_variants v join variant_costs vc on vc.variant_id = v.id where v.is_active),
    'units', (select coalesce(sum(stock), 0) from product_variants where is_active),
    'variants', (select count(*) from product_variants where is_active),
    'out_of_stock', (select count(*) from product_variants where is_active and stock = 0),
    'low_stock', (select count(*) from product_variants where is_active and stock > 0 and stock <= low_stock_threshold),
    'week', (select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'units', coalesce(x.units, 0)) order by d), '[]'::jsonb)
      from generate_series(v_today - 6, v_today, interval '1 day') d
      left join (select (o.created_at at time zone 'Asia/Dubai')::date as day, sum(i.quantity) as units
                 from orders o join order_items i on i.order_id = o.id
                 where _is_sale(o.status) and o.created_at >= (v_today - 6)::timestamp at time zone 'Asia/Dubai' group by 1) x on x.day = d::date),
    'categories', (select coalesce(jsonb_agg(c order by c->>'name'), '[]'::jsonb) from (
      select jsonb_build_object('id', top.id, 'name', top.name, 'slug', top.slug,
        'products', count(distinct p.id), 'variants', count(v.id),
        'in_stock', count(v.id) filter (where v.stock > 0),
        'low', count(v.id) filter (where v.stock <= v.low_stock_threshold),
        'units', coalesce(sum(v.stock), 0)) c
      from categories top
      left join categories sub on sub.id = top.id or sub.parent_id = top.id
      left join products p on p.category_id = sub.id
      left join product_variants v on v.product_id = p.id and v.is_active
      where top.parent_id is null
      group by top.id, top.name, top.slug) t)
  );
end $$;

create or replace function public.admin_top_customers(p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not has_any_role(array['operations', 'support']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'total_customers', (select count(*) from profiles p where not exists (select 1 from staff_roles s where s.user_id = p.id)),
    'with_orders', (select count(distinct user_id) from orders where _is_sale(status)),
    'rows', coalesce((select jsonb_agg(t) from (
      select p.id, p.full_name, p.phone, p.created_at as joined_at,
             count(o.id) as orders, coalesce(sum(o.total_paise), 0) as spent_paise, max(o.created_at) as last_order_at
      from profiles p join orders o on o.user_id = p.id and _is_sale(o.status)
      group by p.id order by spent_paise desc limit least(greatest(p_limit, 1), 100)) t), '[]'::jsonb)
  );
end $$;

create or replace function public.admin_reports(p_period text default 'month')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_unit text := case p_period when 'week' then 'day' when 'year' then 'month' else 'day' end;
  v_start date := case p_period when 'week' then v_today - 6 when 'year' then (date_trunc('month', v_today) - interval '11 months')::date else v_today - 29 end;
  v_from timestamptz := v_start::timestamp at time zone 'Asia/Dubai';
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'period', coalesce(p_period, 'month'),
    'series', (select coalesce(jsonb_agg(jsonb_build_object('bucket', b::date, 'revenue_paise', coalesce(x.rev, 0), 'cost_paise', coalesce(x.cost, 0), 'refunds_paise', coalesce(rf.amt, 0)) order by b), '[]'::jsonb)
      from generate_series(v_start, v_today, ('1 ' || v_unit)::interval) b
      left join (select date_trunc(v_unit, o.created_at at time zone 'Asia/Dubai')::date as k, sum(i.line_total_paise) rev, sum(i.quantity * coalesce(vc.cost_paise, 0)) cost
                 from orders o join order_items i on i.order_id = o.id left join variant_costs vc on vc.variant_id = i.variant_id
                 where _is_sale(o.status) and o.created_at >= v_from group by 1) x on x.k = b::date
      left join (select date_trunc(v_unit, created_at at time zone 'Asia/Dubai')::date as k, sum(amount_paise) amt
                 from refunds where status = 'succeeded' and created_at >= v_from group by 1) rf on rf.k = b::date),
    'delivery_fees_paise', (select coalesce(sum(delivery_fee_paise), 0) from orders where _is_sale(status) and created_at >= v_from),
    'discounts_paise', (select coalesce(sum(discount_paise), 0) from orders where _is_sale(status) and created_at >= v_from),
    'costed_share', (select case when count(*) = 0 then null else round(100.0 * count(vc.variant_id) / count(*)) end
                     from orders o join order_items i on i.order_id = o.id left join variant_costs vc on vc.variant_id = i.variant_id
                     where _is_sale(o.status) and o.created_at >= v_from),
    'by_category', (select coalesce(jsonb_agg(t order by (t->>'revenue_paise')::bigint desc), '[]'::jsonb) from (
      select jsonb_build_object('name', coalesce(top.name, c.name), 'revenue_paise', sum(i.line_total_paise), 'units', sum(i.quantity)) t
      from orders o join order_items i on i.order_id = o.id join products p on p.id = i.product_id
      join categories c on c.id = p.category_id left join categories top on top.id = c.parent_id
      where _is_sale(o.status) and o.created_at >= v_from
      group by coalesce(top.name, c.name)) s)
  );
end $$;

-- =========================================================================
-- 5. Delivery fleet
-- =========================================================================
create table if not exists public.rider_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vehicle_type text not null default 'bike' check (vehicle_type in ('bike', 'car', 'van')),
  plate text check (char_length(plate) <= 20),
  status text not null default 'offline' check (status in ('available', 'on_route', 'maintenance', 'offline')),
  updated_at timestamptz not null default now()
);
create table if not exists public.rider_locations (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy_m real,
  recorded_at timestamptz not null default now()
);
create index if not exists rider_locations_rider_idx on public.rider_locations(rider_id, recorded_at desc);
alter table public.rider_profiles enable row level security;
alter table public.rider_locations enable row level security;
drop policy if exists rider_profiles_read on public.rider_profiles;
create policy rider_profiles_read on public.rider_profiles for select using (user_id = auth.uid() or public.has_any_role(array['operations']));
drop policy if exists rider_locations_read on public.rider_locations;
create policy rider_locations_read on public.rider_locations for select using (rider_id = auth.uid() or public.has_any_role(array['operations']));
revoke insert, update, delete on public.rider_profiles, public.rider_locations from anon, authenticated;

-- Rider app: send my GPS position (every 10-15 s while sharing is on)
create or replace function public.rider_ping(p_lat double precision, p_lng double precision, p_accuracy real default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  if not exists (select 1 from staff_roles where user_id = auth.uid() and role = 'delivery') then raise exception 'Not allowed' using errcode = '42501'; end if;
  select max(recorded_at) into v_last from rider_locations where rider_id = auth.uid();
  if v_last is not null and v_last > now() - interval '8 seconds' then return; end if;  -- flood guard
  insert into rider_locations (rider_id, lat, lng, accuracy_m) values (auth.uid(), p_lat, p_lng, p_accuracy);
  insert into rider_profiles (user_id, status) values (auth.uid(), 'available')
  on conflict (user_id) do update set status = case when rider_profiles.status = 'offline' then 'available' else rider_profiles.status end, updated_at = now();
  delete from rider_locations where rider_id = auth.uid() and recorded_at < now() - interval '3 days';
end $$;

create or replace function public.rider_set_status(p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from staff_roles where user_id = auth.uid() and role = 'delivery') then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_status not in ('available', 'on_route', 'maintenance', 'offline') then raise exception 'Unknown status'; end if;
  insert into rider_profiles (user_id, status) values (auth.uid(), p_status)
  on conflict (user_id) do update set status = excluded.status, updated_at = now();
end $$;

create or replace function public.admin_update_rider(p_rider uuid, p_vehicle text default null, p_plate text default null, p_status text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if not exists (select 1 from staff_roles where user_id = p_rider and role = 'delivery') then raise exception 'That person is not delivery staff'; end if;
  insert into rider_profiles (user_id, vehicle_type, plate, status)
  values (p_rider, coalesce(p_vehicle, 'bike'), nullif(trim(coalesce(p_plate, '')), ''), coalesce(p_status, 'offline'))
  on conflict (user_id) do update set
    vehicle_type = coalesce(p_vehicle, rider_profiles.vehicle_type),
    plate = case when p_plate is null then rider_profiles.plate else nullif(trim(p_plate), '') end,
    status = coalesce(p_status, rider_profiles.status), updated_at = now();
end $$;

create or replace function public.admin_fleet()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_today timestamptz := ((now() at time zone 'Asia/Dubai')::date)::timestamp at time zone 'Asia/Dubai';
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'warehouse', (select value from site_settings where key = 'dashboard'),
    'riders', coalesce((select jsonb_agg(r order by r->>'name') from (
      select jsonb_build_object(
        'id', p.id, 'name', coalesce(p.full_name, 'Rider'), 'phone', p.phone,
        'vehicle_type', coalesce(rp.vehicle_type, 'bike'), 'plate', rp.plate, 'status', coalesce(rp.status, 'offline'),
        'lat', loc.lat, 'lng', loc.lng, 'seen_at', loc.recorded_at,
        'active', (select count(*) from delivery_assignments a join orders o on o.id = a.order_id
                   where a.staff_id = p.id and a.is_active and o.status not in ('delivered', 'cancelled', 'refunded', 'returned')),
        'drops_today', (select count(*) from proof_of_delivery d where d.staff_id = p.id and d.created_at >= v_today),
        'delayed', exists (select 1 from delivery_assignments a join orders o on o.id = a.order_id
                   where a.staff_id = p.id and a.is_active and o.is_delayed and o.status not in ('delivered', 'cancelled', 'refunded', 'returned')),
        'current', (select jsonb_build_object('order_id', o.id, 'order_number', o.order_number, 'status', o.status, 'pincode', o.pincode,
                                               'eta', o.estimated_max_date, 'is_delayed', o.is_delayed)
                    from delivery_assignments a join orders o on o.id = a.order_id
                    where a.staff_id = p.id and a.is_active and o.status not in ('delivered', 'cancelled', 'refunded', 'returned')
                    order by (o.status = 'out_for_delivery') desc, a.created_at limit 1)) r
      from staff_roles s join profiles p on p.id = s.user_id
      left join rider_profiles rp on rp.user_id = p.id
      left join lateral (select lat, lng, recorded_at from rider_locations l where l.rider_id = p.id order by recorded_at desc limit 1) loc on true
      where s.role = 'delivery') x), '[]'::jsonb),
    'pipeline', jsonb_build_object(
      'placed', (select count(*) from orders where status in ('payment_confirmed', 'awaiting_approval', 'order_confirmed', 'processing')),
      'packed', (select count(*) from orders where status = 'packed'),
      'dispatched', (select count(*) from orders where status in ('dispatched', 'in_transit')),
      'out_for_delivery', (select count(*) from orders where status = 'out_for_delivery'),
      'delivered_today', (select count(*) from orders where status = 'delivered' and delivered_at >= v_today)),
    'delivered_today', (select count(*) from orders where status = 'delivered' and delivered_at >= v_today),
    'on_time_today', (select count(*) from orders where status = 'delivered' and delivered_at >= v_today
                      and (estimated_max_date is null or (delivered_at at time zone 'Asia/Dubai')::date <= estimated_max_date)),
    'delayed', (select count(*) from orders where is_delayed and status not in ('delivered', 'cancelled', 'refunded', 'returned')),
    'avg_delivery_minutes', (select round(avg(extract(epoch from (o.delivered_at - e.created_at)) / 60))
                             from orders o join lateral (select created_at from order_status_events ev where ev.order_id = o.id and ev.status = 'out_for_delivery' order by created_at desc limit 1) e on true
                             where o.status = 'delivered' and o.delivered_at >= now() - interval '7 days'),
    'unassigned', (select count(*) from orders o where o.status in ('order_confirmed', 'processing', 'packed')
                   and not exists (select 1 from delivery_assignments a where a.order_id = o.id and a.is_active))
  );
end $$;

-- Picks the available rider with the fewest open deliveries and gives them the oldest packed (or confirmed) order.
create or replace function public.admin_auto_assign()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order orders; v_rider uuid;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select o.* into v_order from orders o
  where o.status in ('packed', 'processing', 'order_confirmed')
    and not exists (select 1 from delivery_assignments a where a.order_id = o.id and a.is_active)
  order by (o.status = 'packed') desc, o.created_at limit 1 for update skip locked;
  if v_order.id is null then raise exception 'No packed or confirmed orders are waiting for a rider'; end if;
  select s.user_id into v_rider from staff_roles s left join rider_profiles rp on rp.user_id = s.user_id
  where s.role = 'delivery' and coalesce(rp.status, 'offline') = 'available'
  order by (select count(*) from delivery_assignments a join orders o on o.id = a.order_id
            where a.staff_id = s.user_id and a.is_active and o.status not in ('delivered', 'cancelled', 'refunded', 'returned')), s.granted_at
  limit 1;
  if v_rider is null then raise exception 'No rider is available. Ask a rider to open My deliveries and share location, or set one to Available.'; end if;
  perform assign_delivery(v_order.id, v_rider, null);
  if v_order.status = 'packed' then
    perform transition_order(v_order.id, 'dispatched', 'Handed to delivery partner', true);
  end if;
  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'rider_id', v_rider,
                            'rider_name', (select full_name from profiles where id = v_rider));
end $$;

-- =========================================================================
-- 6. Storefront search: on-sale, rating and sub-category filters, category facet
-- =========================================================================
drop function if exists public.search_products(text, text, text[], bigint, bigint, boolean, text, boolean, text, int, int, uuid[]);
create or replace function public.search_products(
  p_category text default null,       -- category slug; includes its sub-categories
  p_query text default null,
  p_brands text[] default null,
  p_min_paise bigint default null,
  p_max_paise bigint default null,
  p_in_stock boolean default false,
  p_tag text default null,
  p_featured boolean default false,
  p_sort text default 'relevance',    -- relevance | newest | price_asc | price_desc | rating | discount
  p_limit int default 24,
  p_offset int default 0,
  p_ids uuid[] default null,          -- restrict to these products (wishlist, recently viewed)
  p_on_sale boolean default false,    -- only products with a was-price above the price
  p_min_rating numeric default null,  -- e.g. 4 = 4 stars and up
  p_subcategories text[] default null -- narrow to these category slugs (from the category facet)
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_tsq tsquery;
  v_result jsonb;
begin
  if nullif(trim(coalesce(p_query, '')), '') is not null then
    -- prefix match on every word: "sams gal" finds "Samsung Galaxy"
    select to_tsquery('simple', string_agg(quote_literal(w) || ':*', ' & '))
    into v_tsq
    from unnest(regexp_split_to_array(lower(trim(regexp_replace(p_query, '[^[:alnum:][:space:]]', ' ', 'g'))), '\s+')) w
    where w <> '';
  end if;

  with cat as (
    select id from categories where slug = p_category
    union select c.id from categories c join categories parent on parent.id = c.parent_id where parent.slug = p_category
  ),
  base as (
    select p.id, p.slug, p.name, p.brand, p.rating_avg, p.rating_count, p.is_featured, p.tags, p.created_at,
           c.slug as category_slug, c.name as category_name,
           coalesce(p.installment_eligible, c.installment_eligible) as installment_eligible,
           v.min_price, v.max_mrp, v.in_stock, v.variant_count, v.first_variant_id, v.first_variant_name,
           (select url from product_images i where i.product_id = p.id order by sort_order limit 1) as image_url,
           case when v_tsq is null then 0 else ts_rank(p.search, v_tsq) end as rank
    from products p
    join categories c on c.id = p.category_id and c.is_active
    join lateral (
      select min(price_paise) as min_price,
             max(mrp_paise) filter (where mrp_paise is not null) as max_mrp,
             bool_or(stock > 0) as in_stock,
             count(*) as variant_count,
             (array_agg(id order by sort_order, price_paise))[1] as first_variant_id,
             (array_agg(name order by sort_order, price_paise))[1] as first_variant_name
      from product_variants where product_id = p.id and is_active
    ) v on v.variant_count > 0
    where p.is_active
      and (p_category is null or p.category_id in (select id from cat))
      and (v_tsq is null or p.search @@ v_tsq)
      and (p_brands is null or cardinality(p_brands) = 0 or p.brand = any(p_brands))
      and (p_min_paise is null or v.min_price >= p_min_paise)
      and (p_max_paise is null or v.min_price <= p_max_paise)
      and (not p_in_stock or v.in_stock)
      and (p_tag is null or p_tag = any(p.tags))
      and (not p_featured or p.is_featured)
      and (p_ids is null or p.id = any(p_ids))
      and (not coalesce(p_on_sale, false) or (v.max_mrp is not null and v.max_mrp > v.min_price))
      and (p_min_rating is null or p.rating_avg >= p_min_rating)
      and (p_subcategories is null or cardinality(p_subcategories) = 0 or c.slug = any(p_subcategories))
  ),
  facets as (
    select jsonb_build_object(
      'total', (select count(*) from base),
      'brands', coalesce((select jsonb_agg(jsonb_build_object('brand', brand, 'count', n) order by n desc, brand)
                          from (select brand, count(*) n from base where brand is not null group by brand) b), '[]'::jsonb),
      'categories', coalesce((select jsonb_agg(jsonb_build_object('slug', category_slug, 'name', category_name, 'count', n) order by n desc, category_name)
                          from (select category_slug, category_name, count(*) n from base group by 1, 2) cs), '[]'::jsonb),
      'on_sale', (select count(*) from base where max_mrp is not null and max_mrp > min_price),
      'price_min', (select min(min_price) from base),
      'price_max', (select max(min_price) from base)
    ) as f
  ),
  page as (
    select * from base
    order by
      case when p_sort = 'price_asc' then min_price end asc,
      case when p_sort = 'price_desc' then min_price end desc,
      case when p_sort = 'rating' then rating_avg end desc,
      case when p_sort = 'discount' then coalesce((max_mrp - min_price)::numeric / nullif(max_mrp, 0), 0) end desc,
      case when p_sort = 'newest' then created_at end desc,
      case when p_sort = 'relevance' then rank end desc,
      is_featured desc, created_at desc
    limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'items', coalesce((select jsonb_agg(to_jsonb(page) - 'rank' - 'created_at') from page), '[]'::jsonb),
    'facets', (select f from facets)
  ) into v_result;
  return v_result;
end $$;
grant execute on function public.search_products(text, text, text[], bigint, bigint, boolean, text, boolean, text, int, int, uuid[], boolean, numeric, text[]) to anon, authenticated;

-- =========================================================================
-- 7. Execute rights: signed-in staff only (each function checks the role itself)
-- =========================================================================
do $$ declare f record; begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'admin_list_products', 'admin_bulk_update_products', 'admin_overview', 'admin_stock_overview',
      'admin_top_customers', 'admin_reports', 'rider_ping', 'rider_set_status', 'admin_update_rider',
      'admin_fleet', 'admin_auto_assign'])
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
revoke execute on function public._is_sale(public.order_status) from anon;
