import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Phone } from 'lucide-react'
import { Alert, Badge } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { useAuth } from '@/features/account/AuthProvider'
import { formatAED } from '@/lib/money'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { AdminTitle } from './ui'

const STATUSES = ['open', 'contacted', 'promised', 'resolved', 'escalated'] as const
type Task = {
  id: string; status: string; promised_date: string | null; assigned_to: string | null; created_at: string
  assignee: { full_name: string | null } | null
  installment: { id: string; seq: number; amount_paise: number; due_date: string; status: string
    plan: { installment_count: number; order: { id: string; order_number: string; shipping_address: { recipient_name?: string; phone?: string; city?: string } } | null } | null } | null
  notes: { id: number; note: string; created_at: string }[]
}

/** Whole days since the due date (IST). */
function daysLate(due: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(due + 'T00:00:00+05:30').getTime()) / 86_400_000))
}

function TaskCard({ t, collectors }: { t: Task; collectors: { id: string; full_name: string }[] }) {
  const db = requireSupabase()
  const qc = useQueryClient()
  const { hasRole } = useAuth()
  const [status, setStatus] = useState(t.status)
  const [note, setNote] = useState('')
  const [promised, setPromised] = useState(t.promised_date ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const i = t.installment
  const o = i?.plan?.order
  const run = async (p: PromiseLike<{ error: unknown }>) => {
    setBusy(true); const { error } = await p; setBusy(false)
    if (error) setErr(friendlyError(error)); else { setErr(null); setNote(''); qc.invalidateQueries({ queryKey: ['admin', 'collections'] }) }
  }
  const late = i ? daysLate(i.due_date) : 0

  return (
    <article className="card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        {o && <Link to={`/admin/orders/${o.id}`} className="font-semibold text-navy-900 hover:text-gold-700">#{o.order_number}</Link>}
        {i && <span>Installment {i.seq}/{i.plan?.installment_count} · <strong>{formatAED(i.amount_paise)}</strong></span>}
        <Badge tone={t.status === 'resolved' ? 'green' : t.status === 'escalated' ? 'red' : 'amber'}>{t.status}</Badge>
        {i && <Badge tone={i.status === 'overdue' ? 'red' : i.status === 'paid' ? 'green' : 'grey'}>{i.status}{late > 0 && i.status === 'overdue' ? ` · ${late} days late` : ''}</Badge>}
      </div>
      <p className="mt-2">{o?.shipping_address.recipient_name} · {o?.shipping_address.city} {o?.shipping_address.phone && <a href={`tel:${o.shipping_address.phone}`} className="ml-2 inline-flex items-center gap-1 font-semibold text-gold-700"><Phone className="size-3.5" />{o.shipping_address.phone}</a>}</p>
      <p className="text-xs text-navy-600">Assigned to: {t.assignee?.full_name ?? 'nobody'}</p>
      {t.notes.length > 0 && (
        <ul className="mt-2 space-y-1 border-l border-navy-100 pl-3 text-xs text-navy-700">
          {[...t.notes].sort((a, b) => a.id - b.id).map((n) => <li key={n.id}>{new Date(n.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}: {n.note}</li>)}
        </ul>
      )}
      {err && <div className="mt-2"><Alert tone="error">{err}</Alert></div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-[140px_150px_1fr_auto] sm:items-end">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</SelectField>
        <InputField label="Promised date" type="date" value={promised} onChange={(e) => setPromised(e.target.value)} />
        <InputField label="Note" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Called, will pay Friday" />
        <Button size="sm" loading={busy} onClick={() => run(db.rpc('update_collection_task', { p_task: t.id, p_status: status, p_note: note.trim() || undefined, p_promised_date: promised || undefined }))}>Save</Button>
      </div>
      {hasRole('super_admin') && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-navy-100 pt-3">
          <SelectField label="Assign to" value={t.assigned_to ?? ''} onChange={(e) => e.target.value && run(db.rpc('assign_collection_task', { p_task: t.id, p_staff: e.target.value }))}>
            <option value="">Choose…</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.full_name || c.id.slice(0, 8)}</option>)}
          </SelectField>
          {i && (i.status === 'overdue' || i.status === 'due') && (
            <Button size="sm" variant="outline" onClick={() => {
              const reason = window.prompt('Reason for waiving this installment (saved in the audit log):')
              if (reason?.trim()) run(db.rpc('waive_installment', { p_installment: i.id, p_reason: reason.trim() }))
            }}>Waive installment</Button>
          )}
        </div>
      )}
    </article>
  )
}

export function AdminCollections() {
  const db = requireSupabase()
  const { hasRole } = useAuth()
  const [show, setShow] = useState<'active' | 'resolved'>('active')
  const { data, error } = useQuery({
    queryKey: ['admin', 'collections', show],
    queryFn: async () => {
      let q = db.from('collection_tasks')
        .select('*, assignee:profiles!collection_tasks_assigned_to_fkey(full_name), installment:installments(id, seq, amount_paise, due_date, status, plan:installment_plans(installment_count, order:orders(id, order_number, shipping_address))), notes:collection_notes(id, note, created_at)')
        .order('created_at', { ascending: true }).limit(200)
      q = show === 'active' ? q.neq('status', 'resolved') : q.eq('status', 'resolved')
      const { data, error } = await q
      if (error) throw error
      return data as unknown as Task[]
    },
  })
  const { data: collectors } = useQuery({
    queryKey: ['admin', 'collectors'],
    enabled: hasRole('super_admin'),
    queryFn: async () => { const { data, error } = await db.rpc('list_staff'); if (error) throw error; return data.filter((s) => s.roles.includes('collections')) },
  })
  return (
    <>
      <AdminTitle title="Collections" subtitle="Installments more than the grace period late. Call the customer, note what they said, and set a promised date.">
        <Button size="sm" variant={show === 'active' ? 'navy' : 'outline'} onClick={() => setShow('active')}>Open</Button>
        <Button size="sm" variant={show === 'resolved' ? 'navy' : 'outline'} onClick={() => setShow('resolved')}>Resolved</Button>
      </AdminTitle>
      {error && <Alert tone="error">{friendlyError(error)}</Alert>}
      {data?.length === 0 && <p className="card p-6 text-center text-sm text-navy-600">Nothing here. All installments are on time.</p>}
      <div className="grid gap-4">{data?.map((t) => <TaskCard key={t.id + t.status} t={t} collectors={collectors ?? []} />)}</div>
    </>
  )
}
