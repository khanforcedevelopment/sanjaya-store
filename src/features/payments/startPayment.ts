import { requireSupabase } from '@/lib/supabase'

/** Asks our server for a Stripe Checkout page for this order (or installment) and opens it. */
export async function startPayment(orderId: string, installmentId?: string): Promise<void> {
  const { data, error } = await requireSupabase().functions.invoke<{ url?: string; error?: string }>('create-checkout', {
    body: { order_id: orderId, installment_id: installmentId ?? null },
  })
  if (error) {
    let msg = 'Could not start payment. Please try again.'
    try { const b = await (error as { context?: Response }).context?.json(); if (b?.error) msg = b.error } catch { /* keep default */ }
    throw new Error(msg)
  }
  if (!data?.url || !/^https:\/\/checkout\.stripe\.com\//.test(data.url)) throw new Error(data?.error ?? 'Could not start payment. Please try again.')
  window.location.assign(data.url)
}
