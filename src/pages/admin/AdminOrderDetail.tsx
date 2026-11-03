import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, MapPin } from 'lucide-react'
import { Alert, Badge, Skeleton } from '@/components/ui/misc'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField, TextareaField } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/account/AuthProvider'
import { requireSupabase, friendlyError } from '@/lib/supabase'
import { formatINR } from '@/lib/money'
import { formatDateTime, formatDeliveryWindow } from '@/lib/format'
import { STATUS_LABEL, statusTone } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'
import { AdminTitle, rupeesInput } from './ui'

function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const db = requireSupabase()
      const [o, ev, pay, asg, att, pod, tr] = await Promise.all([
        db.from('orders').select('*, order_items(*)').eq('id', id).single(),
        db.from('order_status_events').select('*').eq('order_id', id).order('created_at'),
        db.from('payments').select('*, refunds(*)').eq('order_id', id).order('created_at'),
        db.from('delivery_assignments').select('*, staff:profiles!delivery_assignments_staff_id_fkey(full_name, phone)').eq('order_id', id).eq('is_active', true).maybeSingle(),
        db.from('delivery_attempts').select('*').eq('order_id', id).order('created_at'),
        db.from('proof_of_delivery').select('*').eq('order_id', id).maybeSingle(),
        db.from('order_status_transitions').select('from_status, to_status, allowed_roles'),
      ])
      if (o.error) throw o.error
      return { order: o.data, events: ev.data ?? [], payments: pay.data ?? [], assignment: asg.data, attempts: att.data ?? [], pod: pod.data, transitions: tr.data ?? [] }
    },
  })
}

