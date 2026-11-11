import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, SearchX, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, Skeleton } from '@/components/ui/misc'
import { Sheet } from '@/components/ui/Sheet'
import { ProductCard } from '@/features/catalog/ProductCard'
import { useWishlistActions } from '@/features/catalog/ProductRail'
import { useCategories, useProducts, type ListingResult } from '@/features/catalog/api'
import { formatAED } from '@/lib/money'
import { useDocumentMeta } from '@/lib/meta'
import { cn } from '@/lib/cn'

const PAGE = 24
const SORTS: [string, string][] = [
  ['relevance', 'Recommended'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'], ['discount', 'Biggest discount'], ['rating', 'Top rated'],
]
const PRICE_BANDS: [string, number | null, number | null][] = [
  ['Under AED 50', null, 5000], ['AED 50 – 200', 5000, 20000], ['AED 200 – 1,000', 20000, 100000],
  ['AED 1,000 – 3,000', 100000, 300000], ['Over AED 3,000', 300000, null],
]

export function ListingPage({ mode }: { mode: 'category' | 'search' | 'deals' }) {
  const { slug } = useParams()
  const [sp, setSp] = useSearchParams()
  const { data: categories } = useCategories()
  const category = mode === 'category' ? categories?.find((c) => c.slug === slug) : undefined
  const parent = category?.parent_id ? categories?.find((c) => c.id === category.parent_id) : undefined
  const children = categories?.filter((c) => category && c.parent_id === category.id) ?? []

  const q = sp.get('q') ?? ''
  const sort = sp.get('sort') ?? (mode === 'deals' ? 'discount' : mode === 'search' ? 'relevance' : 'relevance')
  const brands = useMemo(() => sp.getAll('brand'), [sp])
  const min = sp.get('min') ? Number(sp.get('min')) : null
  const max = sp.get('max') ? Number(sp.get('max')) : null
  const inStock = sp.get('stock') === '1'
  const onSale = sp.get('sale') === '1'
  const minRating = sp.get('rating') ? Number(sp.get('rating')) : null
  const subs = useMemo(() => sp.getAll('sub'), [sp])
  const page = Math.max(1, Number(sp.get('page') ?? 1))

  const params = {
    category: mode === 'category' ? slug : null, q: mode === 'search' ? q : null,
    tag: mode === 'deals' ? 'flash-sale' : null, brands, min, max, inStock, sort, limit: PAGE, offset: (page - 1) * PAGE,
    onSale, minRating, subcategories: subs,
  }
  const { data, isLoading, isFetching } = useProducts(params, mode !== 'search' || q.length > 0)
  const wish = useWishlistActions()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const title = mode === 'search' ? (q ? `Results for “${q}”` : 'Search') : mode === 'deals' ? 'Deals & flash sale' : category?.name ?? 'Shop'
  useDocumentMeta({ title, description: category?.description ?? `Shop ${title} at Sanjaya Store. Free delivery on your first order.`, noindex: mode === 'search' })

  const update = (fn: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp)
    fn(next)
    next.delete('page')
    setSp(next, { replace: true })
  }
  const total = data?.facets.total ?? 0
  const activeCount = brands.length + subs.length + (min !== null || max !== null ? 1 : 0) + (inStock ? 1 : 0) + (onSale ? 1 : 0) + (minRating ? 1 : 0)
  const pages = Math.ceil(total / PAGE)

  const filters = (
    <Filters
      facets={data?.facets} brands={brands} min={min} max={max} inStock={inStock}
      onSale={onSale} minRating={minRating} subs={subs} showCategories={mode !== 'category' || children.length > 0}
      onSaleChange={(on) => update((p) => (on ? p.set('sale', '1') : p.delete('sale')))}
      onRating={(r) => update((p) => (r ? p.set('rating', String(r)) : p.delete('rating')))}
      onSub={(slug, on) => update((p) => { const all = p.getAll('sub').filter((x) => x !== slug); p.delete('sub'); (on ? [...all, slug] : all).forEach((x) => p.append('sub', x)) })}
      onBrand={(b, on) => update((p) => { const all = p.getAll('brand').filter((x) => x !== b); p.delete('brand'); (on ? [...all, b] : all).forEach((x) => p.append('brand', x)) })}
      onPrice={(a, b) => update((p) => { p.delete('min'); p.delete('max'); if (a !== null) p.set('min', String(a)); if (b !== null) p.set('max', String(b)) })}
      onStock={(on) => update((p) => (on ? p.set('stock', '1') : p.delete('stock')))}
      onClear={() => update((p) => { ['brand', 'min', 'max', 'stock', 'sale', 'rating', 'sub'].forEach((k) => p.delete(k)) })}
    />
  )

  return (
    <div className="container-x py-8">
      <nav className="mb-4 flex items-center gap-1 text-xs text-navy-600/70" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-gold-700">Home</Link>
        {parent && <><ChevronRight className="size-3" /><Link to={`/c/${parent.slug}`} className="hover:text-gold-700">{parent.name}</Link></>}
        <ChevronRight className="size-3" /><span className="text-navy-800">{title}</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold text-navy-900">{title}</h1>
          <p className="mt-1 text-sm text-navy-600/80">{isLoading ? 'Loading…' : `${total.toLocaleString('en-GB')} products`}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}><SlidersHorizontal className="size-4" /> Filters{activeCount ? ` (${activeCount})` : ''}</Button>
          <label className="sr-only" htmlFor="sort">Sort by</label>
          <select id="sort" value={sort} onChange={(e) => update((p) => p.set('sort', e.target.value))} className="input h-9 w-auto rounded-full py-0 text-sm">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      {children.length > 0 && (
        <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
          {children.map((c) => <Link key={c.id} to={`/c/${c.slug}`} className="whitespace-nowrap rounded-full border border-navy-100 bg-white px-4 py-2 text-sm font-medium hover:border-gold-500">{c.name}</Link>)}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">{filters}</aside>
        <div className={cn('transition-opacity', isFetching && !isLoading && 'opacity-60')}>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}</div>
          ) : !data?.items.length ? (
            <EmptyState icon={<SearchX />} title="No products found">Try another search, or remove some filters.</EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {data.items.map((p) => <ProductCard key={p.id} p={p} wished={wish.has(p.id)} onWish={(on) => wish.toggle(p.id, on)} />)}
              </div>
              {pages > 1 && (
                <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pages">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page - 1)); setSp(n); scrollTo(0, 0) }}>Previous</Button>
                  <span className="px-3 text-sm text-navy-700">Page {page} of {pages}</span>
                  <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page + 1)); setSp(n); scrollTo(0, 0) }}>Next</Button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" side="bottom">
        <div className="p-5">{filters}<Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>Show {total} products</Button></div>
      </Sheet>
    </div>
  )
}

