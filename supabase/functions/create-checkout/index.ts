// Creates a Stripe Checkout Session (AED) for an order or an installment of the signed-in customer.
import { assertPaymentsAllowed, Db, DbError, stripe } from '../_shared/clients.ts'
import { corsHeaders, json, siteUrl } from '../_shared/http.ts'

interface PaymentTarget {
  order_id: string; order_number: string; installment_id: string | null
  purpose: 'full' | 'first_installment' | 'installment'; amount_paise: number; expires_at: string | null; description: string
}
interface Session { id: string; url: string; livemode: boolean }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  try {
    const { order_id, installment_id } = await req.json().catch(() => ({}))
    if (!UUID.test(order_id ?? '') || (installment_id != null && !UUID.test(installment_id))) return json(req, { error: 'Invalid request' }, 400)

    const caller = Db.asUser(req)
    const user = await caller.user()
    if (!user) return json(req, { error: 'Please sign in to continue.' }, 401)

    // Ownership, status and amount are decided by the database, as the caller.
    let t: PaymentTarget
    try { t = await caller.rpc<PaymentTarget>('payment_intent_for_order', { p_order: order_id, p_installment: installment_id ?? null }) }
    catch (e) { return json(req, { error: e instanceof DbError ? e.message : 'Order not found' }, 400) }

    const admin = Db.admin()
    await assertPaymentsAllowed(admin, t.purpose !== 'full')

    // Stripe allows 30 minutes to 24 hours. The database releases unpaid orders on its own timer
    // and flags any later payment for a refund.
    const now = Math.floor(Date.now() / 1000)
    const want = t.expires_at ? Math.floor(new Date(t.expires_at).getTime() / 1000) : now + 24 * 3600
    const expiresAt = Math.min(Math.max(want, now + 31 * 60), now + 23 * 3600)
    const base = siteUrl(req)

    const session = await stripe<Session>('checkout/sessions', {
      mode: 'payment',
      line_items: { 0: { quantity: 1, price_data: { currency: 'aed', unit_amount: t.amount_paise, product_data: { name: t.description } } } },
      customer_email: user.email,
      client_reference_id: t.order_id,
      metadata: { order_id: t.order_id, installment_id: t.installment_id ?? '', purpose: t.purpose, user_id: user.id },
      payment_intent_data: { description: t.description, metadata: { order_id: t.order_id, order_number: t.order_number } },
      expires_at: expiresAt,
      success_url: `${base}/order/${t.order_id}?payment=success`,
      cancel_url: `${base}/order/${t.order_id}?payment=cancelled`,
    }, `${t.order_id}:${t.installment_id ?? 'order'}:${Math.floor(now / 600)}`)

    try {
      await admin.rpc('create_payment_record', {
        p_order: t.order_id, p_installment: t.installment_id, p_purpose: t.purpose,
        p_amount: t.amount_paise, p_session_id: session.id, p_livemode: session.livemode,
      })
    } catch (e) {
      // The same idempotency key returns the same session within 10 minutes; its record already exists.
      if (!(e instanceof DbError && /duplicate key/.test(e.message))) throw e
    }
    return json(req, { url: session.url, session_id: session.id })
  } catch (e) {
    console.error('create-checkout', e)
    const msg = e instanceof Error && /not switched on/.test(e.message) ? e.message : 'Could not start payment. Please try again.'
    return json(req, { error: msg }, 500)
  }
})
