import { useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { Filter, ImageOff, Pencil, Plus, Search, X } from 'lucide-react'
import { Alert, Badge, Skeleton } from '@/components/ui/misc'
import { useToast } from '@/components/ui/Toast'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { AdminTitle, Panel, Td, aed, aedInput, downloadCsv } from './ui'
import { EMPTY_BULK, buildBulkChanges, type BulkForm } from './bulkEdit'

const PAGE = 50
type Row = {
  id: string; slug: string; name: string; brand: string | null; is_active: boolean; is_featured: boolean; tags: string[]
  category_name: string; category_id: string; min_price: number; stock: number; variants: number; low_variants: number; image_url: string | null
}
type ListResult = { total: number; rows: Row[]; brands: string[] }
type Cat = { id: string; name: string; parent_id: string | null; sort_order: number }

const FILTER_KEYS = ['q', 'cat', 'status', 'featured', 'stock', 'brand', 'min', 'max', 'tag', 'images'] as const
const SORTS: [string, string][] = [
  ['newest', 'Newest first'], ['oldest', 'Oldest first'], ['name', 'Name A–Z'], ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'], ['stock_asc', 'Stock: lowest first'], ['stock_desc', 'Stock: highest first'],
]

function useAllCategories() {
  return useQuery({
    queryKey: ['admin', 'categories'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('categories').select('id, name, parent_id, sort_order').order('sort_order')
      if (error) throw error
      return data as Cat[]
    },
  })
}
/** Parents first, each followed by its sub-categories. */
function orderedCategories(cats: Cat[]) {
  const tops = cats.filter((c) => !c.parent_id).sort((a, b) => a.name.localeCompare(b.name))
  return tops.flatMap((t) => [{ ...t, depth: 0 }, ...cats.filter((c) => c.parent_id === t.id).sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ ...c, depth: 1 }))])
}

