import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus } from 'lucide-react'
import { Alert, Badge, Skeleton } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField, TextareaField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useCategories } from '@/features/catalog/api'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { formatAED } from '@/lib/money'
import { AdminTitle, Table, Td, aedInput } from './ui'

export function AdminProducts() {
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const low = sp.get('low') === '1'
  const page = Number(sp.get('page') ?? 0)
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', q, low, page],
    queryFn: async () => {
      let query = requireSupabase().from('products')
        .select('id, slug, name, brand, is_active, is_featured, tags, category:categories(name), product_variants(id, stock, price_paise, low_stock_threshold, is_active)', { count: 'exact' })
        .order('created_at', { ascending: false }).range(page * 50, page * 50 + 49)
      if (q) query = query.or(`name.ilike.%${q.replace(/[,()]/g, ' ')}%,brand.ilike.%${q.replace(/[,()]/g, ' ')}%,slug.ilike.%${q.replace(/[,()]/g, ' ')}%`)
      const { data, error, count } = await query
      if (error) throw error
      const rows = low ? data.filter((p) => p.product_variants.some((v) => v.is_active && v.stock <= v.low_stock_threshold)) : data
      return { rows, count: count ?? 0 }
    },
  })
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); n.delete('page'); setSp(n, { replace: true }) }

  return (
    <>
      <AdminTitle title="Products" subtitle={data ? `${data.count.toLocaleString('en-GB')} products` : undefined}>
        <input className="input h-9 w-56" placeholder="Search name, brand, slug" defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim())} aria-label="Search products" />
        <Button size="sm" variant={low ? 'danger' : 'outline'} onClick={() => set('low', low ? '' : '1')}>Low stock</Button>
        <Link to="/admin/products/new" className="inline-flex h-9 items-center gap-1 rounded-full bg-navy-900 px-4 text-sm font-semibold text-white"><Plus className="size-4" /> New product</Link>
      </AdminTitle>
      {isLoading ? <Skeleton className="h-96" /> : (
        <>
          <Table head={['Product', 'Category', 'Price from', 'Stock', 'Status']} empty={!data?.rows.length}>
            {data?.rows.map((p) => {
              const vs = p.product_variants.filter((v) => v.is_active)
              const stock = vs.reduce((n, v) => n + v.stock, 0)
              const lowCount = vs.filter((v) => v.stock <= v.low_stock_threshold).length
              return (
                <tr key={p.id}>
                  <Td><Link to={`/admin/products/${p.id}`} className="font-semibold text-navy-900 hover:text-gold-700">{p.name}</Link><span className="block text-xs text-navy-600">{p.brand}{p.tags.includes('demo') && ' · demo'}</span></Td>
                  <Td>{(p.category as { name: string } | null)?.name}</Td>
                  <Td>{vs.length ? formatAED(Math.min(...vs.map((v) => v.price_paise))) : '—'}</Td>
                  <Td>{stock}{lowCount > 0 && <Badge tone="red" className="ml-2">{lowCount} low</Badge>}</Td>
                  <Td>{p.is_active ? <Badge tone="green">Live</Badge> : <Badge tone="grey">Hidden</Badge>}{p.is_featured && <Badge tone="gold" className="ml-1">Featured</Badge>}</Td>
                </tr>
              )
            })}
          </Table>
          <div className="mt-4 flex justify-center gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page - 1)); setSp(n) }}>Previous</Button>
            <Button size="sm" variant="outline" disabled={!data || (page + 1) * 50 >= data.count} onClick={() => { const n = new URLSearchParams(sp); n.set('page', String(page + 1)); setSp(n) }}>Next</Button>
          </div>
        </>
      )}
    </>
  )
}

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export function AdminProductEdit() {
  const { id } = useParams()
  const isNew = id === 'new'
  const qc = useQueryClient()
  const toast = useToast()
  const { data: categories } = useCategories()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'product', id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('products')
        .select('*, product_variants(*), product_images(*)').eq('id', id!).single()
      if (error) throw error
      return data
    },
  })
  if (!isNew && (isLoading || !data)) return <Skeleton className="h-96" />
  return (
    <>
      <Link to="/admin/products" className="mb-3 inline-flex items-center gap-1 text-sm text-navy-700 hover:text-gold-700"><ArrowLeft className="size-4" /> Products</Link>
      <AdminTitle title={isNew ? 'New product' : data!.name}>
        {!isNew && <a href={`/p/${data!.slug}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-gold-700 hover:underline">View in store</a>}
      </AdminTitle>
      <ProductForm key={id} product={data ?? null} categories={categories ?? []} onSaved={(newId) => {
        toast('Product saved'); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['products'] })
        if (isNew) window.location.assign(`/admin/products/${newId}`)
      }} />
      {!isNew && <VariantsEditor productId={data!.id} variants={data!.product_variants} />}
      {!isNew && <ImagesEditor productId={data!.id} images={data!.product_images} />}
    </>
  )
}

type ProductRow = { id: string; slug: string; name: string; brand: string | null; short_description: string | null; description: string | null; category_id: string; is_active: boolean; is_featured: boolean; installment_eligible: boolean | null; tags: string[]; specs: unknown }

function ProductForm({ product, categories, onSaved }: { product: ProductRow | null; categories: { id: string; name: string; parent_id: string | null }[]; onSaved: (id: string) => void }) {
  const [f, setF] = useState({
    name: product?.name ?? '', slug: product?.slug ?? '', brand: product?.brand ?? '', short_description: product?.short_description ?? '',
    description: product?.description ?? '', category_id: product?.category_id ?? '', is_active: product?.is_active ?? false,
    is_featured: product?.is_featured ?? false, installment: product?.installment_eligible == null ? 'inherit' : product.installment_eligible ? 'yes' : 'no',
    tags: (product?.tags ?? []).join(', '),
    specs: Object.entries((product?.specs as Record<string, string>) ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
    price: '', mrp: '', stock: '', sku: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }))
  const save = useMutation({
    mutationFn: async () => {
      const db = requireSupabase()
      const slug = f.slug || slugify(f.name)
      const specs: Record<string, string> = {}
      for (const line of f.specs.split('\n')) {
        const i = line.indexOf(':')
        if (i > 0 && line.slice(0, i).trim()) specs[line.slice(0, i).trim()] = line.slice(i + 1).trim()
      }
      const row = {
        name: f.name.trim(), slug, brand: f.brand.trim() || null, short_description: f.short_description.trim() || null, description: f.description.trim() || null,
        category_id: f.category_id, is_active: f.is_active, is_featured: f.is_featured,
        installment_eligible: f.installment === 'inherit' ? null : f.installment === 'yes',
        tags: f.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), specs,
      }
      if (!row.name || !row.category_id) throw new Error('Name and category are required.')
      if (product) {
        const { error } = await db.from('products').update(row).eq('id', product.id)
        if (error) throw error
        return product.id
      }
      const price = aedInput(f.price)
      if (!price) throw new Error('Enter the selling price for the first variant.')
      const { data, error } = await db.from('products').insert(row).select('id').single()
      if (error) throw error
      const { data: v, error: e2 } = await db.from('product_variants').insert({
        product_id: data.id, sku: f.sku.trim() || slug.toUpperCase().slice(0, 40), name: 'Default', price_paise: price, mrp_paise: aedInput(f.mrp) || null,
      }).select('id').single()
      if (e2) throw e2
      const stock = parseInt(f.stock || '0', 10)
      if (stock > 0) { const { error: e3 } = await db.rpc('adjust_stock', { p_variant: v.id, p_delta: stock, p_reason: 'restock', p_note: 'Opening stock' }); if (e3) throw e3 }
      return data.id
    },
    onSuccess: onSaved,
    onError: (e) => setErr(friendlyError(e)),
  })
  return (
    <form className="card mb-6 grid gap-4 p-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); setErr(null); save.mutate() }}>
      <InputField label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={200} />
      <InputField label="Web address (slug)" value={f.slug} onChange={(e) => set('slug', slugify(e.target.value))} placeholder={slugify(f.name) || 'auto'} hint="Leave empty to create from the name." />
      <InputField label="Brand" value={f.brand} onChange={(e) => set('brand', e.target.value)} />
      <SelectField label="Category" value={f.category_id} onChange={(e) => set('category_id', e.target.value)} required>
        <option value="">Choose…</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? '— ' : ''}{c.name}</option>)}
      </SelectField>
      <InputField className="sm:col-span-2" label="Short description" value={f.short_description} onChange={(e) => set('short_description', e.target.value)} maxLength={300} />
      <TextareaField className="sm:col-span-2" label="Description" value={f.description} onChange={(e) => set('description', e.target.value)} />
      <TextareaField label="Specifications (one per line, Name: value)" value={f.specs} onChange={(e) => set('specs', e.target.value)} />
      <div className="space-y-4">
        <InputField label="Tags (comma separated)" value={f.tags} onChange={(e) => set('tags', e.target.value)} hint="Add flash-sale to show it in the flash sale." />
        <SelectField label="Six installments" value={f.installment} onChange={(e) => set('installment', e.target.value)}>
          <option value="inherit">Same as category</option><option value="yes">Allowed</option><option value="no">Not allowed</option>
        </SelectField>
      </div>
      {!product && (
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-4">
          <InputField label="Price AED" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} required />
          <InputField label="Was price AED (optional)" inputMode="decimal" value={f.mrp} onChange={(e) => set('mrp', e.target.value)} />
          <InputField label="Opening stock" inputMode="numeric" value={f.stock} onChange={(e) => set('stock', e.target.value.replace(/\D/g, ''))} />
          <InputField label="SKU" value={f.sku} onChange={(e) => set('sku', e.target.value)} placeholder="auto" />
        </div>
      )}
      <div className="flex flex-wrap gap-6 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-gold-500" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} /> Live in store</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-gold-500" checked={f.is_featured} onChange={(e) => set('is_featured', e.target.checked)} /> Featured on homepage</label>
      </div>
      {err && <div className="sm:col-span-2"><Alert tone="error">{err}</Alert></div>}
      <div className="sm:col-span-2"><Button type="submit" loading={save.isPending}>Save product</Button></div>
    </form>
  )
}

type Variant = { id: string; sku: string; name: string; price_paise: number; mrp_paise: number | null; stock: number; is_active: boolean; low_stock_threshold: number }
function VariantsEditor({ productId, variants }: { productId: string; variants: Variant[] }) {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'product', productId] })
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => { setErr(null); const { error } = await fn(); if (error) setErr(friendlyError(error)); else refresh() }
  const db = requireSupabase()
  return (
    <section className="mb-6">
      <h2 className="mb-2 font-semibold text-navy-900">Variants (sizes, colours, storage)</h2>
      {err && <div className="mb-2"><Alert tone="error">{err}</Alert></div>}
      <Table head={['SKU / name', 'Price AED', 'Was AED', 'Stock', 'Change stock', 'Live']}>
        {[...variants].sort((a, b) => a.name.localeCompare(b.name)).map((v) => (
          <tr key={v.id}>
            <Td><span className="font-mono text-xs">{v.sku}</span><input className="input mt-1 h-8 text-sm" defaultValue={v.name} aria-label="Variant name" onBlur={(e) => e.target.value !== v.name && run(() => db.from('product_variants').update({ name: e.target.value }).eq('id', v.id))} /></Td>
            <Td><input className="input h-8 w-28" defaultValue={(v.price_paise / 100).toString()} inputMode="decimal" aria-label="Price" onBlur={(e) => { const p = aedInput(e.target.value); if (p && p !== v.price_paise) run(() => db.from('product_variants').update({ price_paise: p }).eq('id', v.id)) }} /></Td>
            <Td><input className="input h-8 w-28" defaultValue={v.mrp_paise ? (v.mrp_paise / 100).toString() : ''} inputMode="decimal" aria-label="MRP" onBlur={(e) => { const p = e.target.value ? aedInput(e.target.value) : null; if (p !== v.mrp_paise) run(() => db.from('product_variants').update({ mrp_paise: p }).eq('id', v.id)) }} /></Td>
            <Td><span className={v.stock <= v.low_stock_threshold ? 'font-bold text-danger' : ''}>{v.stock}</span></Td>
            <Td><StockChange onApply={(delta, reason) => run(() => db.rpc('adjust_stock', { p_variant: v.id, p_delta: delta, p_reason: reason }))} /></Td>
            <Td><input type="checkbox" className="size-4 accent-gold-500" checked={v.is_active} aria-label="Variant live" onChange={(e) => run(() => db.from('product_variants').update({ is_active: e.target.checked }).eq('id', v.id))} /></Td>
          </tr>
        ))}
      </Table>
      <AddVariant productId={productId} onDone={refresh} onError={setErr} />
    </section>
  )
}

function StockChange({ onApply }: { onApply: (delta: number, reason: string) => void }) {
  const [n, setN] = useState('')
  const [reason, setReason] = useState('restock')
  const delta = parseInt(n, 10)
  return (
    <div className="flex gap-1">
      <input className="input h-8 w-20" value={n} onChange={(e) => setN(e.target.value.replace(/[^\d-]/g, ''))} placeholder="+10" aria-label="Stock change" />
      <select className="input h-8 w-auto py-0 text-xs" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason"><option value="restock">Restock</option><option value="adjustment">Correction</option><option value="return">Return</option></select>
      <Button size="sm" variant="outline" className="h-8" disabled={!delta} onClick={() => { onApply(delta, reason); setN('') }}>Apply</Button>
    </div>
  )
}

function AddVariant({ productId, onDone, onError }: { productId: string; onDone: () => void; onError: (e: string) => void }) {
  const [f, setF] = useState({ name: '', sku: '', price: '', mrp: '' })
  const add = async () => {
    const price = aedInput(f.price)
    if (!f.name || !f.sku || !price) return onError('Variant name, SKU and price are required.')
    const { error } = await requireSupabase().from('product_variants').insert({ product_id: productId, name: f.name, sku: f.sku.trim().toUpperCase(), price_paise: price, mrp_paise: aedInput(f.mrp) || null, options: { size: f.name } })
    if (error) onError(friendlyError(error)); else { setF({ name: '', sku: '', price: '', mrp: '' }); onDone() }
  }
  return (
    <div className="card mt-3 grid gap-2 p-3 sm:grid-cols-5 sm:items-end">
      <InputField label="New variant (e.g. size M)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <InputField label="SKU" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
      <InputField label="Price AED" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <InputField label="Was price AED" inputMode="decimal" value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} />
      <Button size="sm" onClick={add}><Plus className="size-4" /> Add variant</Button>
    </div>
  )
}

type Img = { id: string; url: string; alt: string | null; sort_order: number }
function ImagesEditor({ productId, images }: { productId: string; images: Img[] }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'product', productId] })
  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setErr(null)
    const db = requireSupabase()
    try {
      let order = images.length
      for (const file of Array.from(files)) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: use JPG, PNG or WebP under 5 MB.`)
        const path = `${productId}/${crypto.randomUUID()}.${file.type.split('/')[1]}`
        const { error } = await db.storage.from('product-images').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
        if (error) throw error
        const url = db.storage.from('product-images').getPublicUrl(path).data.publicUrl
        const { error: e2 } = await db.from('product_images').insert({ product_id: productId, url, sort_order: order++ })
        if (e2) throw e2
      }
      refresh()
    } catch (e) { setErr(friendlyError(e)) } finally { setBusy(false) }
  }
  const remove = async (img: Img) => {
    const { error } = await requireSupabase().from('product_images').delete().eq('id', img.id)
    if (error) setErr(friendlyError(error)); else refresh()
  }
  return (
    <section>
      <h2 className="mb-2 font-semibold text-navy-900">Photos</h2>
      {err && <div className="mb-2"><Alert tone="error">{err}</Alert></div>}
      <div className="flex flex-wrap gap-3">
        {[...images].sort((a, b) => a.sort_order - b.sort_order).map((img) => (
          <div key={img.id} className="relative size-28 overflow-hidden rounded-xl border border-navy-100 bg-white">
            <img src={img.url} alt={img.alt ?? ''} className="size-full object-cover" />
            <button onClick={() => remove(img)} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-xs text-danger shadow">Remove</button>
          </div>
        ))}
        <label className="grid size-28 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-navy-200 text-center text-xs text-navy-600 hover:border-gold-500">
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
          {busy ? 'Uploading…' : <>Add photos<br />JPG/PNG/WebP</>}
        </label>
      </div>
    </section>
  )
}
