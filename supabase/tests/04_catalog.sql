-- Catalogue search, bulk import and demo removal.
\set ON_ERROR_STOP 1
set role anon; select tests.as_anon();
select tests.eq((search_products()->'facets'->>'total')::int, 3, 'search lists active products only');
select tests.eq((search_products(p_query => 'silk sar')->'items'->0->>'slug'), 'test-saree', 'prefix search matches words');
select tests.eq((search_products(p_category => 'ethnic-wear')->'facets'->>'total')::int, 1, 'parent category includes sub-categories');
select tests.eq((search_products(p_sort => 'price_asc')->'items'->0->>'slug'), 'test-saree', 'sort by price ascending');
select tests.eq((search_products(p_brands => array['Acme'])->'facets'->>'total')::int, 2, 'brand filter');
select tests.eq((search_products(p_max_paise => 500000)->'facets'->>'total')::int, 1, 'price filter');
select tests.throws($$select preview_or_import_products('[]', true)$$, 'not allowed|permission denied', 'visitors cannot import');

set role authenticated; select tests.as_user(tests.id('ops'));
select tests.eq((preview_or_import_products('[{"product_slug":"new-kurta","product_name":"New Kurta","category_slug":"men","sku":"NK-M","variant_name":"M","options":{"size":"M"},"price_aed":"999","mrp_rupees":"1299","stock":"5","image_urls":"https://example.com/a.jpg|https://example.com/b.jpg"},{"product_slug":"new-kurta","category_slug":"men","sku":"NK-L","variant_name":"L","price_aed":"999","stock":"3"}]', true)->>'new_products')::int, 1, 'dry run reports what would be created');
select tests.eq((select count(*) from products where slug = 'new-kurta')::int, 0, 'dry run changes nothing');
select tests.eq(jsonb_array_length(preview_or_import_products('[{"product_slug":"Bad Slug","category_slug":"men","sku":"X","price_rupees":"10"},{"product_slug":"ok-one","product_name":"Ok","category_slug":"nope","sku":"Y","price_rupees":"10"}]', false)->'errors'), 2, 'invalid rows are reported');
select tests.eq((select count(*) from products where slug = 'ok-one')::int, 0, 'an import with errors changes nothing');
select tests.eq((preview_or_import_products('[{"product_slug":"new-kurta","product_name":"New Kurta","category_slug":"men","sku":"NK-M","variant_name":"M","price_aed":"999","stock":"5","image_urls":"https://example.com/a.jpg|https://example.com/b.jpg"},{"product_slug":"new-kurta","category_slug":"men","sku":"NK-L","variant_name":"L","price_aed":"999","stock":"3"}]', false)->>'new_variants')::int, 2, 'import creates one product with two variants');
select tests.eq((select count(*) from product_images i join products p on p.id = i.product_id where p.slug = 'new-kurta')::int, 2, 'images imported');
select tests.eq((preview_or_import_products('[{"product_slug":"new-kurta","category_slug":"men","sku":"NK-M","price_rupees":"899"}]', false)->>'updated_variants')::int, 1, 're-import updates prices by SKU');
select tests.throws($$select remove_demo_products()$$, 'Only the Super Admin', 'operations cannot remove demo data');

reset role;
update products set tags = tags || '{demo}' where slug in ('test-saree', 'hidden-item');
set role authenticated; select tests.as_user(tests.id('admin'));
select tests.eq(remove_demo_products(), '{"hidden": 1, "deleted": 1}'::jsonb, 'demo products removed; an ordered one is hidden instead');
reset role;
