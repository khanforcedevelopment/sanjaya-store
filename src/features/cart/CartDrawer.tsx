import { business } from '@/config/business'
import { Link, useNavigate } from 'react-router-dom'
import { ShoppingBag, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Alert, EmptyState } from '@/components/ui/misc'
import { formatAED } from '@/lib/money'
import { useAuth } from '@/features/account/AuthProvider'
import { useCart } from './CartProvider'
import { toLines } from './cartStore'
import { useQuote } from './useQuote'
import { QuantityStepper } from './QuantityStepper'

export function CartDrawer() {
  const { items, drawerOpen, setDrawerOpen, setQty, remove } = useCart()
  const { user } = useAuth()
  const quote = useQuote(toLines(items), null, null, user?.id)
  const navigate = useNavigate()
  const close = () => setDrawerOpen(false)
  const q = quote.data
  const priceOf = (variantId: string, fallback: number) => q?.lines.find((l) => l.variant_id === variantId)?.unit_price_paise ?? fallback

  return (
    <Sheet open={drawerOpen} onClose={close} title="Your bag">
      {items.length === 0 ? (
        <EmptyState icon={<ShoppingBag />} title="Your bag is empty" action={<ButtonLink to="/" onClick={close}>Start shopping</ButtonLink>}>
          Discover phones, fashion, watches and more.
        </EmptyState>
      ) : (
        <div className="flex h-full flex-col">
          <ul className="flex-1 divide-y divide-navy-100 px-5">
            {items.map((i) => (
              <li key={i.variant_id} className="flex gap-4 py-4">
                <Link to={`/p/${i.slug}`} onClick={close} className="size-20 shrink-0 overflow-hidden rounded-xl bg-navy-50">
                  {i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/p/${i.slug}`} onClick={close} className="line-clamp-2 text-sm font-semibold text-navy-900 hover:text-gold-700">{i.product_name}</Link>
                  <p className="text-xs text-navy-600/70">{i.variant_name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <QuantityStepper value={i.quantity} onChange={(v) => setQty(i.variant_id, v)} />
                    <span className="text-sm font-bold">{formatAED(priceOf(i.variant_id, i.unit_price_paise) * i.quantity)}</span>
                  </div>
                </div>
                <button onClick={() => remove(i.variant_id)} className="self-start text-navy-600/50 hover:text-danger" aria-label={`Remove ${i.product_name}`}><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ul>
          <div className="space-y-3 border-t border-navy-100 bg-ivory p-5">
            {q?.errors.map((e) => <Alert key={e} tone="warning">{e}</Alert>)}
            <div className="flex justify-between text-sm"><span>Subtotal</span><span className="font-bold">{q ? formatAED(q.subtotal_paise) : '…'}</span></div>
            <p className="text-xs text-navy-600/70">
              {q?.delivery.first_order_free ? 'Delivery is free on your first order.' : `Delivery ${business.deliveryFeeLabel}.`} Coupons and delivery are applied at checkout.
            </p>
            <Button className="w-full" size="lg" onClick={() => { close(); navigate('/checkout') }} disabled={!!q?.errors.length}>Checkout</Button>
            <ButtonLink to="/cart" variant="outline" className="w-full" onClick={close}>View bag</ButtonLink>
          </div>
        </div>
      )}
    </Sheet>
  )
}
