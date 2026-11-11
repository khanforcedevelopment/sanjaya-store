/** Turns a typed question in the staff "Ask" box into a page to open. */
const RULES: [RegExp, string][] = [
  [/\bpayment\b.*\b(pending|due)|unpaid/, '/admin/orders?status=payment_pending'],
  [/\b(pending|awaiting|approv)/, '/admin/orders?status=awaiting_approval'],
  [/\b(zone|emirate|delivery fee)/, '/admin/delivery'],
  [/\b(delay|late)/, '/admin/orders?delayed=1'],
  [/\b(fleet|rider|driver|deliver(y|ies)|map|vehicle)/, '/admin/fleet'],
  [/\bout of stock|sold out/, '/admin/products?stock=out'],
  [/\b(low stock|restock|reorder)/, '/admin/products?stock=low'],
  [/\b(stock|inventory|warehouse)/, '/admin/stock'],
  [/\b(customer|buyer|client)/, '/admin/customers'],
  [/\b(report|profit|revenue|sales|expense|margin)/, '/admin/reports'],
  [/\b(import|csv|upload|bulk)/, '/admin/import'],
  [/\b(banner|coupon|offer|marketing)/, '/admin/marketing'],
  [/\b(staff|role|team)/, '/admin/staff'],
  [/\b(setting|target|threshold)/, '/admin/settings'],
  [/\b(support|ticket|complain)/, '/admin/support'],
  [/\b(kyc|identity)/, '/admin/kyc'],
  [/\b(refund|return)/, '/admin/orders?status=return_requested'],
  [/\b(cancel)/, '/admin/orders?status=cancelled'],
  [/\b(orders?)\b/, '/admin/orders'],
  [/\b(products?|catalogue|catalog)\b/, '/admin/products'],
  [/\b(home|overview|dashboard)\b/, '/admin'],
]

export function resolveAsk(input: string): string | null {
  const text = input.trim().toLowerCase()
  if (!text) return null
  const order = text.match(/\bsnj\s?(\d{3,})\b/)
  if (order) return `/admin/orders?q=SNJ${order[1]}`
  // "new product" / "add product" opens the form
  if (/\b(new|add|create)\b.*\bproduct/.test(text)) return '/admin/products/new'
  for (const [re, to] of RULES) if (re.test(text)) return to
  return `/admin/products?q=${encodeURIComponent(input.trim())}`
}
