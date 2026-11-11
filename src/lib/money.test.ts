import { describe, expect, it } from 'vitest'
import { aedToFils, formatAED } from './money'

describe('money', () => {
  it('formats whole dirhams with thousands grouping', () => {
    expect(formatAED(12345678900)).toBe('AED 123,456,789')
  })
  it('shows fils with two decimals', () => {
    expect(formatAED(2160)).toBe('AED 21.60')
    expect(formatAED(5)).toBe('AED 0.05')
  })
  it('converts dirhams to integer fils without float drift', () => {
    expect(aedToFils(19.99)).toBe(1999)
    expect(aedToFils(0.1 + 0.2)).toBe(30)
  })
  it('rejects fractional fils', () => {
    expect(() => formatAED(10.5)).toThrow()
  })
})