export function AdminOrderDetail() {
  const { id = '' } = useParams()
  const { data, isLoading, error } = useAdminOrder(id)
  const { hasRole, roles } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] })

  const act = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: unknown }>) => { const { error } = await fn(); if (error) throw error },
    onSuccess: () => { setNote(''); setErr(null); toast('Saved'); refresh() },
    onError: (e) => setErr(friendlyError(e)),
  })

  if (isLoading) return <Skeleton className="h-96" />
  if (error || !data) return <Alert tone="error">{friendlyError(error)}</Alert>
  const { order: o, events, payments, assignment, attempts, pod } = data
  const db = requireSupabase()
  const addr = o.shipping_address as Record<string, string>

  // next steps this staff member may take (the database checks again)
  const mine = new Set<string>(roles.includes('super_admin') ? ['super_admin', 'operations', 'delivery', 'support', 'collections'] : roles)
  const options = (data.transitions as { from_status: OrderStatus; to_status: OrderStatus; allowed_roles: string[] }[])
    .filter((t) => t.from_status === o.status && t.allowed_roles.some((r) => mine.has(r)))
  const canDelay = hasRole('operations', 'support') && !['delivered', 'cancelled', 'refunded', 'returned', 'payment_pending', 'order_placed'].includes(o.status)

  return (
    <>
      <Link to="/admin/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-navy-700 hover:text-gold-700"><ArrowLeft className="size-4" /> Orders</Link>
      <AdminTitle title={`Order ${o.order_number}`} subtitle={`Placed ${formatDateTime(o.created_at)}`}>
        <Badge tone={statusTone(o.status)}>{STATUS_LABEL[o.status]}</Badge>
        {o.is_delayed && <Badge tone="red">Delayed</Badge>}
        {o.payment_mode === 'installment' && <Badge tone="gold">Installments</Badge>}
      </AdminTitle>
      {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <section className="card divide-y divide-navy-100">
            {o.order_items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-navy-50">{i.image_url && <img src={i.image_url} alt="" className="size-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{i.product_name}</p><p className="text-navy-600">{i.variant_name} · SKU {i.sku} · Qty {i.quantity}</p></div>
                <p className="font-semibold">{formatINR(i.line_total_paise)}</p>
              </div>
            ))}
            <dl className="grid grid-cols-2 gap-1 p-3 text-sm">
              <dt>Subtotal</dt><dd className="text-right">{formatINR(o.subtotal_paise)}</dd>
              {o.discount_paise > 0 && <><dt>Discount {o.coupon_code}</dt><dd className="text-right">− {formatINR(o.discount_paise)}</dd></>}
              <dt>Delivery{o.free_delivery_applied ? ' (first order free)' : ''}</dt><dd className="text-right">{formatINR(o.delivery_fee_paise)}</dd>
              <dt className="font-bold">Total</dt><dd className="text-right font-bold">{formatINR(o.total_paise)}</dd>
              <dt>Paid</dt><dd className="text-right">{formatINR(o.amount_paid_paise)}</dd>
              {o.amount_refunded_paise > 0 && <><dt>Refunded</dt><dd className="text-right text-danger">{formatINR(o.amount_refunded_paise)}</dd></>}
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Timeline</h2>
            <ol className="space-y-3 border-l-2 border-gold-300 pl-4 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="font-semibold">{STATUS_LABEL[e.status]} <span className="font-normal text-navy-600">· {formatDateTime(e.created_at)}</span>{!e.is_customer_visible && <Badge tone="grey" className="ml-2">internal</Badge>}</p>
                  {e.note && <p className="text-navy-700">{e.note}</p>}
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">Payments</h2>
            {!payments.length ? <p className="text-sm text-navy-600">No payment yet.</p> : payments.map((p) => (
              <PaymentRow key={p.id} p={p} canRefund={hasRole('super_admin')} onDone={refresh} />
            ))}
          </section>
        </div>

        <div className="space-y-6">
          {options.length > 0 && (
            <section className="card space-y-3 p-4">
              <h2 className="font-semibold">Next step</h2>
              <TextareaField label="Note (shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              <div className="flex flex-wrap gap-2">
                {options.map((t) => (
                  <Button key={t.to_status} size="sm" variant={t.to_status === 'cancelled' ? 'danger' : t.to_status === 'order_confirmed' ? 'gold' : 'navy'} loading={act.isPending}
                    onClick={() => {
                      if (t.to_status === 'cancelled' && !window.confirm('Cancel this order? Stock is released; paid orders need a refund.')) return
                      act.mutate(() => t.to_status === 'order_confirmed'
                        ? db.rpc('approve_order', { p_order: o.id, p_note: note || undefined })
                        : db.rpc('transition_order', { p_order: o.id, p_to: t.to_status, p_note: note || undefined }))
                    }}>
                    {t.to_status === 'order_confirmed' ? 'Approve order' : STATUS_LABEL[t.to_status]}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <section className="card space-y-1 p-4 text-sm">
            <h2 className="mb-2 font-semibold">Delivery</h2>
            <p className="font-semibold">{addr.recipient_name} · <a href={`tel:${addr.phone}`} className="text-gold-700">{addr.phone}</a></p>
            <p>{addr.house}, {addr.street}{addr.landmark ? `, near ${addr.landmark}` : ''}</p>
            <p>{addr.city}, {addr.state} {addr.pincode}</p>
            {o.latitude != null && <a className="inline-flex items-center gap-1 text-gold-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${o.latitude}&mlon=${o.longitude}#map=18/${o.latitude}/${o.longitude}`}><MapPin className="size-4" /> Open map pin</a>}
            <p className="pt-2 text-navy-700">Estimated {formatDeliveryWindow(o.estimated_min_date, o.estimated_max_date) ?? '—'}</p>
            {o.customer_note && <p className="rounded-lg bg-gold-200/30 p-2">Customer note: {o.customer_note}</p>}
            <p className="pt-2">Rider: {assignment ? <strong>{(assignment.staff as { full_name: string | null } | null)?.full_name ?? 'Assigned'}</strong> : 'not assigned'}</p>
            {hasRole('operations') && ['order_confirmed', 'processing', 'packed', 'dispatched', 'in_transit', 'out_for_delivery', 'delivery_failed'].includes(o.status) && (
              <AssignRider orderId={o.id} current={assignment?.staff_id} onDone={refresh} />
            )}
            {attempts.length > 0 && <ul className="mt-2 space-y-1 text-xs text-navy-700">{attempts.map((a) => <li key={a.id}>{formatDateTime(a.created_at)}: {a.outcome.replace('_', ' ')}{a.note ? ` (${a.note})` : ''}</li>)}</ul>}
            {pod && <p className="mt-2 rounded-lg bg-success/10 p-2 text-success">Delivered to {pod.recipient_name}{pod.delivery_code_verified ? ' · code verified' : ''}{pod.photo_path ? ' · photo saved' : ''}</p>}
          </section>

          {canDelay && <DelayForm orderId={o.id} onDone={refresh} />}
        </div>
      </div>
    </>
  )
}

function AssignRider({ orderId, current, onDone }: { orderId: string; current?: string; onDone: () => void }) {
  const { data: riders } = useQuery({
    queryKey: ['admin', 'riders'],
    queryFn: async () => { const { data, error } = await requireSupabase().rpc('list_delivery_staff'); if (error) throw error; return data },
  })
  const [rider, setRider] = useState(current ?? '')
  const [date, setDate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true); setErr(null)
    const { error } = await requireSupabase().rpc('assign_delivery', { p_order: orderId, p_staff: rider, p_scheduled_date: date || undefined })
    setBusy(false)
    if (error) setErr(friendlyError(error)); else onDone()
  }
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-navy-100 p-3">
      <SelectField label="Assign rider" value={rider} onChange={(e) => setRider(e.target.value)}>
        <option value="">Choose…</option>
        {riders?.map((r) => <option key={r.id} value={r.id}>{r.full_name ?? r.phone} ({r.active_orders} active)</option>)}
      </SelectField>
      {riders && !riders.length && <p className="text-xs text-navy-600">No delivery staff yet. The Super Admin can add them under Staff.</p>}
      <InputField label="Delivery date (optional)" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="sm" onClick={save} disabled={!rider} loading={busy}>Save</Button>
    </div>
  )
}

function DelayForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    const { error } = await requireSupabase().rpc('report_delay', { p_order: orderId, p_note: note, p_new_max_date: date || undefined })
    if (error) setErr(friendlyError(error)); else { setNote(''); onDone() }
  }
  return (
    <section className="card space-y-2 p-4">
      <h2 className="font-semibold">Report a delay</h2>
      <TextareaField label="Reason (shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      <InputField label="New latest delivery date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      {err && <Alert tone="error">{err}</Alert>}
      <Button size="sm" variant="outline" onClick={save} disabled={!note.trim()}>Mark delayed</Button>
    </section>
  )
}

