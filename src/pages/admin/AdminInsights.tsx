import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Alert, Skeleton } from '@/components/ui/misc'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { formatDate } from '@/lib/format'
import { useAuth } from '@/features/account/AuthProvider'
import { AdminTitle, Bars, colorAt, Donut, LineChart, Panel, ProgressBar, Ring, Seg, Stat, Table, Td, aed, aedShort, downloadCsv } from './ui'

const rpc = async <T,>(fn: string, args: Record<string, unknown> = {}) => {
  const { data, error } = await requireSupabase().rpc(fn as never, args as never)
  if (error) throw error
  return data as unknown as T
}
const Loading = () => <Skeleton className="h-[420px] rounded-[22px] bg-white/40" />
const weekday = (d: string) => new Date(`${d}T12:00:00+04:00`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Dubai' })

// ---------------------------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------------------------
type StockData = {
  stock_value_paise: number; stock_cost_paise: number; units: number; variants: number; out_of_stock: number; low_stock: number
  week: { day: string; units: number }[]
  categories: { id: string; name: string; slug: string; products: number; variants: number; in_stock: number; low: number; units: number }[]
}

export function AdminStock() {
  const { data: d, error } = useQuery({ queryKey: ['admin', 'stock'], queryFn: () => rpc<StockData>('admin_stock_overview') })
  if (error) return <Alert tone="error">{friendlyError(error)}</Alert>
  return (
    <>
      <AdminTitle title="Stock" subtitle="What is on the shelf, what sells and what to restock.">
        <Link to="/admin/products" className="pill pill-light">All products</Link>
        <Link to="/admin/import" className="pill pill-dark">Import stock CSV</Link>
      </AdminTitle>
      {!d ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat green label="Stock value (selling price)" value={aedShort(d.stock_value_paise)} sub={`${d.units.toLocaleString('en-GB')} units on hand`} />
            <Stat label="Stock at cost" value={d.stock_cost_paise ? aedShort(d.stock_cost_paise) : '—'} sub={d.stock_cost_paise ? undefined : 'Add cost prices with bulk edit'} />
            <Link to="/admin/products?stock=low"><Stat label="Low stock" value={d.low_stock} tone={d.low_stock ? 'warn' : undefined} sub="variants · tap to see" /></Link>
            <Link to="/admin/products?stock=out"><Stat label="Out of stock" value={d.out_of_stock} tone={d.out_of_stock ? 'warn' : undefined} sub="variants · tap to see" /></Link>
          </div>
          <Panel title="Units sold this week" action={<span className="text-xs muted">Today in red</span>}>
            <Bars label="Units sold per day, last 7 days" format={(n) => `${n} units`} colors={['#141414']} highlightLast="#f0533a" height={160}
              data={d.week.map((w) => ({ key: w.day, label: weekday(w.day), parts: [w.units] }))} />
          </Panel>
          <Panel title="Categories" action={<span className="text-xs muted">Ring = variants in stock</span>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {d.categories.map((c) => {
                const pct = c.variants ? (c.in_stock / c.variants) * 100 : 0
                return (
                  <div key={c.id} className="card lift flex flex-col items-center p-4 text-center">
                    <Ring value={pct} color={pct < 60 ? 'var(--red)' : pct < 85 ? 'var(--orange)' : 'var(--green2)'}>
                      <span className="text-lg font-extrabold">{Math.round(pct)}%</span>
                    </Ring>
                    <p className="mt-2 line-clamp-1 font-bold">{c.name}</p>
                    <p className="text-xs muted">{c.products.toLocaleString('en-GB')} products · {c.units.toLocaleString('en-GB')} units</p>
                    {c.low > 0 && <p className="text-xs font-semibold text-[#c23a22]">{c.low} low</p>}
                    <Link to={`/admin/products?cat=${c.id}&stock=low`} className="pill pill-dark mt-3 !h-8 !px-3 text-xs">Restock</Link>
                  </div>
                )
              })}
              <Link to="/admin/import" className="card lift grid min-h-[200px] place-items-center p-4 text-center !border-dashed">
                <span><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#141414] text-white"><Plus /></span><span className="mt-2 block font-bold">Add category</span><span className="text-xs muted">via CSV import (category_slug)</span></span>
              </Link>
            </div>
          </Panel>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------------------------
type Customers = { total_customers: number; with_orders: number; rows: { id: string; full_name: string | null; phone: string | null; joined_at: string; orders: number; spent_paise: number; last_order_at: string }[] }

export function AdminCustomers() {
  const { data: d, error } = useQuery({ queryKey: ['admin', 'customers'], queryFn: () => rpc<Customers>('admin_top_customers', { p_limit: 50 }) })
  if (error) return <Alert tone="error">{friendlyError(error)}</Alert>
  const top = d?.rows[0]?.spent_paise ?? 0
  return (
    <>
      <AdminTitle title="Customers" subtitle="Top customers by spend.">
        {d && d.rows.length > 0 && <button type="button" className="pill pill-light" onClick={() => downloadCsv('sanjaya-top-customers.csv', ['Name', 'Phone', 'Orders', 'Spent (AED)', 'Last order', 'Joined'],
          d.rows.map((c) => [c.full_name, c.phone, c.orders, (c.spent_paise / 100).toFixed(2), formatDate(c.last_order_at), formatDate(c.joined_at)]))}>Export CSV</button>}
      </AdminTitle>
      {!d ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat green label="Customers" value={d.total_customers.toLocaleString('en-GB')} />
            <Stat label="Have ordered" value={d.with_orders.toLocaleString('en-GB')} sub={d.total_customers ? `${Math.round((d.with_orders / d.total_customers) * 100)}% of customers` : undefined} />
            <Stat label="Best customer" value={top ? aed(top) : '—'} sub={d.rows[0]?.full_name ?? undefined} />
          </div>
          <Table head={['Customer', 'Orders', 'Spent', 'Share of top', 'Last order']} empty={!d.rows.length}>
            {d.rows.map((c) => (
              <tr key={c.id}>
                <Td><p className="font-semibold">{c.full_name || 'Customer'}</p><p className="text-xs muted">{c.phone}</p></Td>
                <Td>{c.orders}</Td>
                <Td className="font-semibold">{aed(c.spent_paise)}</Td>
                <Td className="w-48"><ProgressBar value={top ? (c.spent_paise / top) * 100 : 0} label={`${c.full_name ?? 'Customer'} spend`} /></Td>
                <Td>{formatDate(c.last_order_at)}</Td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------
type Period = 'week' | 'month' | 'year'
type Reports = {
  period: Period; delivery_fees_paise: number; discounts_paise: number; costed_share: number | null
  series: { bucket: string; revenue_paise: number; cost_paise: number; refunds_paise: number }[]
  by_category: { name: string; revenue_paise: number; units: number }[]
}

export function AdminReports() {
  const { hasRole } = useAuth()
  const [period, setPeriod] = useState<Period>('month')
  const { data: d, error } = useQuery({ queryKey: ['admin', 'reports', period], enabled: hasRole('operations'), queryFn: () => rpc<Reports>('admin_reports', { p_period: period }) })
  if (error) return <Alert tone="error">{friendlyError(error)}</Alert>
  const label = (b: string) => new Date(`${b}T12:00:00+04:00`).toLocaleDateString('en-GB', period === 'year' ? { month: 'short', timeZone: 'Asia/Dubai' } : { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' })
  const revenue = d?.series.reduce((n, x) => n + x.revenue_paise, 0) ?? 0
  const expenses = d ? d.series.reduce((n, x) => n + x.cost_paise + x.refunds_paise, 0) : 0
  const net = revenue - expenses
  const catTotal = d?.by_category.reduce((n, c) => n + c.revenue_paise, 0) ?? 0
  return (
    <>
      <AdminTitle title="Reports" subtitle="Revenue, costs and what sells, by period.">
        <Seg label="Period" value={period} onChange={setPeriod} options={[['week', 'Week'], ['month', 'Month'], ['year', 'Year']]} />
        {d && <button type="button" className="pill pill-light" onClick={() => downloadCsv(`sanjaya-report-${period}.csv`, ['Period', 'Revenue (AED)', 'Cost of goods (AED)', 'Refunds (AED)', 'Net (AED)'],
          d.series.map((x) => [x.bucket, (x.revenue_paise / 100).toFixed(2), (x.cost_paise / 100).toFixed(2), (x.refunds_paise / 100).toFixed(2), ((x.revenue_paise - x.cost_paise - x.refunds_paise) / 100).toFixed(2)]))}>Export CSV</button>}
      </AdminTitle>
      {!d ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat green label="Revenue" value={aedShort(revenue)} />
            <Stat label="Expenses" value={aedShort(expenses)} sub="cost of goods + refunds" />
            <Stat label="Net profit" value={aedShort(net)} tone={net < 0 ? 'warn' : undefined} />
            <Stat label="Margin" value={revenue ? `${((net / revenue) * 100).toFixed(1)}%` : '—'} />
          </div>
          {d.costed_share != null && d.costed_share < 100 && (
            <Alert tone="info">Only {d.costed_share}% of items sold in this period have a cost price, so profit is shown higher than it is. Add cost prices with Products → Bulk edit.</Alert>
          )}
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Panel title="Revenue vs expenses">
              <LineChart label="Revenue and expenses" format={aed} labels={d.series.map((x) => label(x.bucket))}
                series={[
                  { name: 'Revenue', color: '#0f8f62', values: d.series.map((x) => x.revenue_paise) },
                  { name: 'Expenses', color: '#f0533a', values: d.series.map((x) => x.cost_paise + x.refunds_paise) },
                ]} />
            </Panel>
            <Panel title="Sales by category">
              {!d.by_category.length ? <p className="py-10 text-center text-sm muted">No sales in this period yet.</p> : (
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <Donut parts={d.by_category.map((c, i) => ({ value: c.revenue_paise, color: colorAt(i) }))}>
                    <span><span className="block text-xs muted">Total</span><span className="font-extrabold">{aedShort(catTotal)}</span></span>
                  </Donut>
                  <ul className="w-full flex-1 space-y-2.5">
                    {d.by_category.slice(0, 8).map((c, i) => (
                      <li key={c.name}>
                        <div className="mb-1 flex justify-between text-xs"><span className="inline-flex items-center gap-1.5 font-semibold"><span className="size-2.5 rounded-full" style={{ background: colorAt(i) }} />{c.name}</span><span className="muted">{aedShort(c.revenue_paise)}</span></div>
                        <ProgressBar value={catTotal ? (c.revenue_paise / catTotal) * 100 : 0} color={colorAt(i)} label={c.name} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Delivery fees charged" value={aed(d.delivery_fees_paise)} />
            <Stat label="Discounts given" value={aed(d.discounts_paise)} />
          </div>
        </div>
      )}
    </>
  )
}
