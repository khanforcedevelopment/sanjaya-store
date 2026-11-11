// Super Admin refunds a payment (full or partial). The webhook records the final refund status.
import { Db, stripe } from '../_shared/clients.ts'
import { corsHeaders, json } from '../_shared/http.ts'

interface Payment { id: string; order_id: string; status: string; amount_paise: number; amount_refunded_paise: number; stripe_payment_intent_id: string | null }
interface Refund { id: string; amount: number; status: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  try {
    const { payment_id, amount_paise, reason } = await req.json().catch(() => ({}))
    const caller = Db.asUser(req)
    const user = await caller.user()
    if (!user) return json(req, { error: 'Please sign in to continue.' }, 401)
    if (!(await caller.rpc<boolean>('has_role', { p_role: 'super_admin' }))) return json(req, { error: 'Only the Super Admin can refund payments.' }, 403)
    if (!/^[0-9a-f-]{36}$/i.test(String(payment_id ?? ''))) return json(req, { error: 'Invalid request' }, 400)

    const admin = Db.admin()
    const [p] = await admin.select<Payment>('payments', `id=eq.${payment_id}&select=id,order_id,status,amount_paise,amount_refunded_paise,stripe_payment_intent_id`)
    if (!p || !p.stripe_payment_intent_id || !['succeeded', 'partially_refunded'].includes(p.status)) return json(req, { error: 'This payment cannot be refunded.' }, 400)
    const remaining = p.amount_paise - p.amount_refunded_paise
    const amount = amount_paise == null ? remaining : Number(amount_paise)
    if (!Number.isInteger(amount) || amount <= 0 || amount > remaining) return json(req, { error: `Refund must be between AED 0.01 and the remaining AED ${(remaining / 100).toFixed(2)}.` }, 400)
    const note = String(reason ?? '').slice(0, 300)

    const refund = await stripe<Refund>('refunds', { payment_intent: p.stripe_payment_intent_id, amount, metadata: { order_id: p.order_id, reason: note, by: user.id } },
      `refund:${p.id}:${p.amount_refunded_paise}:${amount}`)
    await admin.rpc('record_refund', { p_payment_intent: p.stripe_payment_intent_id, p_stripe_refund_id: refund.id, p_amount: refund.amount, p_status: refund.status ?? 'pending', p_reason: note || null })
    await admin.insert('audit_log', { actor_id: user.id, action: 'refund_requested', entity: 'payments', entity_id: p.id, details: { amount, refund_id: refund.id, reason: note } })
    return json(req, { refund_id: refund.id, status: refund.status })
  } catch (e) {
    console.error('admin-refund', e)
    return json(req, { error: 'Refund failed. Please try again or refund from the Stripe dashboard.' }, 500)
  }
})