interface PaymentRowData { id: string; purpose: string; status: string; amount_paise: number; amount_refunded_paise: number; paid_at: string | null; livemode: boolean; created_at: string; refunds: { id: string; amount_paise: number; status: string; reason: string | null }[] }
function PaymentRow({ p, canRefund, onDone }: { p: PaymentRowData; canRefund: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const remaining = p.amount_paise - p.amount_refunded_paise
  const refund = async () => {
    const paise = amount ? rupeesInput(amount) : remaining
    if (!paise || paise > remaining) return setErr('Enter an amount up to the remaining balance.')
    if (!window.confirm(`Refund ${formatINR(paise)} to the customer's card?`)) return
    setBusy(true); setErr(null)
    const { data, error } = await requireSupabase().functions.invoke('admin-refund', { body: { payment_id: p.id, amount_paise: paise, reason } })
    setBusy(false)
    if (error || (data as { error?: string })?.error) {
      let msg = (data as { error?: string })?.error ?? 'Refund failed'
      try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error } catch { /* keep */ }
      return setErr(msg)
    }
    setOpen(false); onDone()
  }
  return (
    <div className="border-b border-navy-100 py-2 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{p.purpose.replace('_', ' ')} · {formatINR(p.amount_paise)} · <Badge tone={p.status === 'succeeded' ? 'green' : p.status.includes('refund') ? 'grey' : 'amber'}>{p.status}</Badge>{!p.livemode && <Badge tone="grey" className="ml-1">test</Badge>}</span>
        <span className="text-navy-600">{p.paid_at ? formatDateTime(p.paid_at) : formatDateTime(p.created_at)}</span>
      </div>
      {p.refunds.map((r) => <p key={r.id} className="text-xs text-navy-700">Refund {formatINR(r.amount_paise)} · {r.status}{r.reason ? ` · ${r.reason}` : ''}</p>)}
      {canRefund && remaining > 0 && ['succeeded', 'partially_refunded'].includes(p.status) && (
        open ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <InputField label={`Amount ₹ (max ${(remaining / 100).toFixed(2)})`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Full" />
            <InputField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
            <Button size="sm" variant="danger" loading={busy} onClick={refund}>Refund</Button>
            {err && <div className="sm:col-span-3"><Alert tone="error">{err}</Alert></div>}
          </div>
        ) : <Button size="sm" variant="ghost" className="mt-1" onClick={() => setOpen(true)}>Refund…</Button>
      )}
    </div>
  )
}
