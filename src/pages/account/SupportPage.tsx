import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, LifeBuoy, MessageCircle } from 'lucide-react'
import { Alert, Badge, PageTitle, Skeleton } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField, TextareaField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { usePublicSetting } from '@/features/catalog/api'
import { SupportThread } from '@/features/support/Thread'
import { requireSupabase, friendlyError, supabase } from '@/lib/supabase'
import { useDocumentMeta } from '@/lib/meta'

const STATUS: Record<string, { l: string; t: 'amber' | 'green' | 'navy' }> = {
  open: { l: 'Waiting for our team', t: 'amber' }, pending_customer: { l: 'We replied', t: 'navy' }, resolved: { l: 'Resolved', t: 'green' },
}
export const ticketStatus = (s: string) => STATUS[s] ?? { l: s, t: 'navy' as const }

function NewTicket() {
  const { user } = useAuth()
  const db = requireSupabase()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const { data: orders } = useQuery({
    queryKey: ['orders', 'mine-short', user?.id],
    enabled: !!user,
    queryFn: async () => { const { data, error } = await db.from('orders').select('id, order_number').order('created_at', { ascending: false }).limit(30); if (error) throw error; return data },
  })
  const [order, setOrder] = useState(sp.get('order') ?? '')
  const [subject, setSubject] = useState(sp.get('order') ? 'Help with my order' : '')
  const [body, setBody] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (subject.trim().length < 3) return setErr('Add a short subject.')
    if (!body.trim()) return setErr('Tell us how we can help.')
    setBusy(true); setErr(null)
    const id = crypto.randomUUID()
    const t = await db.from('support_tickets').insert({ id, user_id: user!.id, order_id: order || null, subject: subject.trim() })
    if (t.error) { setBusy(false); return setErr(friendlyError(t.error)) }
    const m = await db.from('support_messages').insert({ ticket_id: id, author_id: user!.id, body: body.trim() })
    setBusy(false)
    if (m.error) return setErr(friendlyError(m.error))
    qc.invalidateQueries({ queryKey: ['support'] })
    navigate(`/account/support/${id}`)
  }
  return (
    <section className="card space-y-3 p-5">
      <h2 className="font-semibold text-navy-900">New request</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Order (optional)" value={order} onChange={(e) => setOrder(e.target.value)}>
          <option value="">Not about an order</option>
          {orders?.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}
        </SelectField>
        <InputField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
      </div>
      <TextareaField label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button loading={busy} onClick={submit}>Send request</Button>
    </section>
  )
}

export function SupportPage() {
  useDocumentMeta({ title: 'Help & support', noindex: true })
  const { user } = useAuth()
  const { id } = useParams()
  const { data: store } = usePublicSetting<{ whatsapp?: string; support_email?: string }>('store')
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['support', 'tickets', user?.id],
    enabled: !!supabase && !!user,
    queryFn: async () => {
      const { data, error } = await requireSupabase().from('support_tickets').select('id, subject, status, updated_at, order:orders(order_number)').order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
  if (isLoading) return <Skeleton className="h-64" />
  const current = tickets?.find((t) => t.id === id)

  if (id) {
    return (
      <>
        <Link to="/account/support" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-gold-700"><ArrowLeft className="size-4" /> All requests</Link>
        {!current ? <Alert tone="error">Request not found.</Alert> : (
          <>
            <PageTitle title={current.subject} subtitle={(current.order as { order_number: string } | null)?.order_number ? `Order ${(current.order as { order_number: string }).order_number}` : undefined}>
              <Badge tone={ticketStatus(current.status).t}>{ticketStatus(current.status).l}</Badge>
            </PageTitle>
            <section className="card p-5"><SupportThread ticketId={current.id} userId={user!.id} /></section>
          </>
        )}
      </>
    )
  }
  return (
    <>
      <PageTitle title="Help & support" subtitle="Our team replies within one working day." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <NewTicket />
          {tickets && tickets.length > 0 && (
            <ul className="card divide-y divide-navy-100">
              {tickets.map((t) => (
                <li key={t.id}><Link to={`/account/support/${t.id}`} className="flex items-center gap-3 p-4 hover:bg-navy-50/50">
                  <MessageCircle className="size-5 text-gold-700" />
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-navy-900">{t.subject}</span><span className="text-xs text-navy-600">{(t.order as { order_number: string } | null)?.order_number ?? 'General'} · {new Date(t.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                  <Badge tone={ticketStatus(t.status).t}>{ticketStatus(t.status).l}</Badge>
                </Link></li>
              ))}
            </ul>
          )}
        </div>
        <aside className="card h-fit space-y-2 p-5 text-sm">
          <p className="flex items-center gap-2 font-semibold text-navy-900"><LifeBuoy className="size-5 text-gold-600" /> Other ways to reach us</p>
          {store?.whatsapp && <p>WhatsApp: <a className="font-semibold text-gold-700" href={`https://wa.me/${store.whatsapp}`} target="_blank" rel="noreferrer">+{store.whatsapp}</a></p>}
          {store?.support_email && <p>Email: <a className="font-semibold text-gold-700" href={`mailto:${store.support_email}`}>{store.support_email}</a></p>}
        </aside>
      </div>
    </>
  )
}
