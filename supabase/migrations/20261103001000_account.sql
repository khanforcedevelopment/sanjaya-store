-- Phase 5: customer account helpers.

-- search_products gains p_ids so the wishlist page can reuse the card data.
drop function if exists public.search_products(text, text, text[], bigint, bigint, boolean, text, boolean, text, int, int);
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
  p_ids uuid[] default null           -- restrict to these products (wishlist, recently viewed)
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
  ),
  facets as (
    select jsonb_build_object(
      'total', (select count(*) from base),
      'brands', coalesce((select jsonb_agg(jsonb_build_object('brand', brand, 'count', n) order by n desc, brand)
                          from (select brand, count(*) n from base where brand is not null group by brand) b), '[]'::jsonb),
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
grant execute on function public.search_products(text, text, text[], bigint, bigint, boolean, text, boolean, text, int, int, uuid[]) to anon, authenticated;

-- Makes one of my addresses the default (the partial unique index allows one default per user).
create or replace function public.set_default_address(p_address uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from addresses where id = p_address and user_id = auth.uid()) then
    raise exception 'ADDRESS_NOT_FOUND';
  end if;
  update addresses set is_default = false where user_id = auth.uid() and is_default and id <> p_address;
  update addresses set is_default = true where id = p_address;
end $$;
revoke execute on function public.set_default_address(uuid) from public, anon;
grant execute on function public.set_default_address(uuid) to authenticated;

-- A customer may keep at most 20 saved addresses; the first one becomes the default.
create or replace function public.addresses_before_insert()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if (select count(*) from addresses where user_id = new.user_id) >= 20 then
    raise exception 'ADDRESS_LIMIT';
  end if;
  if not exists (select 1 from addresses where user_id = new.user_id) then
    new.is_default := true;
  elsif new.is_default then
    update addresses set is_default = false where user_id = new.user_id and is_default;
  end if;
  return new;
end $$;
drop trigger if exists addresses_before_insert on public.addresses;
create trigger addresses_before_insert before insert on public.addresses for each row execute function public.addresses_before_insert();
