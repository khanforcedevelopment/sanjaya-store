import { describe, expect, it } from 'vitest'
import { formatINR, rupeesToPaise } from './money'

describe('money', () => {
  it('formats with Indian digit grouping', () => {
    expect(formatINR(12345678900)).toBe('₹12,34,56,789')
  })
  it('shows paise when present', () => {
    expect(formatINR(5050)).toBe('₹50.5')
  })
  it('converts rupees to integer paise without float drift', () => {
    expect(rupeesToPaise(19.99)).toBe(1999)
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30)
  })
  it('rejects fractional paise', () => {
    expect(() => formatINR(10.5)).toThrow()
  })
})
