/**
 * Money is stored and calculated in paise (integer, 1 INR = 100 paise) to
 * avoid floating-point rounding errors. Format only at the edge, for display.
 */

export type Paise = number

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new Error('Amount must be a finite number')
  return Math.round(rupees * 100)
}

export function formatINR(paise: Paise): string {
  if (!Number.isInteger(paise)) throw new Error('Amount in paise must be an integer')
  return inrFormatter.format(paise / 100)
}