export function AdminProducts() {
  const [sp, setSp] = useSearchParams()
  const qc = useQueryClient()
  const toast = useToast()
  const get = (k: string) => sp.get(k) ?? ''
  const page = Math.max(0, Number(sp.get('page') ?? 0))
  const sort = get('sort') || 'newest'
  // older links used ?low=1
  const stock = get('stock') || (sp.get('low') === '1' ? 'low' : '')
  const args = {
    p_query: get('q') || undefined,
    p_category: get('cat') || undefined,
    p_status: get('status') || undefined,
    p_featured: get('featured') === 'yes' ? true : get('featured') === 'no' ? false : undefined,
    p_stock: stock || undefined,
    p_brand: get('brand') || undefined,
    p_min_paise: get('min') ? aedInput(get('min')) ?? undefined : undefined,
    p_max_paise: get('max') ? aedInput(get('max')) ?? undefined : undefined,
    p_tag: get('tag') || undefined,
    p_images: get('images') || undefined,
  }
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin', 'products', args, sort, page],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('admin_list_products', { ...args, p_sort: sort, p_limit: PAGE, p_offset: page * PAGE })
      if (error) throw error
      return data as unknown as ListResult
    },
  })
  const { data: cats } = useAllCategories()
  const catList = useMemo(() => orderedCategories(cats ?? []), [cats])

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp)
    if (v) n.set(k, v); else n.delete(k)
    if (k === 'stock') n.delete('low')
    if (k !== 'page') n.delete('page')
    setSp(n, { replace: true })
  }
  const activeFilters = FILTER_KEYS.filter((k) => (k === 'stock' ? stock : get(k)))
  const clearAll = () => { const n = new URLSearchParams(); if (sp.get('sort')) n.set('sort', sort); setSp(n, { replace: true }) }

  // ---- selection ----
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allMatching, setAllMatching] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const rows = data?.rows ?? []
  const pageAllOn = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const togglePage = () => setSelected((s) => { const n = new Set(s); rows.forEach((r) => (pageAllOn ? n.delete(r.id) : n.add(r.id))); return n })
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const selectAllMatching = async () => {
    const { data: r, error } = await requireSupabase().rpc('admin_list_products', { ...args, p_ids_only: true })
    if (error) return
    setSelected(new Set((r as unknown as { ids: string[] }).ids)); setAllMatching(true)
  }
  const clearSel = () => { setSelected(new Set()); setAllMatching(false) }

  const exportCsv = async () => {
    const list: Row[] = []
    for (let offset = 0; offset < 10000; offset += 200) {
      const { data: r, error } = await requireSupabase().rpc('admin_list_products', { ...args, p_sort: sort, p_limit: 200, p_offset: offset })
      if (error) { toast(friendlyError(error)); return }
      const res = r as unknown as ListResult
      list.push(...res.rows)
      if (list.length >= res.total || !res.rows.length) break
    }
    downloadCsv('sanjaya-products.csv', ['Name', 'Slug', 'Brand', 'Category', 'Price from (AED)', 'Stock', 'Variants', 'Status', 'Featured', 'Tags'],
      list.map((p) => [p.name, p.slug, p.brand, p.category_name, (p.min_price / 100).toFixed(2), p.stock, p.variants, p.is_active ? 'Live' : 'Hidden', p.is_featured ? 'Yes' : '', p.tags.join(' ')]))
  }

  return (
    <>
      <AdminTitle title="Products" subtitle={data ? `${data.total.toLocaleString('en-GB')} ${activeFilters.length ? 'matching' : 'products'}` : undefined}>
        <Link to="/admin/stock" className="pill pill-light">Stock overview</Link>
        <button type="button" className="pill pill-light" onClick={exportCsv}>Export CSV</button>
        <Link to="/admin/products/new" className="pill pill-dark"><Plus className="size-4" /> New product</Link>
      </AdminTitle>

      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/65 px-3 sm:max-w-sm">
            <Search className="size-4 muted" />
            <input key={get('q')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search name, brand, slug or SKU" defaultValue={get('q')}
              onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim())} aria-label="Search products" />
          </label>
          <select className="input h-10 w-auto py-0 text-sm" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" className={cn('pill', showFilters ? 'pill-on' : 'pill-ghost')} onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}>
            <Filter className="size-4" /> Filters{activeFilters.length ? ` (${activeFilters.length})` : ''}
          </button>
          {activeFilters.length > 0 && <button type="button" className="pill pill-ghost" onClick={clearAll}><X className="size-4" /> Clear</button>}
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <FilterSelect label="Category" value={get('cat')} onChange={(v) => set('cat', v)}>
              <option value="">All categories</option>
              {catList.map((c) => <option key={c.id} value={c.id}>{c.depth ? '— ' : ''}{c.name}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={get('status')} onChange={(v) => set('status', v)}>
              <option value="">Live and hidden</option><option value="live">Live only</option><option value="hidden">Hidden only</option>
            </FilterSelect>
            <FilterSelect label="Stock" value={stock} onChange={(v) => set('stock', v)}>
              <option value="">Any stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
            </FilterSelect>
            <FilterSelect label="Brand" value={get('brand')} onChange={(v) => set('brand', v)}>
              <option value="">All brands</option>
              {data?.brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </FilterSelect>
            <FilterSelect label="Featured" value={get('featured')} onChange={(v) => set('featured', v)}>
              <option value="">Any</option><option value="yes">Featured</option><option value="no">Not featured</option>
            </FilterSelect>
            <FilterSelect label="Photos" value={get('images')} onChange={(v) => set('images', v)}>
              <option value="">Any</option><option value="with">With photos</option><option value="without">No photos</option>
            </FilterSelect>
            <FilterInput label="Min price AED" value={get('min')} onCommit={(v) => set('min', v)} inputMode="decimal" />
            <FilterInput label="Max price AED" value={get('max')} onCommit={(v) => set('max', v)} inputMode="decimal" />
            <FilterInput label="Tag" value={get('tag')} onCommit={(v) => set('tag', v.toLowerCase())} placeholder="e.g. flash-sale" />
          </div>
        )}
      </Panel>

      {selected.size > 0 && (
        <div className="glass sticky top-2 z-30 mb-4 flex flex-wrap items-center gap-2 !rounded-full p-2 pl-4">
          <p className="text-sm font-bold">{selected.size.toLocaleString('en-GB')} selected</p>
          {!allMatching && data && data.total > rows.length && pageAllOn && (
            <button type="button" className="text-sm font-semibold underline" onClick={selectAllMatching}>Select all {Math.min(data.total, 5000).toLocaleString('en-GB')} matching</button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="pill pill-ghost" onClick={clearSel}>Clear</button>
            <button type="button" className="pill pill-dark" onClick={() => setBulkOpen(true)}><Pencil className="size-4" /> Bulk edit</button>
          </div>
        </div>
      )}
      {bulkOpen && selected.size > 0 && (
        <BulkEditor ids={[...selected]} categories={catList} onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); clearSel(); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['products'] }) }} />
      )}

      {error && <Alert tone="error">{friendlyError(error)}</Alert>}
      {isLoading ? <Skeleton className="h-96 rounded-[22px] bg-white/40" /> : (
        <div className={cn('card overflow-x-auto transition-opacity', isFetching && 'opacity-60')}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wider muted">
              <tr>
                <th className="w-10 px-3 py-2.5"><input type="checkbox" className="size-4 accent-black" checked={pageAllOn} onChange={togglePage} aria-label="Select all on this page" /></th>
                {['Product', 'Category', 'Price from', 'Stock', 'Status'].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((p) => (
                <tr key={p.id} className={cn(selected.has(p.id) && 'bg-white/40')}>
                  <Td><input type="checkbox" className="mt-2 size-4 accent-black" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      {p.image_url ? <img src={p.image_url} alt="" loading="lazy" className="size-10 flex-none rounded-lg bg-white object-contain" />
                        : <span className="grid size-10 flex-none place-items-center rounded-lg bg-white/60"><ImageOff className="size-4 muted" /></span>}
                      <div className="min-w-0">
                        <Link to={`/admin/products/${p.id}`} className="line-clamp-2 font-semibold hover:underline">{p.name}</Link>
                        <span className="block text-xs muted">{p.brand}{p.variants > 1 && ` · ${p.variants} variants`}{p.tags.includes('demo') && ' · demo'}</span>
                      </div>
                    </div>
                  </Td>
                  <Td className="max-w-[180px]">{p.category_name}</Td>
                  <Td className="whitespace-nowrap">{p.variants ? aed(p.min_price) : '—'}</Td>
                  <Td className="whitespace-nowrap">{p.stock}{p.low_variants > 0 && <Badge tone={p.stock === 0 ? 'red' : 'amber'} className="ml-2">{p.stock === 0 ? 'out' : `${p.low_variants} low`}</Badge>}</Td>
                  <Td>{p.is_active ? <Badge tone="green">Live</Badge> : <Badge tone="grey">Hidden</Badge>}{p.is_featured && <Badge tone="gold" className="ml-1">Featured</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <p className="p-6 text-center text-sm muted">No products match these filters.</p>}
        </div>
      )}
      {data && data.total > PAGE && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button type="button" className="pill pill-light" disabled={page === 0} onClick={() => set('page', String(page - 1))}>Previous</button>
          <span className="px-2 text-sm muted">Page {page + 1} of {Math.ceil(data.total / PAGE)}</span>
          <button type="button" className="pill pill-light" disabled={(page + 1) * PAGE >= data.total} onClick={() => set('page', String(page + 1))}>Next</button>
        </div>
      )}
    </>
  )
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold muted">
      {label}
      <select className={cn('input mt-1 h-10 py-0 text-sm', value && '!border-black/40 font-semibold')} value={value} onChange={(e) => onChange(e.target.value)}>{children}</select>
    </label>
  )
}
function FilterInput({ label, value, onCommit, ...rest }: { label: string; value: string; onCommit: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <label className="block text-xs font-semibold muted">
      {label}
      <input key={value} defaultValue={value} className={cn('input mt-1 h-10 text-sm', value && '!border-black/40 font-semibold')}
        onBlur={(e) => e.target.value.trim() !== value && onCommit(e.target.value.trim())}
        onKeyDown={(e) => e.key === 'Enter' && onCommit((e.target as HTMLInputElement).value.trim())} {...rest} />
    </label>
  )
}

