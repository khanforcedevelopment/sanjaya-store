// Plain, branded transactional emails. Every value is escaped; links point only to our own site.
type P = Record<string, unknown>
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const aed = (fils: unknown) => {
  const n = Number(fils ?? 0)
  return 'AED ' + (n / 100).toLocaleString('en-GB', n % 100 === 0 ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const date = (d: unknown) => d ? new Date(String(d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }) : ''

const STATUS: Record<string, string> = {
  payment_pending: 'is waiting for payment', payment_confirmed: 'is paid', awaiting_approval: 'is being checked by our team',
  order_confirmed: 'is approved', processing: 'is being prepared', packed: 'is packed', dispatched: 'is on its way',
  in_transit: 'is on its way', out_for_delivery: 'is out for delivery today', delivered: 'is delivered', delayed: 'is delayed',
  delivery_failed: 'could not be delivered', cancelled: 'is cancelled', return_requested: 'has a return request', returned: 'is returned', refunded: 'is refunded',
}

function layout(site: string, heading: string, body: string, cta?: { href: string; label: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F5F1E8;font-family:Arial,sans-serif;color:#0B1B3F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden">
<tr><td style="background:#0B1B3F;padding:18px 24px;color:#D8B45C;font-family:Georgia,serif;font-size:22px;letter-spacing:3px">SANJAYA STORE</td></tr>
<tr><td style="padding:24px"><h1 style="margin:0 0 12px;font-family:Georgia,serif;font-size:24px">${heading}</h1>${body}
${cta ? `<p style="margin:24px 0 0"><a href="${site}${cta.href}" style="background:#C29A3B;color:#0B1B3F;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>` : ''}
</td></tr><tr><td style="padding:16px 24px;font-size:12px;color:#5B6B8C;border-top:1px solid #eee">Sanjaya Trading FZE · Ajman, UAE · Prices include 5% VAT · <a href="${site}/account/support" style="color:#5B6B8C">Help</a></td></tr>
</table></td></tr></table></body></html>`
}

/** Returns subject and HTML for a queued email, or null for an unknown template. */
export function renderEmail(template: string, p: P, site: string): { subject: string; html: string } | null {
  switch (template) {
    case 'order_status': {
      const what = STATUS[String(p.status)] ?? 'has an update'
      const isCode = p.status === 'dispatched' || p.status === 'out_for_delivery'
      return {
        subject: `Order ${p.order_number} ${what}`,
        html: layout(site, `Your order ${esc(what)}`, `<p>Order <strong>${esc(p.order_number)}</strong>.</p>${p.note ? `<p>${esc(p.note)}</p>` : ''}${
          p.estimated_max_date && p.status !== 'delivered' ? `<p>Expected by <strong>${esc(date(p.estimated_max_date))}</strong>.</p>` : ''}${
          isCode ? '<p>Our delivery partner will ask for the 4-digit delivery code shown on your order page. Share it only when you receive the parcel.</p>' : ''}`,
          { href: `/order/${encodeURIComponent(String(p.order_id))}`, label: 'Track your order' }),
      }
    }
    case 'installment_reminder':
      return {
        subject: p.overdue ? `Installment ${p.seq} for order ${p.order_number} is overdue` : `Installment ${p.seq} for order ${p.order_number} is due`,
        html: layout(site, p.overdue ? 'Your installment is overdue' : 'Your installment is due', `<p>Installment ${esc(p.seq)} of ${esc(p.count)} for order <strong>${esc(p.order_number)}</strong>: <strong>${esc(aed(p.amount_paise))}</strong>, due ${esc(date(p.due_date))}.</p>`,
          { href: '/account/installments', label: 'Pay now' }),
      }
    case 'kyc_update':
      return {
        subject: p.status === 'approved' ? 'Your identity is verified' : 'About your identity check',
        html: layout(site, p.status === 'approved' ? 'Identity verified' : 'Identity check not approved',
          p.status === 'approved' ? '<p>You can now use monthly installments at checkout on eligible products.</p>' : '<p>We could not approve your documents. Please see the reason and try again with clear photos.</p>',
          { href: '/account/verify', label: 'See details' }),
      }
    case 'support_reply':
      return { subject: `Reply: ${p.subject}`, html: layout(site, 'We replied to your request', `<p>${esc(p.subject)}</p>`, { href: `/account/support/${encodeURIComponent(String(p.ticket_id))}`, label: 'Read the reply' }) }
    case 'referral_reward':
      return { subject: 'You earned a referral reward', html: layout(site, 'Thank you for inviting friends', `<p>${esc(p.reward)} is now in your account.</p>`, { href: '/account/rewards', label: 'See your rewards' }) }
    default:
      return null
  }
}
