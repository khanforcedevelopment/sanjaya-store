import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock } from 'lucide-react'
import { Alert, Badge, EmptyState, Skeleton } from '@/components/ui/misc'
import { ButtonLink } from '@/components/ui/Button'
import { requireSupabase, supabase } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { formatDateTime, formatDeliveryWindow } from '@/lib/format'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import { useDocumentMeta } from '@/lib/meta'

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    enabled: !!supabase && !!id,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('orders').select('*, order_items(*)').eq('id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function OrderPlacedPage() {
  const { id } = useParams()
  const { data: o, isLoading } = useOrder(id)
  useDocumentMeta({ title: o ? `Order ${o.order_number}` : 'Order', noindex: true })

  if (isLoading) return <div className="container-x py-10"><Skeleton className="h-64" /></div>
  if (!o) return <div className="container-x py-10"><EmptyState title="Order not found">This order does not exist or belongs to another account.</EmptyState></div>

  const addr = o.shipping_address as Record<string, string>
  return (
    <div className="container-x max-w-3xl py-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <h1 className="mt-3 font-display text-4xl font-semibold text-navy-900">Order placed</h1>
        <p className="mt-1 text-navy-700">Order number <strong>{o.order_number}</strong> · <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge></p>
      </div>
      {o.status === 'payment_pending' && (
        <div className="mt-6">
          <Alert tone="warning" title="Payment pending">
            <span className="flex items-center gap-1"><Clock className="size-4" /> We hold your items{o.payment_expires_at ? ` until ${formatDateTime(o.payment_expires_at)}` : ""}. Pay {formatINR(o.total_paise)} by card to confirm the order.</span>
          </Alert>
        </div>
      )}
      <div className="card mt-6 divide-y divide-navy-100">
        {o.order_items.map((i) => (
          <div key={i.id} className="flex items-center gap-4 p-4">
            <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-navy-50">{i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}</div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-semibold text-navy-900">{i.product_name}</p>
              <p className="text-sm text-navy-600/80">{i.variant_name} · Qty {i.quantity}</p>
            </div>
            <p className="font-semibold">{formatINR(i.line_total_paise)}</p>
          </div>
        ))}
        <dl className="space-y-1 p-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(o.subtotal_paise)}</dd></div>
          {o.discount_paise > 0 && <div className="flex justify-between text-success"><dt>Discount {o.coupon_code}</dt><dd>− {formatINR(o.discount_paise)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{o.delivery_fee_paise ? formatINR(o.delivery_fee_paise) : 'FREE'}</dd></div>
          <div className="flex justify-between text-base font-bold text-navy-900"><dt>Total</dt><dd>{formatINR(o.total_paise)}</dd></div>
        </dl>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="card p-4 text-sm">
          <p className="eyebrow mb-2">Delivering to</p>
          <p className="font-semibold">{addr.recipient_name} · {addr.phone}</p>
          <p>{addr.house}, {addr.street}</p>
          <p>{addr.city}, {addr.state} {addr.pincode}</p>
        </div>
        <div className="card p-4 text-sm">
          <p className="eyebrow mb-2">What happens next</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Pay by card to confirm.</li>
            <li>Our team checks and approves your order.</li>
            <li>Dispatched from Mumbai{o.estimated_min_date ? `, arriving ${formatDeliveryWindow(o.estimated_min_date, o.estimated_max_date)}` : ''}.</li>
          </ol>
        </div>
      </div>
      <div className="mt-8 flex justify-center gap-3"><ButtonLink to="/" variant="outline">Continue shopping</ButtonLink></div>
    </div>
  )
}