function BulkEditor({ ids, categories, onClose, onDone }: { ids: string[]; categories: (Cat & { depth: number })[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [f, setF] = useState<BulkForm>(EMPTY_BULK)
  const [err, setErr] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof BulkForm>(k: K, v: BulkForm[K]) => { setF((p) => ({ ...p, [k]: v })); setConfirm(null); setErr(null) }
  const built = buildBulkChanges(f)

  const apply = async () => {
    if ('error' in built) { setErr(built.error); return }
    if (!confirm) { setConfirm(built.summary); return }
    setBusy(true)
    const { data, error } = await requireSupabase().rpc('admin_bulk_update_products', { p_ids: ids, p_changes: built.changes as never })
    setBusy(false)
    if (error) { setErr(friendlyError(error)); return }
    const r = data as unknown as { products: number; variants: number }
    toast(`Updated ${r.products} product${r.products === 1 ? '' : 's'}${r.variants ? ` and ${r.variants} variant${r.variants === 1 ? '' : 's'}` : ''}`)
    onDone()
  }

  const sel = 'input mt-1 h-10 py-0 text-sm'
  const inp = 'input mt-1 h-10 text-sm'
  const lab = 'block text-xs font-semibold muted'
  return (
    <Panel className="mb-4" title={`Bulk edit ${ids.length.toLocaleString('en-GB')} product${ids.length === 1 ? '' : 's'}`}
      action={<button type="button" className="pill pill-ghost" onClick={onClose}><X className="size-4" /> Close</button>}>
      <p className="mb-3 text-xs muted">Leave a field on “No change” to keep it. Price, stock and cost changes apply to every variant of the selected products.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={lab}>Store status
          <select className={sel} value={f.status} onChange={(e) => set('status', e.target.value as BulkForm['status'])}>
            <option value="">No change</option><option value="live">Live (show in store)</option><option value="hidden">Hidden</option>
          </select>
        </label>
        <label className={lab}>Featured on homepage
          <select className={sel} value={f.featured} onChange={(e) => set('featured', e.target.value as BulkForm['featured'])}>
            <option value="">No change</option><option value="yes">Yes</option><option value="no">No</option>
          </select>
        </label>
        <label className={lab}>Move to category
          <select className={sel} value={f.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">No change</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.depth ? '— ' : ''}{c.name}</option>)}
          </select>
        </label>
        <label className={lab}>Six installments
          <select className={sel} value={f.installment} onChange={(e) => set('installment', e.target.value as BulkForm['installment'])}>
            <option value="">No change</option><option value="inherit">Same as category</option><option value="yes">Allowed</option><option value="no">Not allowed</option>
          </select>
        </label>

        <div className={lab}>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-black" checked={f.brandOn} onChange={(e) => set('brandOn', e.target.checked)} /> Change brand</label>
          <input className={inp} disabled={!f.brandOn} value={f.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Empty clears the brand" aria-label="New brand" />
        </div>
        <label className={lab}>Add tags
          <input className={inp} value={f.addTags} onChange={(e) => set('addTags', e.target.value)} placeholder="flash-sale, eid" />
        </label>
        <label className={lab}>Remove tags
          <input className={inp} value={f.removeTags} onChange={(e) => set('removeTags', e.target.value)} placeholder="demo" />
        </label>
        <label className={lab}>Low-stock alert at
          <input className={inp} inputMode="numeric" value={f.lowStock} onChange={(e) => set('lowStock', e.target.value.replace(/\D/g, ''))} placeholder="No change" />
        </label>

        <ModeField label="Selling price" mode={f.priceMode} value={f.price} onMode={(m) => set('priceMode', m as BulkForm['priceMode'])} onValue={(v) => set('price', v)}
          modes={[['set', 'Set to AED'], ['percent', 'Change by %'], ['amount', 'Change by AED']]} placeholder={f.priceMode === 'set' ? '99.00' : '-10'} />
        <ModeField label="Was-price (strike-through)" mode={f.mrpMode} value={f.mrp} onMode={(m) => set('mrpMode', m as BulkForm['mrpMode'])} onValue={(v) => set('mrp', v)}
          modes={[['set', 'Set to AED'], ['markup', 'Price + %'], ['clear', 'Remove']]} placeholder={f.mrpMode === 'markup' ? '20' : '149.00'} />
        <ModeField label="Cost price (staff only)" mode={f.costMode} value={f.cost} onMode={(m) => set('costMode', m as BulkForm['costMode'])} onValue={(v) => set('cost', v)}
          modes={[['set', 'Set to AED'], ['clear', 'Remove']]} placeholder="45.00" />
        <ModeField label="Stock" mode={f.stockMode} value={f.stock} onMode={(m) => set('stockMode', m as BulkForm['stockMode'])} onValue={(v) => set('stock', v.replace(/[^\d-]/g, ''))}
          modes={[['set', 'Set to'], ['add', 'Add / remove']]} placeholder={f.stockMode === 'add' ? '+10 or -2' : '20'} />
      </div>

      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
      {confirm && (
        <div className="mt-3 rounded-2xl bg-white/70 p-3 text-sm">
          <p className="font-bold">Apply to {ids.length.toLocaleString('en-GB')} products?</p>
          <ul className="mt-1 list-inside list-disc muted">{confirm.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="pill pill-dark" disabled={busy} onClick={apply}>{busy ? 'Saving…' : confirm ? 'Yes, apply changes' : 'Review changes'}</button>
        <button type="button" className="pill pill-light" onClick={() => { setF(EMPTY_BULK); setConfirm(null); setErr(null) }}>Reset</button>
      </div>
    </Panel>
  )
}

function ModeField({ label, mode, value, onMode, onValue, modes, placeholder }: {
  label: string; mode: string; value: string; onMode: (m: string) => void; onValue: (v: string) => void; modes: [string, string][]; placeholder: string
}) {
  return (
    <div className="block text-xs font-semibold muted">
      {label}
      <div className="mt-1 flex gap-1.5">
        <select className="input h-10 w-[55%] py-0 text-sm" value={mode} onChange={(e) => onMode(e.target.value)} aria-label={`${label}: how to change`}>
          <option value="">No change</option>
          {modes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input h-10 min-w-0 flex-1 text-sm" inputMode="decimal" disabled={!mode || mode === 'clear'} value={value} onChange={(e) => onValue(e.target.value)} placeholder={placeholder} aria-label={`${label} value`} />
      </div>
    </div>
  )
}
