import { ScrollRow } from '@/components/ui/ScrollRow'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Heart, MapPin, ShieldCheck, Truck, CalendarClock, Star, PackageX } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert, Badge, EmptyState, Price, Rating, Skeleton } from '@/components/ui/misc'
import { TextareaField, InputField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useCart } from '@/features/cart/CartProvider'
import { QuantityStepper } from '@/features/cart/QuantityStepper'
import { useAuth } from '@/features/account/AuthProvider'
import { usePincodeCheck, useProduct, useReviews, usePublicSetting, type ProductDetail } from '@/features/catalog/api'
import { ProductRail, useWishlistActions } from '@/features/catalog/ProductRail'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { formatAED } from '@/lib/money'
import { EMIRATES, emirateName } from '@/lib/emirates'
import { formatDate, formatDeliveryWindow } from '@/lib/format'
import { useDocumentMeta } from '@/lib/meta'
import { cn } from '@/lib/cn'
import { usePincode } from '@/features/delivery/usePincode'

type Variant = ProductDetail['variants'][number]

export function ProductPage() {
  const { slug } = useParams()
  const { data: p, isLoading } = useProduct(slug)
  useDocumentMeta({ title: p?.name, description: p?.short_description ?? undefined, image: p?.images[0]?.url })

  if (isLoading) return <div className="container-x grid gap-8 py-10 md:grid-cols-2"><Skeleton className="aspect-square" /><Skeleton className="h-96" /></div>
  if (!p || !p.is_active) return <EmptyState icon={<PackageX />} title="Product not available">It may have been removed. <Link className="text-gold-700 underline" to="/">Continue shopping</Link></EmptyState>
  return <ProductView p={p} />
}

function optionKeys(variants: Variant[]): string[] {
  const keys: string[] = []
  for (const v of variants) for (const k of Object.keys((v.options ?? {}) as Record<string, string>)) if (!keys.includes(k)) keys.push(k)
  return keys
}

