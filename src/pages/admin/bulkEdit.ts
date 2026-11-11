/** The bulk-edit form, and how it becomes the p_changes object for admin_bulk_update_products. */
export interface BulkForm {
  status: '' | 'live' | 'hidden'
  featured: '' | 'yes' | 'no'
  category_id: string
  brandOn: boolean; brand: string
  installment: '' | 'inherit' | 'yes' | 'no'
  addTags: string; removeTags: string
  priceMode: '' | 'set' | 'percent' | 'amount'; price: string
  mrpMode: '' | 'set' | 'clear' | 'markup'; mrp: string
  costMode: '' | 'set' | 'clear'; cost: string
  stockMode: '' | 'set' | 'add'; stock: string
  lowStock: string
}

export const EMPTY_BULK: BulkForm = {
  status: '', featured: '', category_id: '', brandOn: false, brand: '', installment: '', addTags: '', removeTags: '',
  priceMode: '', price: '', mrpMode: '', mrp: '', costMode: '', cost: '', stockMode: '', stock: '', lowStock: '',
}

const num = (v: string) => {
  const t = v.replace(/aed|%/gi, '').replace(/[,\s]/g, '')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const tags = (v: string) => v.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)

export type BulkChanges = Record<string, unknown>

/** Returns the changes to send, or an error message. Empty changes are an error too. */
export function buildBulkChanges(f: BulkForm): { changes: BulkChanges; summary: string[] } | { error: string } {
  const c: BulkChanges = {}
  const s: string[] = []
  if (f.status) { c.is_active = f.status === 'live'; s.push(f.status === 'live' ? 'Show in store' : 'Hide from store') }
  if (f.featured) { c.is_featured = f.featured === 'yes'; s.push(f.featured === 'yes' ? 'Feature on homepage' : 'Remove from featured') }
  if (f.category_id) { c.category_id = f.category_id; s.push('Move to another category') }
  if (f.brandOn) { c.brand = f.brand.trim(); s.push(f.brand.trim() ? `Brand → ${f.brand.trim()}` : 'Clear brand') }
  if (f.installment) { c.installment = f.installment; s.push(`Six installments: ${f.installment === 'inherit' ? 'same as category' : f.installment === 'yes' ? 'allowed' : 'not allowed'}`) }
  if (tags(f.addTags).length) { c.add_tags = tags(f.addTags); s.push(`Add tags: ${tags(f.addTags).join(', ')}`) }
  if (tags(f.removeTags).length) { c.remove_tags = tags(f.removeTags); s.push(`Remove tags: ${tags(f.removeTags).join(', ')}`) }

  if (f.priceMode) {
    const v = num(f.price)
    if (v === null) return { error: 'Enter the price change.' }
    if (f.priceMode === 'set' && v <= 0) return { error: 'The new price must be more than 0.' }
    if (f.priceMode === 'percent' && v <= -100) return { error: 'A price cut must be less than 100%.' }
    c.price = { mode: f.priceMode, value: v }
    s.push(f.priceMode === 'set' ? `Price → AED ${v.toFixed(2)}` : f.priceMode === 'percent' ? `Price ${v >= 0 ? '+' : ''}${v}%` : `Price ${v >= 0 ? '+' : '-'}AED ${Math.abs(v).toFixed(2)}`)
  }
  if (f.mrpMode) {
    const v = num(f.mrp)
    if (f.mrpMode !== 'clear' && (v === null || v <= 0)) return { error: 'Enter the was-price (or markup %).' }
    c.mrp = f.mrpMode === 'clear' ? { mode: 'clear' } : { mode: f.mrpMode, value: v }
    s.push(f.mrpMode === 'clear' ? 'Remove was-price' : f.mrpMode === 'set' ? `Was-price → AED ${v!.toFixed(2)}` : `Was-price = price + ${v}%`)
  }
  if (f.costMode) {
    const v = num(f.cost)
    if (f.costMode === 'set' && (v === null || v < 0)) return { error: 'Enter the cost price in AED.' }
    c.cost = f.costMode === 'clear' ? { mode: 'clear' } : { mode: 'set', value: v }
    s.push(f.costMode === 'clear' ? 'Remove cost price' : `Cost price → AED ${v!.toFixed(2)}`)
  }
  if (f.stockMode) {
    const v = num(f.stock)
    if (v === null || !Number.isInteger(v)) return { error: 'Enter a whole number for stock.' }
    if (f.stockMode === 'set' && v < 0) return { error: 'Stock cannot be negative.' }
    c.stock = { mode: f.stockMode, value: v }
    s.push(f.stockMode === 'set' ? `Stock → ${v} (each variant)` : `Stock ${v >= 0 ? '+' : ''}${v} (each variant)`)
  }
  if (f.lowStock.trim()) {
    const v = num(f.lowStock)
    if (v === null || v < 0 || !Number.isInteger(v)) return { error: 'Low-stock level must be a whole number.' }
    c.low_stock_threshold = v
    s.push(`Low-stock alert at ${v}`)
  }
  if (!Object.keys(c).length) return { error: 'Choose at least one change.' }
  return { changes: c, summary: s }
}
