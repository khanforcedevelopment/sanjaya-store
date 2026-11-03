import type { CartLine } from '@/lib/types'

/** Cart lines are kept in the browser. Prices are never stored: the server prices every quote. */
export interface CartItem extends CartLine {
  // display snapshot so the cart renders instantly; refreshed from the server quote
  product_name: string
  variant_name: string
  slug: string
  image_url: string | null
  unit_price_paise: number
}

const KEY = 'sanjaya.cart.v1'
export const MAX_QTY = 20

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is CartItem => typeof i?.variant_id === 'string' && Number.isInteger(i?.quantity) && i.quantity > 0,
    )
  } catch {
    return []
  }
}

export function saveCart(items: CartItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* private mode: cart lives in memory only */ }
}

export function addItem(items: CartItem[], item: CartItem): CartItem[] {
  const existing = items.find((i) => i.variant_id === item.variant_id)
  if (existing) {
    return items.map((i) => (i.variant_id === item.variant_id ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + item.quantity) } : i))
  }
  return [...items, { ...item, quantity: Math.min(MAX_QTY, item.quantity) }]
}

export function setQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return items.filter((i) => i.variant_id !== variantId)
  return items.map((i) => (i.variant_id === variantId ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i))
}

export const toLines = (items: CartItem[]): CartLine[] => items.map(({ variant_id, quantity }) => ({ variant_id, quantity }))
