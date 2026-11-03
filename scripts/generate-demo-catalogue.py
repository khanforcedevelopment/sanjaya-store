#!/usr/bin/env python3
"""Generates supabase/demo/demo_catalogue.sql: 1000+ ORIGINAL demo products (fictional brands,
no copied content) with variants and stock, tagged 'demo' so they can be removed before launch
(Admin -> Products -> Remove demo products, or `select public.remove_demo_products();`)."""
import json, random
from pathlib import Path

random.seed(20261103)
OUT = Path(__file__).resolve().parent.parent / 'supabase' / 'demo' / 'demo_catalogue.sql'

COLOURS = ['black', 'white', 'navy', 'gold', 'crimson', 'emerald', 'rose', 'sky', 'silver', 'cognac', 'purple', 'mustard']
LABEL = {c: c.capitalize() for c in COLOURS}
LABEL.update({'crimson': 'Crimson Red', 'sky': 'Sky Blue', 'cognac': 'Cognac Brown', 'mustard': 'Mustard Yellow'})

def price(lo, hi):
    """Prices end in 99 rupees, like a real store."""
    r = random.randint(lo // 100, hi // 100) * 100 - 1
    return max(r, 99) * 100  # paise

def mrp_for(p):
    if random.random() < 0.15: return None
    up = p * random.choice([1.08, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35])
    return int(round(up / 10000) * 10000 - 100) if up > 10000 else int(up)

def pick(seq, k): return random.sample(seq, k)

SIZES_APPAREL = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
SIZES_SHOES = ['UK 5', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11']

CATS = [
  # category, count, art choices, brands, name parts, price range (₹), variant builder
  ('mobiles', 100, ['phone'], ['Aurex', 'Nova', 'Pixelon', 'Zentra', 'Lumio', 'Kairo'],
   (['Prime', 'Edge', 'Neo', 'Ultra', 'Lite', 'Pro', 'Max', 'Air', 'Fold', 'Plus'], ['5G', '5G', '4G', '5G Pro']), (7999, 129999), 'storage_colour'),
  ('laptops-tablets', 80, ['laptop', 'laptop', 'tablet'], ['Asterion', 'Orbis', 'Veltro', 'Kairo', 'Lumio'],
   (['ZenBook', 'AirLite', 'Vector', 'Creator', 'Tabula', 'Slate', 'Studio', 'Swift', 'Titan'], ['13', '14', '15', '16', '11', 'X', 'Pro']), (14999, 189999), 'ram_storage'),
  ('electronics', 120, ['earbuds', 'headphones', 'speaker', 'camera'], ['Sonique', 'Boomly', 'Lumio', 'Vistar', 'Echo Lane'],
   (['Pulse', 'Wave', 'Studio', 'Pocket', 'Boom', 'Aura', 'Bass', 'Snap', 'Vision', 'Halo'], ['Mini', 'Pro', 'Max', 'Go', 'ANC', '2', '3', 'X']), (999, 59999), 'colour'),
  ('sarees', 120, ['saree'], ['Kashi Weaves', 'Riwaaz', 'Taanbaana', 'Sutra House', 'Meera Looms'],
   (['Banarasi', 'Kanjeevaram', 'Chanderi', 'Paithani', 'Patola', 'Bandhani', 'Organza', 'Tussar', 'Georgette', 'Linen'], ['Silk Saree', 'Zari Saree', 'Handloom Saree', 'Printed Saree', 'Woven Saree']), (1299, 34999), 'colour'),
  ('kurtis', 100, ['kurti'], ['Noor', 'Rangrez', 'Aangan', 'Phulkari Co.', 'Jaipur Rang'],
   (['Chikankari', 'Block Print', 'Anarkali', 'A-Line', 'Straight', 'Kaftan', 'Angrakha', 'Mirror Work'], ['Kurti', 'Cotton Kurti', 'Rayon Kurti', 'Kurta Set']), (499, 4999), 'size_colour'),
  ('ethnic-dresses', 60, ['dress'], ['Noor', 'Riwaaz', 'Gulmohar'],
   (['Anarkali', 'Lehenga', 'Sharara', 'Gharara', 'Embroidered', 'Festive'], ['Gown', 'Set', 'Dress', 'Suit']), (1499, 24999), 'size_colour'),
  ('men', 110, ['shirt', 'kurta'], ['Regent Row', 'Oak & Thread', 'Khadi Lane', 'Northbay', 'Mehrab'],
   (['Oxford', 'Linen', 'Mandarin', 'Nehru', 'Pathani', 'Chinos', 'Polo', 'Slim Fit', 'Festive'], ['Shirt', 'Kurta', 'Jacket', 'Trousers', 'T-Shirt']), (499, 9999), 'size_colour'),
  ('women', 90, ['dress'], ['Maison Elle', 'Cielo', 'Bloom & Co.', 'Verona'],
   (['Wrap', 'Satin', 'Floral', 'Pleated', 'Bodycon', 'Shirt', 'Maxi', 'Tiered'], ['Midi Dress', 'Maxi Dress', 'Top', 'Co-ord Set', 'Dress']), (599, 7999), 'size_colour'),
  ('footwear', 100, ['shoe', 'sandal'], ['Cordwain', 'Stride', 'Mojari House', 'Trailborn', 'Bellino'],
   (['Runner', 'Oxford', 'Loafer', 'Kolhapuri', 'Mojari', 'Chelsea', 'Court', 'Trail', 'Slide'], ['Sneakers', 'Shoes', 'Sandals', 'Boots', 'Flats']), (599, 12999), 'shoe_size'),
  ('watches', 70, ['watch'], ['Chronos', 'Meridian', 'Halden', 'Pulse'],
   (['Heritage', 'Diver', 'Chrono', 'Classic', 'Field', 'Smart', 'Skeleton', 'Moonphase'], ['Automatic', 'Quartz', 'Smartwatch', 'Edition']), (1499, 89999), 'strap'),
  ('bags', 70, ['handbag', 'backpack'], ['Valentia', 'Milano Atelier', 'Wanderly', 'Zara Leathers'],
   (['Milano', 'Evening', 'Saddle', 'City', 'Weekender', 'Bucket', 'Hobo', 'Laptop'], ['Tote', 'Clutch', 'Sling Bag', 'Backpack', 'Handbag', 'Satchel']), (799, 24999), 'colour'),
  ('accessories', 70, ['sunglasses', 'jewellery', 'belt', 'perfume'], ['Solace', 'Kundan Craft', 'Hide & Co.', 'Ittar House'],
   (['Aviator', 'Kundan', 'Temple', 'Reversible', 'Oud', 'Jhumka', 'Wayfarer', 'Polki'], ['Sunglasses', 'Necklace Set', 'Earrings', 'Leather Belt', 'Eau de Parfum']), (299, 14999), 'colour'),
  ('home-lifestyle', 60, ['lamp', 'cushion', 'mug'], ['Haveli Home', 'Clay & Co.', 'Aangan Living'],
   (['Brass', 'Block Print', 'Terracotta', 'Marble', 'Jute', 'Ceramic', 'Velvet'], ['Table Lamp', 'Cushion Cover', 'Mug Set', 'Vase', 'Planter', 'Throw']), (299, 9999), 'colour'),
]

def variants_for(kind, base):
    v = []
    cols = pick(COLOURS, random.randint(1, 3))
    if kind == 'storage_colour':
        for i, st in enumerate(pick(['64 GB', '128 GB', '256 GB', '512 GB'], random.randint(1, 3))):
            for c in cols[:2]:
                v.append((f'{st} · {LABEL[c]}', {'storage': st, 'colour': LABEL[c]}, base + i * random.choice([200000, 300000, 500000]), c))
    elif kind == 'ram_storage':
        for i, cfg in enumerate(pick(['8 GB / 256 GB', '8 GB / 512 GB', '16 GB / 512 GB', '16 GB / 1 TB', '32 GB / 1 TB'], random.randint(1, 3))):
            v.append((cfg, {'configuration': cfg}, base + i * random.choice([500000, 800000, 1000000]), cols[0]))
    elif kind == 'size_colour':
        sizes = SIZES_APPAREL[random.randint(0, 1): random.randint(4, 6)]
        for c in cols[:2]:
            for s in sizes:
                v.append((f'{s} · {LABEL[c]}', {'size': s, 'colour': LABEL[c]}, base, c))
    elif kind == 'shoe_size':
        c = cols[0]
        for s in SIZES_SHOES[random.randint(0, 2): random.randint(5, 7)]:
            v.append((f'{s} · {LABEL[c]}', {'size': s, 'colour': LABEL[c]}, base, c))
    elif kind == 'strap':
        for i, strap in enumerate(pick(['Steel bracelet', 'Leather strap', 'Mesh strap', 'Silicone strap'], random.randint(1, 3))):
            v.append((f'{strap} · {LABEL[cols[0]]}', {'strap': strap, 'dial': LABEL[cols[0]]}, base + i * 50000, cols[i % len(cols)]))
    else:
        for c in cols:
            v.append((LABEL[c], {'colour': LABEL[c]}, base, c))
    return v

def q(s): return "'" + str(s).replace("'", "''") + "'"

products, images, variants = [], [], []
seen = set()
sku_n = 0
for cat, count, arts, brands, (a_parts, b_parts), (lo, hi), kind in CATS:
    for i in range(count):
        brand = random.choice(brands)
        name = f'{brand} {random.choice(a_parts)} {random.choice(b_parts)}'
        slug_base = name.lower().replace('&', 'and').replace('.', '')
        slug_base = '-'.join(''.join(ch if ch.isalnum() else ' ' for ch in slug_base).split())
        slug, k = slug_base, 2
        while slug in seen: slug, k = f'{slug_base}-{k}', k + 1
        seen.add(slug)
        art = random.choice(arts)
        base = price(lo, hi)
        vs = variants_for(kind, base)
        featured = random.random() < 0.06
        tags = ['demo'] + (['flash-sale'] if random.random() < 0.08 else []) + ([ 'new' ] if random.random() < 0.15 else [])
        specs = {'Brand': brand, 'Category': cat.replace('-', ' ').title(), 'Warranty': random.choice(['6 months', '1 year', '2 years']) if cat in ('mobiles', 'laptops-tablets', 'electronics', 'watches') else 'Easy 7-day returns', 'Note': 'Demo product for testing'}
        short = f'{random.choice(["Crafted for everyday luxury", "A Sanjaya favourite", "Premium quality, honest price", "Designed to impress", "Made to last"])}.'
        products.append(f"({q(slug)},{q(name)},{q(brand)},(select id from public.categories where slug={q(cat)}),{q(short)},{q('Demo product for testing Sanjaya Store. Replace with your real catalogue before launch.')},{str(featured).lower()},{q('{' + ','.join(tags) + '}')},{q(json.dumps(specs))}::jsonb)")
        cols = []
        for vname, opts, vprice, colour in vs:
            if colour not in cols: cols.append(colour)
        for j, c in enumerate((cols + [c for c in COLOURS if c not in cols])[:3]):
            images.append(f"((select id from public.products where slug={q(slug)}),{q(f'/demo/{art}-{c}.svg')},{q(name)},{j})")
        for j, (vname, opts, vprice, colour) in enumerate(vs):
            sku_n += 1
            stock = 0 if random.random() < 0.05 else random.randint(2, 60)
            m = mrp_for(vprice)
            variants.append(f"((select id from public.products where slug={q(slug)}),{q(f'DEMO-{sku_n:05d}')},{q(vname)},{q(json.dumps(opts))}::jsonb,{vprice},{'null' if m is None or m < vprice else m},{stock},{j})")

def chunks(rows, n=200):
    for i in range(0, len(rows), n): yield rows[i:i + n]

lines = ['-- GENERATED by scripts/generate-demo-catalogue.py. Demo data only (tag "demo").',
         '-- Remove before launch: select public.remove_demo_products();', '']
for ch in chunks(products):
    lines.append('insert into public.products (slug, name, brand, category_id, short_description, description, is_featured, tags, specs) values\n' + ',\n'.join(ch) + '\non conflict (slug) do nothing;')
for ch in chunks(images):
    lines.append('insert into public.product_images (product_id, url, alt, sort_order) values\n' + ',\n'.join(ch) + ';')
for ch in chunks(variants):
    lines.append('insert into public.product_variants (product_id, sku, name, options, price_paise, mrp_paise, stock, sort_order) values\n' + ',\n'.join(ch) + '\non conflict (sku) do nothing;')
OUT.write_text('\n\n'.join(lines) + '\n')
print(f'{len(products)} products, {len(variants)} variants, {len(images)} images -> {OUT}')
