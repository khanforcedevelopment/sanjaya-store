-- Catalogue administration: bulk import and demo-data removal.

-- Removes every product tagged 'demo'. Products that appear in orders are hidden instead of deleted.
create or replace function public.remove_demo_products()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_deleted int; v_hidden int;
begin
  if not (has_role('super_admin') or is_service_role()) then raise exception 'Only the Super Admin can do this' using errcode = '42501'; end if;
  update products set is_active = false
  where 'demo' = any(tags) and exists (select 1 from order_items i where i.product_id = products.id);
  get diagnostics v_hidden = row_count;
  delete from products
  where 'demo' = any(tags) and not exists (select 1 from order_items i where i.product_id = products.id);
  get diagnostics v_deleted = row_count;
  insert into audit_log(actor_id, action, entity, details)
  values (auth.uid(), 'remove_demo_products', 'products', jsonb_build_object('deleted', v_deleted, 'hidden', v_hidden));
  return jsonb_build_object('deleted', v_deleted, 'hidden', v_hidden);
end $$;

-- Bulk import / update from a spreadsheet. One element per variant row:
-- {product_slug, product_name, brand, category_slug, short_description, description, tags, is_active,
--  sku, variant_name, options, price_rupees, mrp_rupees, stock, image_urls}
-- Rows with the same product_slug become one product with several variants. Existing SKUs are updated.
create or replace function public.import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; v_idx int := 0; v_errors jsonb := '[]'::jsonb; v_cat uuid; v_product uuid;
  v_new_products int := 0; v_updated_variants int := 0; v_new_variants int := 0; v_existing uuid;
  v_price bigint; v_mrp bigint; v_url text; v_i int;
begin
  if not has_any_role(array['operations']) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Expected a list of rows'; end if;
  if jsonb_array_length(p_rows) > 5000 then raise exception 'Import at most 5,000 rows at a time'; end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    v_idx := v_idx + 1;
    begin
      if coalesce(r->>'product_slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'product_slug must be lowercase words joined by hyphens'; end if;
      if coalesce(trim(r->>'sku'), '') = '' then raise exception 'sku is required'; end if;
      v_price := round((r->>'price_rupees')::numeric * 100);
      if v_price is null or v_price <= 0 then raise exception 'price_rupees must be more than 0'; end if;
      v_mrp := case when nullif(r->>'mrp_rupees', '') is null then null else round((r->>'mrp_rupees')::numeric * 100) end;
      if v_mrp is not null and v_mrp < v_price then raise exception 'mrp_rupees cannot be lower than price_rupees'; end if;
      if coalesce((r->>'stock')::int, 0) < 0 then raise exception 'stock cannot be negative'; end if;

      select id into v_cat from categories where slug = r->>'category_slug';
      if v_cat is null then raise exception 'Unknown category_slug "%"', r->>'category_slug'; end if;

      select id into v_product from products where slug = r->>'product_slug';
      if v_product is null then
        if coalesce(trim(r->>'product_name'), '') = '' then raise exception 'product_name is required for a new product'; end if;
        insert into products (slug, name, brand, category_id, short_description, description, tags, is_active)
        values (r->>'product_slug', trim(r->>'product_name'), nullif(trim(coalesce(r->>'brand', '')), ''), v_cat,
                nullif(r->>'short_description', ''), nullif(r->>'description', ''),
                coalesce((select array_agg(trim(t)) from unnest(string_to_array(coalesce(r->>'tags', ''), ',')) t where trim(t) <> ''), '{}'),
                coalesce((r->>'is_active')::boolean, true))
        returning id into v_product;
        v_new_products := v_new_products + 1;
        v_i := 0;
        for v_url in select trim(u) from unnest(string_to_array(coalesce(r->>'image_urls', ''), '|')) u where trim(u) ~ '^(https://|/)' loop
          insert into product_images (product_id, url, alt, sort_order) values (v_product, v_url, trim(r->>'product_name'), v_i);
          v_i := v_i + 1;
        end loop;
      end if;

      select id into v_existing from product_variants where sku = trim(r->>'sku');
      if v_existing is not null then
        update product_variants set price_paise = v_price, mrp_paise = v_mrp,
          name = coalesce(nullif(trim(r->>'variant_name'), ''), name),
          options = coalesce(r->'options', options)
        where id = v_existing;
        v_updated_variants := v_updated_variants + 1;
      else
        insert into product_variants (product_id, sku, name, options, price_paise, mrp_paise, stock)
        values (v_product, trim(r->>'sku'), coalesce(nullif(trim(r->>'variant_name'), ''), 'Default'),
                coalesce(r->'options', '{}'::jsonb), v_price, v_mrp, coalesce((r->>'stock')::int, 0));
        v_new_variants := v_new_variants + 1;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', sqlerrm);
    end;
  end loop;

  if p_dry_run or jsonb_array_length(v_errors) > 0 then
    -- undo everything: a failed or test import changes nothing
    raise exception using errcode = 'P0001', message = 'IMPORT_PREVIEW', detail = jsonb_build_object(
      'dry_run', p_dry_run, 'errors', v_errors, 'new_products', v_new_products,
      'new_variants', v_new_variants, 'updated_variants', v_updated_variants)::text;
  end if;
  insert into audit_log(actor_id, action, entity, details) values (auth.uid(), 'import_products', 'products',
    jsonb_build_object('new_products', v_new_products, 'new_variants', v_new_variants, 'updated_variants', v_updated_variants));
  return jsonb_build_object('dry_run', false, 'errors', '[]'::jsonb, 'new_products', v_new_products,
    'new_variants', v_new_variants, 'updated_variants', v_updated_variants);
end $$;

-- Wrapper that turns the preview "exception" into a normal result for the admin screen.
create or replace function public.preview_or_import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return import_products(p_rows, p_dry_run);
exception when sqlstate 'P0001' then
  if sqlerrm = 'IMPORT_PREVIEW' then
    declare v_detail text; begin
      get stacked diagnostics v_detail = pg_exception_detail;
      return v_detail::jsonb;
    end;
  end if;
  raise;
end $$;
