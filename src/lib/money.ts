/**
 * Money is stored and calculated in fils (integer, 1 AED = 100 fils) to avoid
 * floating-point rounding errors. Format only at the edge, for display.
 * Database columns keep their historical "_paise" suffix but hold fils.
 */

export type Fils = number

export const CURRENCY = 'AED'
/** UAE VAT, included in every shelf price. */
export const VAT_RATE_PERCENT = 5

const whole = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const exact = new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function aedToFils(aed: number): Fils {
  if (!Number.isFinite(aed)) throw new Error('Amount must be a finite number')
  return Math.round(aed * 100)
}

/** "AED 1,299" for whole dirhams, "AED 21.50" otherwise. */
export function formatAED(fils: Fils): string {
  if (!Number.isInteger(fils)) throw new Error('Amount in fils must be an integer')
  const n = Math.abs(fils) / 100
  const s = fils % 100 === 0 ? whole.format(n) : exact.format(n)
  return `${fils < 0 ? '-' : ''}AED ${s}`
}
