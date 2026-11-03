import { useQuery } from '@tanstack/react-query'
import { KeyRound, Truck } from 'lucide-react'
import { Alert } from '@/components/ui/misc'
import { requireSupabase } from '@/lib/supabase'
import { formatDateTime, formatDeliveryWindow } from '@/lib/format'
import { STATUS_LABEL, TRACK_STEPS, trackStepIndex } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'
import { cn } from '@/lib/cn'

const SHOW_CODE: OrderStatus[] = ['dispatched', 'in_transit', 'out_for_delivery', 'delivery_failed']
const VISIBLE_STEPS = TRACK_STEPS.filter((s) => s !== 'order_placed')

type Order = { id: string; status: OrderStatus; is_delayed: boolean; estimated_min_date: string | null; estimated_max_date: string | null }

/** Progress bar, timeline and the 4-digit door code for the customer's own order. */
export function OrderTracking({ order: o }: { order: Order }) {
  const db = requireSupabase()
  const { data } = useQuery({
    queryKey: ['order', o.id, 'tracking', o.status],
    queryFn: async () => {
      const [ev, code] = await Promise.all([
        db.from('order_status_events').select('id, status, note, created_at').eq('order_id', o.id).eq('is_customer_visible', true).order('created_at', { ascending: false }).order('id', { ascending: false }),
        SHOW_CODE.includes(o.status) ? db.from('order_delivery_codes').select('code').eq('order_id', o.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      return { events: ev.data ?? [], code: (code.data as { code: string } | null)?.code ?? null }
    },
    refetchInterval: SHOW_CODE.includes(o.status) ? 60_000 : false,
  })
  const closed = o.status === 'cancelled' || o.status === 'refunded' || o.status === 'returned'
  const at = trackStepIndex(o.status)

  return (
    <section className="card mt-6 p-5" aria-label="Order tracking">
      <p className="eyebrow mb-3 flex items-center gap-1.5"><Truck className="size-4" /> Tracking</p>
      {!closed && (
        <ol className="grid grid-cols-6 gap-1" aria-label="Progress">
          {VISIBLE_STEPS.map((s) => {
            const done = trackStepIndex(s) <= at
            return (
              <li key={s} className="text-center">
                <span className={cn('block h-1.5 rounded-full', done ? 'bg-gold-500' : 'bg-navy-100')} />
                <span className={cn('mt-1.5 block text-[11px] leading-tight', done ? 'font-semibold text-navy-900' : 'text-navy-600/70')}>{STATUS_LABEL[s]}</span>
              </li>
            )
          })}
        </ol>
      )}
      {o.estimated_min_date && !closed && o.status !== 'delivered' && (
        <p className="mt-4 text-sm">Expected delivery: <strong>{formatDeliveryWindow(o.estimated_min_date, o.estimated_max_date)}</strong></p>
      )}
      {o.is_delayed && o.status !== 'delivered' && <div className="mt-3"><Alert tone="warning" title="Your order is delayed">We are sorry. The latest update below explains why and the new date.</Alert></div>}
      {data?.code && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-gold-400/60 bg-gold-200/40 p-3">
          <KeyRound className="size-6 shrink-0 text-gold-700" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-700">Delivery code</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em] text-navy-950">{data.code}</p>
            <p className="text-xs text-navy-700">Share this code with our delivery partner only when you receive the parcel.</p>
          </div>
        </div>
      )}
      {data && data.events.length > 0 && (
        <ol className="mt-5 space-y-3 border-l border-navy-100 pl-4">
          {data.events.map((e) => (
            <li key={e.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-gold-500" />
              <p className="font-semibold text-navy-900">{STATUS_LABEL[e.status as OrderStatus]} <span className="font-normal text-navy-600/80">· {formatDateTime(e.created_at)}</span></p>
              {e.note && <p className="text-navy-700">{e.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
