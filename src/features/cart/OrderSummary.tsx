import { useState, type FormEvent, type ReactNode } from 'react'
import { Tag, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/misc'
import { formatINR } from '@/lib/money'
import { formatDeliveryWindow } from '@/lib/format'
import type { Quote } from '@/lib/types'

/** Price breakdown shared by the bag and checkout. Every number comes from the server quote. */
export function OrderSummary({ quote, coupon, onCoupon, loading, children }: {
  quote?: Quote; coupon: string; onCoupon: (code: string) => void; loading?: boolean; children?: ReactNode
}) {
  const [draft, setDraft] = useState('')
  const apply = (e: FormEvent) => { e.preventDefault(); if (draft.trim()) onCoupon(draft.trim().toUpperCase()) }
  const d = quote?.delivery
  const couponOk = coupon && quote?.coupon.coupon_id && !quote.coupon.error

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-display text-2xl font-semibold text-navy-900">Order summary</h2>
      {coupon ? (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-gold-400 bg-gold-200/20 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 font-semibold"><Tag className="size-4 text-gold-600" /> {coupon}</span>
          <button onClick={() => { onCoupon(''); setDraft('') }} aria-label="Remove coupon" className="text-navy-600 hover:text-danger"><X className="size-4" /></button>
        </div>
      ) : (
        <form onSubmit={apply} className="flex gap-2">
          <label htmlFor="coupon" className="sr-only">Coupon code</label>
          <input id="coupon" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Coupon code" className="input h-10 flex-1 uppercase" maxLength={30} />
          <Button type="submit" variant="outline" size="sm" className="h-10">Apply</Button>
        </form>
      )}
      {coupon && quote?.coupon.error && <Alert tone="warning">{quote.coupon.error}</Alert>}

      <dl className="space-y-2 text-sm">
        <Row label="Subtotal" value={quote ? formatINR(quote.subtotal_paise) : '…'} />
        {couponOk && quote!.discount_paise > 0 && <Row label={`Coupon ${coupon}`} value={`− ${formatINR(quote!.discount_paise)}`} tone="text-success" />}
        <Row label="Delivery" value={!quote ? '…' : !d?.pincode ? 'Enter pincode' : !d.serviceable ? 'Not available' : quote.delivery_fee_paise === 0 ? 'FREE' : formatINR(quote.delivery_fee_paise)}
          tone={quote?.delivery_fee_paise === 0 && d?.serviceable ? 'text-success font-semibold' : undefined} />
        {d?.first_order_free && d.serviceable && <p className="text-xs text-success">Free delivery on your first order.</p>}
        {d?.first_order_assumed && <p className="text-xs text-navy-600/70">Sign in to confirm first-order free delivery.</p>}
        <div className="gold-rule my-2" />
        <Row label="Total" value={quote ? formatINR(quote.total_paise) : '…'} bold />
      </dl>
      {d?.serviceable && d.estimated_min_date && (
        <p className="text-sm text-navy-700">Estimated delivery <strong>{formatDeliveryWindow(d.estimated_min_date, d.estimated_max_date)}</strong>{d.is_remote ? ' (remote area)' : ''}</p>
      )}
      {loading && <p className="text-xs text-navy-600/60">Updating prices…</p>}
      {children}
    </div>
  )
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: string }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold text-navy-900' : 'text-navy-800'}`}>
      <dt>{label}</dt><dd className={tone}>{value}</dd>
    </div>
  )
}
