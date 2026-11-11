import { emirateName, isEmirateCode } from '@/lib/emirates'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Skeleton } from '@/components/ui/misc'
import { requireSupabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'
import { AdminTitle, Table, Td, aed, downloadCsv } from './ui'

const FILTERS: [string, string][] = [
  ['', 'All'], ['awaiting_approval', 'Awaiting approval'], ['order_confirmed', 'Confirmed'], ['processing', 'Processing'],
  ['packed', 'Packed'], ['dispatched', 'Dispatched'], ['out_for_delivery', 'Out for delivery'], ['delivery_failed', 'Failed attempts'],
  ['payment_pending', 'Payment pending'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['return_requested', 'Returns'],
]

export function AdminOrders() {
  const [sp, setSp] = useSearchParams()
  const status = sp.get('status') ?? ''
  const delayed = sp.get('delayed') === '1'
  const q = sp.get('q') ?? ''
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', status, delayed, q],
    queryFn: async () => {
      let query = requireSupabase().from('orders')
        .select('id, order_number, status, total_paise, amount_paid_paise, payment_mode, pincode, is_delayed, created_at, shipping_address')
        .order('created_at', { ascending: false }).limit(500)
      if (status) query = query.eq('status', status as OrderStatus)
      if (delayed) query = query.eq('is_delayed', true)
      const term = q.replace(/[,()%]/g, ' ').trim()
      if (term) query = isEmirateCode(term.toUpperCase()) ? query.eq('pincode', term.toUpperCase()) : query.or(`order_number.ilike.%${term}%,shipping_address->>recipient_name.ilike.%${term}%,shipping_address->>phone.ilike.%${term}%`)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }) }

  return (
    <>
      <AdminTitle title="Orders">
        <input className="input h-9 w-64" placeholder="Order no., name, phone or emirate (DXB)" defaultValue={q} onKeyDown={(e) => e.key === 'Enter' && set('q', (e.target as HTMLInputElement).value.trim())} aria-label="Search orders" />
        <button type="button" className="pill pill-light" disabled={!data?.length} onClick={() => data && downloadCsv('sanjaya-orders.csv', ['Order', 'Placed', 'Customer', 'Phone', 'Emirate', 'Total (AED)', 'Paid (AED)', 'Payment', 'Status', 'Delayed'],
          data.map((o) => { const a = o.shipping_address as { recipient_name?: string; phone?: string }; return [o.order_number, o.created_at, a.recipient_name, a.phone, emirateName(o.pincode), (o.total_paise / 100).toFixed(2), (o.amount_paid_paise / 100).toFixed(2), o.payment_mode, STATUS_LABEL[o.status], o.is_delayed ? 'yes' : ''] }))}>Export CSV</button>
      </AdminTitle>
      <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map(([v, l]) => (
          <button key={v} onClick={() => set('status', v)} className={`pill ${status === v && !delayed ? 'pill-dark' : 'pill-ghost'}`}>{l}</button>
        ))}
        <button onClick={() => set('delayed', delayed ? '' : '1')} className={`pill ${delayed ? 'pill-red' : 'pill-ghost'}`}>Delayed</button>
      </div>
      {isLoading ? <Skeleton className="h-64" /> : (
        <Table head={['Order', 'Placed', 'Customer', 'Emirate', 'Total', 'Status']} empty={!data?.length}>
          {data?.map((o) => (
            <tr key={o.id} >
              <Td><Link to={`/admin/orders/${o.id}`} className="font-semibold text-navy-900 hover:text-gold-700">{o.order_number}</Link>{o.payment_mode === 'installment' && <Badge tone="gold" className="ml-2">6×</Badge>}</Td>
              <Td>{formatDateTime(o.created_at)}</Td>
              <Td>{(o.shipping_address as { recipient_name?: string }).recipient_name}</Td>
              <Td>{emirateName(o.pincode)}</Td>
              <Td>{aed(o.total_paise)}{o.amount_paid_paise < o.total_paise && o.amount_paid_paise > 0 && <span className="block text-xs text-navy-600">paid {aed(o.amount_paid_paise)}</span>}</Td>
              <Td><Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>{o.is_delayed && <Badge tone="red" className="ml-1">Delayed</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}
