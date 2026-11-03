import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from '@/components/ui/misc'
import { requireSupabase } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { formatDay } from '@/lib/format'
import { useAuth } from '@/features/account/AuthProvider'
import { AdminTitle, Stat, Table, Td } from './ui'

interface Dashboard {
  gross_paid_paise: number; refunded_paise: number; orders_count: number; new_customers: number
  awaiting_approval: number; delayed: number; low_stock: number; overdue_installments: number
  outstanding_installments_paise: number; kyc_manual_review: number; late_payments_needing_refund: number
  daily: { day: string; paid_paise: number; orders: number }[]
  top_products: { product_name: string; units: number; revenue_paise: number }[]
}

export function AdminDashboard() {
  const { hasRole } = useAuth()
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['admin', 'dashboard'],
    enabled: hasRole('operations', 'support', 'collections'),
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('admin_dashboard', {})
      if (error) throw error
      return data as unknown as Dashboard
    },
  })
  if (!hasRole('operations', 'support', 'collections')) return <AdminTitle title="Welcome" subtitle="Open “My deliveries” to see your assigned orders." />
  if (error) return <Alert tone="error">{(error as Error).message}</Alert>
  if (isLoading || !d) return <Skeleton className="h-96" />
  const max = Math.max(1, ...d.daily.map((x) => x.paid_paise))
  return (
    <>
      <AdminTitle title="Dashboard" subtitle="Last 30 days" />
      {d.late_payments_needing_refund > 0 && <div className="mb-4"><Alert tone="warning" title="Refund needed">{d.late_payments_needing_refund} payment(s) arrived after the order closed. Open the order and refund it.</Alert></div>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Payments received" value={formatINR(d.gross_paid_paise)} />
        <Stat label="Refunded" value={formatINR(d.refunded_paise)} />
        <Stat label="Paid orders" value={d.orders_count} />
        <Stat label="New customers" value={d.new_customers} />
        <Link to="/admin/orders?status=awaiting_approval"><Stat label="Awaiting approval" value={d.awaiting_approval} tone={d.awaiting_approval ? 'warn' : undefined} /></Link>
        <Link to="/admin/orders?delayed=1"><Stat label="Delayed orders" value={d.delayed} tone={d.delayed ? 'warn' : undefined} /></Link>
        <Link to="/admin/products?low=1"><Stat label="Low stock variants" value={d.low_stock} tone={d.low_stock ? 'warn' : undefined} /></Link>
        <Stat label="Overdue installments" value={d.overdue_installments} tone={d.overdue_installments ? 'warn' : undefined} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-3 font-semibold text-navy-900">Payments per day</h2>
          <div className="flex h-40 items-end gap-1" role="img" aria-label="Payments per day for the last 30 days">
            {d.daily.map((x) => (
              <div key={x.day} title={`${formatDay(x.day)}: ${formatINR(x.paid_paise)} · ${x.orders} orders`} className="flex-1 rounded-t bg-gold-400/80 hover:bg-gold-500" style={{ height: `${Math.max(2, (x.paid_paise / max) * 100)}%` }} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-semibold text-navy-900">Top products</h2>
          <Table compact head={['Product', 'Units', 'Revenue']} empty={!d.top_products.length}>
            {d.top_products.map((t) => <tr key={t.product_name}><Td>{t.product_name}</Td><Td>{t.units}</Td><Td>{formatINR(t.revenue_paise)}</Td></tr>)}
          </Table>
        </section>
      </div>
    </>
  )
}
