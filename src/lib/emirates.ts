/**
 * The seven emirates. Delivery is priced per emirate; the code is stored in the
 * address/order "pincode" field (the UAE has no postal codes).
 */
export const EMIRATES = [
  { code: 'DXB', name: 'Dubai' },
  { code: 'AUH', name: 'Abu Dhabi' },
  { code: 'SHJ', name: 'Sharjah' },
  { code: 'AJM', name: 'Ajman' },
  { code: 'UAQ', name: 'Umm Al Quwain' },
  { code: 'RAK', name: 'Ras Al Khaimah' },
  { code: 'FUJ', name: 'Fujairah' },
] as const

export type EmirateCode = (typeof EMIRATES)[number]['code']

export const isEmirateCode = (v: string | null | undefined): v is EmirateCode => EMIRATES.some((e) => e.code === v)

export const emirateName = (code: string | null | undefined): string => EMIRATES.find((e) => e.code === code)?.name ?? (code ?? '')

/** Matches English names like "Dubai", "Abu Dhabi Emirate" or "Emirate of Sharjah". */
export function emirateFromName(name: string | null | undefined): EmirateCode | null {
  const n = (name ?? '').toLowerCase().replace(/emirate( of)?/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!n) return null
  const hit = EMIRATES.find((e) => n === e.name.toLowerCase() || n.includes(e.name.toLowerCase()))
  if (hit) return hit.code
  if (n.includes('ras al khaima') || n === 'rak') return 'RAK'
  if (n.includes('umm al qaiwain') || n.includes('umm al quwain')) return 'UAQ'
  return null
}
