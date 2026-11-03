import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert, EmptyState, PageTitle, Price } from '@/components/ui/misc'
import { InputField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { useCart } from '@/features/cart/CartProvider'
import { toLines } from '@/features/cart/cartStore'
import { useQuote } from '@/features/cart/useQuote'
import { QuantityStepper } from '@/features/cart/QuantityStepper'
import { OrderSummary } from '@/features/cart/OrderSummary'
import { usePincode } from '@/features/delivery/usePincode'
import { useDocumentMeta } from '@/lib/meta'
import { useState } from 'react'

export function CartPage() {
  useDocumentMeta({ title: 'Your bag', noindex: true })
  const { items, setQty, remove, coupon, setCoupon } = useCart()
  const { user } = useAuth()
  const { pincode, setPincode } = usePincode()
  const [pinDraft, setPinDraft] = useState(pincode ?? '')
  const quote = useQuote(toLines(items), pincode, coupon, user?.id)
  const q = quote.data
  const navigate = useNavigate()
  const line = (id: string) => q?.lines.find((l) => l.variant_id === id)

  if (!items.length) {
    return (
      <div className="container-x py-12">
        <EmptyState icon={<ShoppingBag />} title="Your bag is empty" action={<ButtonLink to="/">Start shopping</ButtonLink>}>Discover phones, fashion, watches and more.</EmptyState>
      </div>
    )
  }

  return (
    <div className="container-x py-8">
      <PageTitle title="Your bag" subtitle={`${items.reduce((n, i) => n + i.quantity, 0)} items`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          {q?.errors.map((e) => <Alert key={e} tone="warning">{e}</Alert>)}
          <ul className="card divide-y divide-navy-100">
            {items.map((i) => {
              const l = line(i.variant_id)
              return (
                <li key={i.variant_id} className="flex gap-4 p-4">
                  <Link to={`/p/${i.slug}`} className="size-24 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                    {i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/p/${i.slug}`} className="line-clamp-2 font-semibold text-navy-900 hover:text-gold-700">{i.product_name}</Link>
                    <p className="text-sm text-navy-600/80">{i.variant_name}</p>
                    {l && !l.in_stock && <p className="text-sm font-semibold text-danger">Not enough stock</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <QuantityStepper value={i.quantity} onChange={(v) => setQty(i.variant_id, v)} />
                      <Price paise={(l?.unit_price_paise ?? i.unit_price_paise) * i.quantity} mrpPaise={l?.mrp_paise ? l.mrp_paise * i.quantity : null} />
                    </div>
                  </div>
                  <button onClick={() => remove(i.variant_id)} className="self-start text-navy-600/50 hover:text-danger" aria-label={`Remove ${i.product_name}`}><Trash2 className="size-5" /></button>
                </li>
              )
            })}
          </ul>
          <form className="card flex items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); if (/^[1-9][0-9]{5}$/.test(pinDraft)) setPincode(pinDraft) }}>
            <InputField className="flex-1" label="Delivery pincode" inputMode="numeric" maxLength={6} value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
              error={q?.delivery.pincode && !q.delivery.serviceable ? 'We do not deliver to this pincode yet.' : null} />
            <Button type="submit" variant="outline">Check</Button>
          </form>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OrderSummary quote={q} coupon={coupon} onCoupon={setCoupon} loading={quote.isFetching}>
            <Button size="lg" className="w-full" disabled={!q || !!q.errors.length} onClick={() => navigate(user ? '/checkout' : '/login?next=/checkout')}>
              {user ? 'Proceed to checkout' : 'Sign in to checkout'}
            </Button>
          </OrderSummary>
        </aside>
      </div>
    </div>
  )
}