function ProductView({ p }: { p: ProductDetail }) {
  const keys = useMemo(() => optionKeys(p.variants), [p.variants])
  const [variantId, setVariantRaw] = useState(() => (p.variants.find((v) => v.stock > 0) ?? p.variants[0])?.id)
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0]
  const [qty, setQty] = useState(1)
  const setVariantId = (id: string) => { setVariantRaw(id); setQty(1) }
  const [imgIdx, setImgIdx] = useState(0)
  const { add } = useCart()
  const navigate = useNavigate()
  const wish = useWishlistActions()
  const installmentOk = p.installment_eligible ?? p.category?.installment_eligible ?? false
  const { data: inst } = usePublicSetting<{ enabled: boolean; count: number; min_order_total_paise: number }>('installments')

  if (!variant) return <EmptyState title="This product has no options available" />

  const opts = (variant.options ?? {}) as Record<string, string>
  const choose = (key: string, value: string) => {
    const want = { ...opts, [key]: value }
    const exact = p.variants.find((v) => keys.every((k) => (v.options as Record<string, string>)[k] === want[k]))
    const loose = p.variants.find((v) => (v.options as Record<string, string>)[key] === value)
    setVariantId((exact ?? loose)!.id)
  }
  const valuesFor = (key: string): string[] => [...new Set(p.variants.map((v) => (v.options as Record<string, string>)[key]).filter((x): x is string => !!x))]
  const available = (key: string, value: string) =>
    p.variants.some((v) => (v.options as Record<string, string>)[key] === value && v.stock > 0 &&
      keys.filter((k) => k !== key).every((k) => (v.options as Record<string, string>)[k] === opts[k]))

  const addToCart = (buyNow = false) => {
    add({ variant_id: variant.id, quantity: qty, product_name: p.name, variant_name: variant.name, slug: p.slug,
      image_url: p.images[0]?.url ?? null, unit_price_paise: variant.price_paise })
    if (buyNow) navigate('/checkout')
  }
  const images = p.images.length ? p.images : [{ id: 'none', url: '', alt: p.name, sort_order: 0, product_id: p.id }]
  const specs = Object.entries((p.specs ?? {}) as Record<string, string>).filter(([k]) => k !== 'Note')
  const monthly = Math.ceil(variant.price_paise * qty / (inst?.count ?? 6) / 100) * 100

  // Structured data for search results (real price, stock and reviews only)
  const prices = p.variants.map((v) => v.price_paise / 100)
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: variant.sku,
    ...(p.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
    ...(p.short_description ? { description: p.short_description } : {}),
    ...(p.images.length ? { image: p.images.map((i) => new URL(i.url, location.origin).href) } : {}),
    offers: { '@type': 'AggregateOffer', priceCurrency: 'AED', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: p.variants.length,
      availability: p.variants.some((v) => v.stock > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    ...(p.rating_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(p.rating_avg), reviewCount: p.rating_count } } : {}),
  }

  return (
    <div className="container-x py-6 md:py-10">
      <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
      <nav className="mb-5 flex flex-wrap items-center gap-1 text-xs text-navy-600/70" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-gold-700">Home</Link>
        {p.category && <><ChevronRight className="size-3" /><Link to={`/c/${p.category.slug}`} className="hover:text-gold-700">{p.category.name}</Link></>}
        <ChevronRight className="size-3" /><span className="line-clamp-1 text-navy-800">{p.name}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 lg:gap-14 [&>*]:min-w-0">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-navy-100 bg-navy-50">
            {images[imgIdx]?.url && <img src={images[imgIdx]!.url} alt={images[imgIdx]!.alt ?? p.name} className="size-full object-cover" />}
            <button onClick={() => wish.toggle(p.id, !wish.has(p.id))} className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white shadow" aria-label="Wishlist" aria-pressed={wish.has(p.id)}>
              <Heart className={cn('size-5', wish.has(p.id) ? 'fill-gold-500 text-gold-500' : 'text-navy-700')} />
            </button>
          </div>
          {images.length > 1 && (
            <ScrollRow tone="dark" wrapperClassName="mt-3" className="flex gap-3">
              {images.map((im, k) => (
                <button key={im.id} onClick={() => setImgIdx(k)} className={cn('size-16 shrink-0 overflow-hidden rounded-2xl sm:size-20 border-2 bg-navy-50', k === imgIdx ? 'border-gold-500' : 'border-transparent')} aria-label={`Image ${k + 1}`}>
                  <img src={im.url} alt="" className="size-full object-cover" />
                </button>
              ))}
            </ScrollRow>
          )}
        </div>

        <div>
          {p.brand && <p className="eyebrow">{p.brand}</p>}
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-navy-900 sm:text-4xl">{p.name}</h1>
          {p.rating_count > 0 && <a href="#reviews" className="mt-2 inline-flex"><Rating value={Number(p.rating_avg)} count={p.rating_count} size="md" /></a>}
          {p.tags.includes('demo') && <p className="mt-3"><Badge tone="amber">Demo product for testing</Badge></p>}

          <div className="mt-5"><Price paise={variant.price_paise} mrpPaise={variant.mrp_paise} size="lg" /></div>
          <p className="mt-1 text-xs text-navy-600/70">Inclusive of 5% VAT</p>

          {installmentOk && inst?.enabled && variant.price_paise * qty >= (inst.min_order_total_paise ?? 0) && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-gold-400/50 bg-gold-200/30 p-3.5 text-sm">
              <CalendarClock className="size-5 shrink-0 text-gold-700" />
              <p>Or pay <strong>{formatAED(monthly)}/month</strong> for {inst.count} months. <Link to="/installments" className="font-semibold text-gold-700 underline">Check eligibility</Link></p>
            </div>
          )}

          {keys.map((key) => (
            <fieldset key={key} className="mt-6">
              <legend className="mb-2 text-sm font-semibold capitalize text-navy-800">{key}: <span className="font-normal text-navy-700">{opts[key]}</span></legend>
              <div className="flex flex-wrap gap-2">
                {valuesFor(key).map((val) => {
                  const on = opts[key] === val
                  const ok = available(key, val)
                  return (
                    <button key={val} onClick={() => choose(key, val)} aria-pressed={on}
                      className={cn('min-w-12 rounded-full border px-4 py-2 text-sm font-medium transition', on ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-100 bg-white hover:border-gold-500', !ok && !on && 'text-navy-600/40 line-through')}>
                      {val}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
          {keys.length === 0 && p.variants.length > 1 && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold text-navy-800">Option</legend>
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => <button key={v.id} onClick={() => setVariantId(v.id)} aria-pressed={v.id === variant.id} className={cn('rounded-full border px-4 py-2 text-sm', v.id === variant.id ? 'border-navy-900 bg-navy-900 text-white' : 'border-navy-100 bg-white')}>{v.name}</button>)}
              </div>
            </fieldset>
          )}

          <div className="mt-6">
            {variant.stock <= 0 ? <Alert tone="warning">Out of stock in this option.</Alert>
              : variant.stock <= variant.low_stock_threshold ? <p className="text-sm font-semibold text-warning">Only {variant.stock} left</p>
              : <p className="text-sm font-semibold text-success">In stock</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, Math.min(v, variant.stock || 1)))} max={Math.min(20, variant.stock)} />
            <Button size="lg" className="flex-1" disabled={variant.stock <= 0} onClick={() => addToCart()}>Add to bag</Button>
            <Button size="lg" variant="navy" className="flex-1" disabled={variant.stock <= 0} onClick={() => addToCart(true)}>Buy now</Button>
          </div>

          <PincodeChecker />

          <ul className="mt-6 grid gap-3 text-sm text-navy-700 sm:grid-cols-2">
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-gold-600" /> Secure payment by Stripe</li>
            <li className="flex items-center gap-2"><Truck className="size-4 text-gold-600" /> Our own delivery team</li>
          </ul>

          {p.short_description && <p className="mt-6 text-navy-800">{p.short_description}</p>}
        </div>
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] [&>*]:min-w-0">
        <section>
          <h2 className="font-display text-3xl font-semibold text-navy-900">Details</h2>
          {p.description && <p className="mt-3 whitespace-pre-line text-navy-800">{p.description}</p>}
          {specs.length > 0 && (
            <dl className="mt-5 divide-y divide-navy-100 rounded-2xl border border-navy-100 bg-white">
              {specs.map(([k, v]) => <div key={k} className="grid grid-cols-[40%_1fr] gap-4 px-4 py-3 text-sm"><dt className="font-medium text-navy-700">{k}</dt><dd className="text-navy-900">{String(v)}</dd></div>)}
              <div className="grid grid-cols-[40%_1fr] gap-4 px-4 py-3 text-sm"><dt className="font-medium text-navy-700">SKU</dt><dd className="text-navy-900">{variant.sku}</dd></div>
            </dl>
          )}
        </section>
        <Reviews productId={p.id} />
      </div>
      {p.category && <ProductRail eyebrow="You may also like" title={`More in ${p.category.name}`} params={{ category: p.category.slug, sort: 'rating' }} href={`/c/${p.category.slug}`} />}
    </div>
  )
}

function PincodeChecker() {
  const { pincode, setPincode } = usePincode()
  const { data } = usePincodeCheck(pincode)
  return (
    <div className="mt-6 rounded-2xl border border-navy-100 bg-white p-4">
      <div className="flex items-center gap-2">
        <MapPin className="size-5 shrink-0 text-gold-600" />
        <label htmlFor="pin" className="sr-only">Delivery emirate</label>
        <select id="pin" value={pincode ?? ''} onChange={(e) => e.target.value && setPincode(e.target.value)} className="input h-10 flex-1">
          <option value="">Deliver to which emirate?</option>
          {EMIRATES.map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}
        </select>
      </div>
      {pincode && data && (
        <div className="mt-3 text-sm">
          {!data.serviceable ? <p className="text-danger">Sorry, we do not deliver to {emirateName(pincode)} yet.</p> : (
            <>
              <p className="font-semibold text-navy-900">Delivery by {formatDeliveryWindow(data.estimated_min_date, data.estimated_max_date)}</p>
              <p className="text-navy-700">{emirateName(pincode)} · {data.first_order_free ? <span className="font-semibold text-success">Free delivery on your first order</span> : `Delivery ${formatAED(data.standard_fee_paise ?? 1500)}`}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Reviews({ productId }: { productId: string }) {
  const { data, isLoading } = useReviews(productId)
  const { user } = useAuth()
  const toast = useToast()
  const qc = useQueryClient()
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const mine = data?.find((r) => r.is_mine)
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await requireSupabase().from('reviews').insert({ product_id: productId, user_id: user!.id, rating, title: title || null, body: body || null })
      if (error) throw error
    },
    onSuccess: () => { toast('Thank you for your review'); qc.invalidateQueries({ queryKey: ['reviews', productId] }); qc.invalidateQueries({ queryKey: ['product'] }) },
    onError: (e) => toast(friendlyError(e), 'error'),
  })
  return (
    <section id="reviews">
      <h2 className="font-display text-3xl font-semibold text-navy-900">Customer reviews</h2>
      {isLoading ? <Skeleton className="mt-4 h-32" /> : !data?.length ? <p className="mt-3 text-navy-700">No reviews yet.</p> : (
        <ul className="mt-4 space-y-4">
          {data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-navy-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2"><Rating value={r.rating} />{r.is_verified_purchase && <Badge tone="green">Verified purchase</Badge>}</div>
              {r.title && <p className="mt-2 font-semibold text-navy-900">{r.title}</p>}
              {r.body && <p className="mt-1 text-sm text-navy-800">{r.body}</p>}
              <p className="mt-2 text-xs text-navy-600/70">{r.author} · {formatDate(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      {user && !mine && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate() }} className="mt-6 space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <p className="font-semibold text-navy-900">Write a review</p>
          <div className="flex gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((k) => (
              <button type="button" key={k} onClick={() => setRating(k)} role="radio" aria-checked={rating === k} aria-label={`${k} stars`}>
                <Star className={cn('size-7', k <= rating ? 'fill-gold-400 text-gold-400' : 'text-navy-100')} />
              </button>
            ))}
          </div>
          <InputField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          <TextareaField label="Your review" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          <Button type="submit" loading={save.isPending}>Submit review</Button>
        </form>
      )}
      {!user && <p className="mt-4 text-sm"><Link to="/login" className="font-semibold text-gold-700 underline">Sign in</Link> to write a review.</p>}
    </section>
  )
}