function Filters({ facets, brands, min, max, inStock, onSale, minRating, subs, showCategories, onBrand, onPrice, onStock, onSaleChange, onRating, onSub, onClear }: {
  facets?: ListingResult['facets']; brands: string[]; min: number | null; max: number | null; inStock: boolean
  onSale: boolean; minRating: number | null; subs: string[]; showCategories: boolean
  onBrand: (b: string, on: boolean) => void; onPrice: (min: number | null, max: number | null) => void
  onStock: (on: boolean) => void; onSaleChange: (on: boolean) => void; onRating: (r: number | null) => void
  onSub: (slug: string, on: boolean) => void; onClear: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const list = facets?.brands ?? []
  const shown = showAll ? list : list.slice(0, 8)
  const any = brands.length || min !== null || max !== null || inStock || onSale || minRating || subs.length
  const cats = facets?.categories ?? []
  const custom = (min !== null || max !== null) && !PRICE_BANDS.some(([, a, b]) => a === min && b === max)
  return (
    <div className="space-y-7 text-sm">
      {any ? <button onClick={onClear} className="font-semibold text-gold-700 hover:underline">Clear all filters</button> : null}
      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-800">Availability</legend>
        <div className="space-y-2">
          <label className="flex items-center gap-2"><input type="checkbox" checked={inStock} onChange={(e) => onStock(e.target.checked)} className="size-4 accent-gold-500" /> In stock only</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={onSale} onChange={(e) => onSaleChange(e.target.checked)} className="size-4 accent-gold-500" />
            <span className="flex-1">On sale</span>{facets?.on_sale ? <span className="text-xs text-navy-600/60">{facets.on_sale}</span> : null}</label>
        </div>
      </fieldset>
      {showCategories && (cats.length > 1 || subs.length > 0) && (
        <fieldset>
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-800">Category</legend>
          <ul className="space-y-2">
            {cats.slice(0, 12).map((c) => (
              <li key={c.slug}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={subs.includes(c.slug)} onChange={(e) => onSub(c.slug, e.target.checked)} className="size-4 accent-gold-500" />
                  <span className="flex-1">{c.name}</span><span className="text-xs text-navy-600/60">{c.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-800">Price</legend>
        <ul className="space-y-2">
          {PRICE_BANDS.map(([label, a, b]) => (
            <li key={label}>
              <label className="flex items-center gap-2">
                <input type="radio" name="price" checked={min === a && max === b} onChange={() => onPrice(a, b)} className="size-4 accent-gold-500" /> {label}
              </label>
            </li>
          ))}
        </ul>
        <PriceRange key={`${min}-${max}`} min={custom ? min : null} max={custom ? max : null} onApply={onPrice} />
        {facets?.price_min != null && <p className="mt-2 text-xs text-navy-600/60">From {formatAED(facets.price_min)} to {formatAED(facets.price_max ?? facets.price_min)}</p>}
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-800">Customer rating</legend>
        <ul className="space-y-2">
          {[4, 3].map((r) => (
            <li key={r}><label className="flex items-center gap-2"><input type="radio" name="rating" checked={minRating === r} onChange={() => onRating(r)} className="size-4 accent-gold-500" /> <span className="text-gold-600" aria-hidden>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span> & up</label></li>
          ))}
          {minRating ? <li><button onClick={() => onRating(null)} className="text-xs font-semibold text-gold-700">Any rating</button></li> : null}
        </ul>
      </fieldset>
      {list.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-navy-800">Brand</legend>
          <ul className="space-y-2">
            {shown.map(({ brand, count }) => (
              <li key={brand}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={brands.includes(brand)} onChange={(e) => onBrand(brand, e.target.checked)} className="size-4 accent-gold-500" />
                  <span className="flex-1">{brand}</span><span className="text-xs text-navy-600/60">{count}</span>
                </label>
              </li>
            ))}
          </ul>
          {list.length > 8 && <button onClick={() => setShowAll(!showAll)} className="mt-2 text-xs font-semibold text-gold-700">{showAll ? 'Show fewer' : `Show all ${list.length}`}</button>}
        </fieldset>
      )}
    </div>
  )
}

/** Custom AED range under the price bands. */
function PriceRange({ min, max, onApply }: { min: number | null; max: number | null; onApply: (min: number | null, max: number | null) => void }) {
  const [a, setA] = useState(min !== null ? String(min / 100) : '')
  const [b, setB] = useState(max !== null ? String(max / 100) : '')
  const toFils = (v: string) => { const n = Number(v.replace(/[,\s]/g, '')); return v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null }
  return (
    <form className="mt-3 flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); onApply(toFils(a), toFils(b)) }}>
      <input className="input h-9 px-2.5 text-sm" inputMode="decimal" placeholder="Min" value={a} onChange={(e) => setA(e.target.value)} aria-label="Minimum price in AED" />
      <span className="text-navy-600/60">–</span>
      <input className="input h-9 px-2.5 text-sm" inputMode="decimal" placeholder="Max" value={b} onChange={(e) => setB(e.target.value)} aria-label="Maximum price in AED" />
      <Button type="submit" size="sm" variant="outline" className="h-9 px-3">Go</Button>
    </form>
  )
}
