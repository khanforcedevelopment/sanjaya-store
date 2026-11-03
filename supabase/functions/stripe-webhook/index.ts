// Receives Stripe events. Verifies the signature, stores each event once, then updates the order.
import { Db, verifyStripeSignature } from '../_shared/clients.ts'
import { requireEnv } from '../_shared/http.ts'

// deno-lint-ignore no-explicit-any
type Obj = Record<string, any>
interface StripeEvent { id: string; type: string; livemode: boolean; data: { object: Obj } }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const signature = req.headers.get('stripe-signature') ?? ''
  const body = await req.text()
  if (!(await verifyStripeSignature(body, signature, requireEnv('STRIPE_WEBHOOK_SECRET')))) {
    return new Response('Invalid signature', { status: 400 })
  }
  const event = JSON.parse(body) as StripeEvent
  const admin = Db.admin()

  const seen = await admin.select<{ processed_at: string | null }>('stripe_events', `id=eq.${encodeURIComponent(event.id)}&select=processed_at`)
  if (seen[0]?.processed_at) return Response.json({ received: true, duplicate: true })
  if (!seen.length) await admin.insert('stripe_events', { id: event.id, type: event.type, livemode: event.livemode, payload: event }, true)

  try {
    const result = await handle(admin, event)
    await admin.update('stripe_events', `id=eq.${encodeURIComponent(event.id)}`, { processed_at: new Date().toISOString(), error: null })
    return Response.json({ received: true, result })
  } catch (e) {
    console.error('stripe-webhook', event.type, e)
    await admin.update('stripe_events', `id=eq.${encodeURIComponent(event.id)}`, { error: String(e instanceof Error ? e.message : e).slice(0, 500) })
    return new Response('Processing failed', { status: 500 }) // Stripe retries
  }
})

function handle(admin: Db, event: StripeEvent): Promise<unknown> | string {
  const o = event.data.object
  const id = (v: unknown) => (typeof v === 'string' ? v : (v as Obj | null)?.id ?? null)
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (o.payment_status !== 'paid') return 'awaiting_payment'
      return admin.rpc('record_checkout_paid', {
        p_session_id: o.id, p_payment_intent: id(o.payment_intent), p_amount: o.amount_total ?? 0, p_currency: o.currency ?? '', p_livemode: !!o.livemode,
      })
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed':
      return admin.rpc('record_checkout_expired', { p_session_id: o.id })
    case 'refund.created':
    case 'refund.updated': {
      const pi = id(o.payment_intent)
      if (!pi) return 'no_payment_intent'
      return admin.rpc('record_refund', { p_payment_intent: pi, p_stripe_refund_id: o.id, p_amount: o.amount, p_status: o.status ?? 'pending', p_reason: o.metadata?.reason || o.reason || null })
    }
    default:
      return 'ignored'
  }
}
