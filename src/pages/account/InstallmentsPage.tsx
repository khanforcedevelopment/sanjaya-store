import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Alert, Badge, EmptyState, PageTitle, Skeleton } from '@/components/ui/misc'
import { Button, ButtonLink } from '@/components/ui/Button'
import { useAuth } from '@/features/account/AuthProvider'
import { useMyPlans } from '@/features/installments/api'
import { startPayment } from '@/features/payments/startPayment'
import { formatINR } from '@/lib/money'
import { useDocumentMeta } from '@/lib/meta'
import type { Database } from '@/types/database'

type Status = Database['public']['Enums']['installment_status']
const TONE: Record<string, 'green' | 'amber' | 'red' | 'grey' | 'navy'> = { paid: 'green', waived: 'grey', due: 'amber', overdue: 'red', scheduled: 'navy', cancelled: 'grey' }
const PLAN_LABEL: Record<string, string> = { pending_first_payment: 'Waiting for first payment', active: 'Active', completed: 'Completed', defaulted: 'Overdue', cancelled: 'Cancelled' }
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

export function InstallmentsPage() {
  useDocumentMeta({ title: 'Installments', noindex: true })
  const { user } = useAuth()
  const { data: plans, isLoading } = useMyPlans(!!user)
  const [paying, setPaying] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pay = async (orderId: string, installmentId: string | null) => {
    setPaying(installmentId ?? orderId); setErr(null)
    try { await startPayment(orderId, installmentId) } catch (e) { setErr((e as Error).message); setPaying(null) }
  }

  if (isLoading) return <Skeleton className="h-64" />
  return (
    <>
      <PageTitle title="Installments" subtitle="Your monthly payment plans. No interest and no fees." />
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
      {!plans?.length ? (
        <EmptyState icon={<CalendarClock />} title="No installment plans" action={<ButtonLink to="/installments" variant="outline">How installments work</ButtonLink>}>
          Choose "Pay in 6 monthly installments" at checkout on eligible products.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {plans.map((p) => {
            const paid = p.installments.filter((i) => i.status === 'paid' || i.status === 'waived').reduce((s, i) => s + i.amount_paise, 0)
            const next = p.installments.find((i) => i.status === 'due' || i.status === 'overdue' || i.status === 'scheduled')
            const order = p.order as { id: string; order_number: string } | null
            const canPay = next && (p.status === 'active' || (p.status === 'pending_first_payment' && next.seq === 1))
            return (
              <section key={p.id} className="card p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-navy-900">Order {order && <Link to={`/order/${order.id}`} className="text-gold-700 underline">{order.order_number}</Link>}</h2>
                  <Badge tone={p.status === 'active' || p.status === 'completed' ? 'green' : p.status === 'defaulted' ? 'red' : 'amber'}>{PLAN_LABEL[p.status] ?? p.status}</Badge>
                  <span className="ml-auto text-sm text-navy-700">{formatINR(paid)} of {formatINR(p.total_paise)} paid</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-navy-100"><div className="h-full bg-gold-500" style={{ width: `${Math.round((paid / p.total_paise) * 100)}%` }} /></div>
                <ol className="mt-4 divide-y divide-navy-100 text-sm">
                  {p.installments.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2">
                      <span className="w-6 font-semibold text-navy-600">{i.seq}</span>
                      <span className="flex-1">{fmtDate(i.due_date)}</span>
                      <span className="font-semibold">{formatINR(i.amount_paise)}</span>
                      <Badge tone={TONE[i.status as Status] ?? 'navy'}>{i.status}</Badge>
                    </li>
                  ))}
                </ol>
                {canPay && order && next && (
                  <Button className="mt-4 w-full sm:w-auto" loading={paying === next.id} onClick={() => pay(order.id, next.seq === 1 ? null : next.id)}>
                    Pay installment {next.seq} · {formatINR(next.amount_paise)}
                  </Button>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
