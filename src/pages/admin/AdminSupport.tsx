import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Alert } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/account/AuthProvider'
import { SupportThread } from '@/features/support/Thread'
import { ticketStatus } from '@/pages/account/SupportPage'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { cn } from '@/lib/cn'
import { AdminTitle } from './ui'

type Ticket = { id: string; subject: string; status: string; updated_at: string; order_id: string | null
  customer: { full_name: string | null; phone: string | null } | null; order: { order_number: string } | null }

export function AdminSupport() {
  const db = requireSupabase()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [filter, setFilter] = useState<'open' | 'pending_customer' | 'resolved'>('open')
  const [sel, setSel] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ['support', 'admin', filter],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('support_tickets')
        .select('id, subject, status, updated_at, order_id, customer:profiles!support_tickets_user_id_fkey(full_name, phone), order:orders(order_number)')
        .eq('status', filter).order('updated_at', { ascending: filter !== 'resolved' }).limit(200)
      if (error) throw error
      return data as unknown as Ticket[]
    },
  })
  const t = data?.find((x) => x.id === sel)
  const resolve = async (id: string) => {
    const { error } = await db.from('support_tickets').update({ status: 'resolved' }).eq('id', id)
    if (error) setErr(friendlyError(error)); else { setSel(null); qc.invalidateQueries({ queryKey: ['support'] }) }
  }
  return (
    <>
      <AdminTitle title="Support" subtitle="Oldest waiting first. Replying moves a request to 'We replied'; the customer's answer reopens it.">
        {(['open', 'pending_customer', 'resolved'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'navy' : 'outline'} onClick={() => { setFilter(f); setSel(null) }}>{f === 'open' ? 'Waiting for us' : f === 'pending_customer' ? 'Waiting for customer' : 'Resolved'}</Button>
        ))}
      </AdminTitle>
      {err && <div className="mb-3"><Alert tone="error">{err}</Alert></div>}
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <ul className="card max-h-[70vh] divide-y divide-navy-100 overflow-y-auto">
          {data?.length === 0 && <li className="p-6 text-center text-sm text-navy-600">Nothing here.</li>}
          {data?.map((x) => (
            <li key={x.id}><button type="button" onClick={() => setSel(x.id)} className={cn('w-full p-3 text-left text-sm hover:bg-navy-50/60', sel === x.id && 'bg-gold-200/30')}>
              <span className="block truncate font-semibold text-navy-900">{x.subject}</span>
              <span className="block text-xs text-navy-600">{x.customer?.full_name ?? 'Customer'}{x.order ? ` · ${x.order.order_number}` : ''} · {new Date(x.updated_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </button></li>
          ))}
        </ul>
        {t && user ? (
          <section className="card p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-navy-900">{t.subject}</h2>
              <Badge tone={ticketStatus(t.status).t}>{ticketStatus(t.status).l}</Badge>
              {t.order_id && <Link to={`/admin/orders/${t.order_id}`} className="text-sm font-semibold text-gold-700 underline">Order {t.order?.order_number}</Link>}
              {t.customer?.phone && <a href={`tel:${t.customer.phone}`} className="text-sm text-navy-700">{t.customer.phone}</a>}
              {t.status !== 'resolved' && <Button size="sm" variant="outline" className="ml-auto" onClick={() => resolve(t.id)}>Mark resolved</Button>}
            </div>
            <SupportThread ticketId={t.id} userId={user.id} asStaff />
          </section>
        ) : <p className="card p-6 text-center text-sm text-navy-600">Pick a request on the left.</p>}
      </div>
    </>
  )
}
