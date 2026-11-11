import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search } from 'lucide-react'
import { Alert, Badge, Skeleton } from '@/components/ui/misc'
import { requireSupabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import { useAuth } from '@/features/account/AuthProvider'
import { AdminTitle, Bars, Panel, ProgressBar, Seg, Stat, Table, Td, aed, aedShort, pctChange } from './ui'

export interface Overview {
  days: number; revenue_paise: number; prev_revenue_paise: number; orders: number; prev_orders: number
  new_customers: number; prev_new_customers: number; refunds_paise: number; prev_refunds_paise: number
  month_revenue_paise: number; monthly_target_paise: number; split: { full: number; installment: number }
  awaiting_approval: number; delayed: number; low_stock: number; late_payments_needing_refund: number
  daily: { day: string; sales_paise: number; cost_paise: number; orders: number }[]
}

const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Dubai' }).format(new Date()))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
const shortDay = (d: string) => new Date(`${d}T12:00:00+04:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })

export function AdminDashboard() {
  const { hasRole, profile } = useAuth()
  const [days, setDays] = useState<7 | 30>(30)
  const allowed = hasRole('operations', 'support', 'collections')
  const { data: d, isLoading, error } = useQuery({
    queryKey: ['admin', 'overview', days],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('admin_overview', { p_days: days })
      if (error) throw error
      return data as unknown as Overview
    },
  })
  if (!allowed) return <AdminTitle title="Welcome" subtitle="Open “My deliveries” to see your assigned orders." />
  if (error) return <Alert tone="error">{(error as Error).message}</Alert>
  const name = profile?.full_name?.split(' ')[0] || 'Sanjaya'

  return (
    <>
      <AdminTitle title={`${greeting()}, ${name}`} subtitle="Here is how the store is doing.">
        <Seg label="Period" value={days} onChange={setDays} options={[[7, '7 days'], [30, '30 days']]} />
      </AdminTitle>
      {!d || isLoading ? <Skeleton className="h-[560px] rounded-[22px] bg-white/40" /> : <OverviewBody d={d} />}
    </>
  )
}

function OverviewBody({ d }: { d: Overview }) {
  const { hasRole } = useAuth()
  const target = d.monthly_target_paise
  const pct = target > 0 ? (d.month_revenue_paise / target) * 100 : 0
  const avg = d.orders ? Math.round(d.revenue_paise / d.orders) : 0
  const prevAvg = d.prev_orders ? Math.round(d.prev_revenue_paise / d.prev_orders) : 0
  const splitTotal = d.split.full + d.split.installment
  const sales = d.daily.reduce((n, x) => n + x.sales_paise, 0)
  const profit = d.daily.reduce((n, x) => n + Math.max(0, x.sales_paise - x.cost_paise), 0)
  const hasCost = d.daily.some((x) => x.cost_paise > 0)

  return (
    <div className="space-y-4">
      {d.late_payments_needing_refund > 0 && <Alert tone="warning" title="Refund needed">{d.late_payments_needing_refund} payment(s) arrived after the order closed. Open the order and refund it.</Alert>}
      {(d.awaiting_approval > 0 || d.delayed > 0 || d.low_stock > 0) && (
        <div className="flex flex-wrap gap-2">
          {d.awaiting_approval > 0 && <Link to="/admin/orders?status=awaiting_approval" className="pill pill-dark">{d.awaiting_approval} awaiting approval</Link>}
          {d.delayed > 0 && <Link to="/admin/orders?delayed=1" className="pill pill-red">{d.delayed} delayed</Link>}
          {d.low_stock > 0 && hasRole('operations') && <Link to="/admin/products?stock=low" className="pill pill-light">{d.low_stock} low-stock variants</Link>}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold muted">Total revenue · last {d.days} days</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="big-num text-4xl sm:text-5xl">{aed(d.revenue_paise)}</p>
              </div>
              {pctChange(d.revenue_paise, d.prev_revenue_paise) != null && (
                <p className="mt-1 text-xs muted">vs previous {d.days} days: <DeltaText cur={d.revenue_paise} prev={d.prev_revenue_paise} /></p>
              )}
            </div>
            {hasRole('operations') && (
              <div className="flex gap-2">
                <Link to="/admin/products/new" className="pill pill-dark"><Plus className="size-4" /> Add product</Link>
                <Link to="/admin/orders" className="pill pill-light"><FileText className="size-4" /> Invoice</Link>
              </div>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[['Paid in full', d.split.full, 'var(--black)'], ['Six installments', d.split.installment, 'var(--yellow)']].map(([l, v, c]) => (
              <div key={l as string} className="card p-3">
                <p className="flex items-center gap-1.5 text-xs muted"><span className="size-2 rounded-full" style={{ background: c as string }} />{l}</p>
                <p className="mt-1 text-lg font-bold">{aedShort(v as number)}</p>
                <p className="text-[11px] muted">{splitTotal ? Math.round(((v as number) / splitTotal) * 100) : 0}% of sales</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-semibold">Monthly target</span>
              <span className="muted">{aedShort(d.month_revenue_paise)} of {target ? aedShort(target) : 'not set'}{target ? ` · ${Math.round(pct)}%` : ''}</span>
            </div>
            <ProgressBar value={pct} color="linear-gradient(90deg, var(--green1), var(--green2))" label="Monthly target progress" />
            {!target && hasRole('super_admin') && <Link to="/admin/settings" className="mt-1 inline-block text-xs font-semibold underline">Set a target</Link>}
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3">
          <Stat green label="Orders" value={d.orders.toLocaleString('en-GB')} delta={pctChange(d.orders, d.prev_orders)} sub={`last ${d.days} days`} />
          <Stat label="Avg order" value={aed(avg)} delta={pctChange(avg, prevAvg)} />
          <Stat label="New customers" value={d.new_customers.toLocaleString('en-GB')} delta={pctChange(d.new_customers, d.prev_new_customers)} />
          <Stat label="Refunds" value={aed(d.refunds_paise)} delta={pctChange(d.refunds_paise, d.prev_refunds_paise)} />
        </div>
      </div>

      <Panel title="Sales & profit" action={
        <div className="flex gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#141414]" />Profit {hasCost ? aedShort(profit) : ''}</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-[#f4c534]" />Cost</span>
          <span className="muted">Sales {aedShort(sales)}</span>
        </div>
      }>
        <Bars label={`Sales and profit per day, last ${d.days} days`} format={aed} colors={['#141414', '#f4c534']}
          data={d.daily.map((x) => ({ key: x.day, label: shortDay(x.day), parts: [Math.max(0, x.sales_paise - x.cost_paise), Math.min(x.sales_paise, x.cost_paise)] }))} />
        {!hasCost && <p className="mt-2 text-xs muted">Profit shows sales until cost prices are added. Add them with Products → select → Bulk edit → Cost price.</p>}
      </Panel>

      <RecentOrders />
    </div>
  )
}

function DeltaText({ cur, prev }: { cur: number; prev: number }) {
  const p = pctChange(cur, prev)
  if (p == null) return null
  return <strong className={p >= 0 ? 'text-[#0f8f62]' : 'text-[#c23a22]'}>{p >= 0 ? '+' : ''}{p.toFixed(1)}%</strong>
}

function RecentOrders() {
  const [q, setQ] = useState('')
  const { hasRole } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'recent-orders', q],
    enabled: hasRole('operations', 'support'),
    queryFn: async () => {
      let query = requireSupabase().from('orders').select('id, order_number, status, total_paise, created_at, shipping_address, is_delayed')
        .order('created_at', { ascending: false }).limit(8)
      const term = q.trim().replace(/[,()%]/g, ' ')
      if (term) query = query.or(`order_number.ilike.%${term}%,shipping_address->>recipient_name.ilike.%${term}%`)
      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
  if (!hasRole('operations', 'support')) return null
  return (
    <Panel title="Recent orders" action={
      <div className="flex items-center gap-2">
        <label className="flex h-9 items-center gap-2 rounded-full bg-white/60 px-3">
          <Search className="size-4 muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order no. or name" aria-label="Search recent orders" className="w-40 bg-transparent text-sm outline-none" />
        </label>
        <Link to="/admin/orders" className="pill pill-light">All orders</Link>
      </div>
    }>
      {isLoading ? <Skeleton className="h-40 bg-white/40" /> : (
        <Table head={['Order', 'Customer', 'Placed', 'Total', 'Status']} empty={!data?.length}>
          {data?.map((o) => (
            <tr key={o.id}>
              <Td><Link to={`/admin/orders/${o.id}`} className="font-semibold hover:underline">{o.order_number}</Link></Td>
              <Td>{(o.shipping_address as { recipient_name?: string }).recipient_name}</Td>
              <Td>{formatDateTime(o.created_at)}</Td>
              <Td>{aed(o.total_paise)}</Td>
              <Td><Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>{o.is_delayed && <Badge tone="red" className="ml-1">Delayed</Badge>}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Panel>
  )
}
