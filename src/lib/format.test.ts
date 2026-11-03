import { describe, expect, it } from 'vitest'
import { formatDate, formatDeliveryWindow, maskPhone } from './format'

describe('format', () => {
  it('formats India calendar dates without shifting the day', () => {
    expect(formatDate('2026-11-05')).toBe('5 Nov 2026')
  })
  it('formats a delivery window', () => {
    expect(formatDeliveryWindow('2026-11-05', '2026-11-09')).toMatch(/5 Nov.*9 Nov/)
    expect(formatDeliveryWindow(null, '2026-11-09')).toBeNull()
  })
  it('masks phone numbers', () => {
    expect(maskPhone('+919812345678')).toBe('+91 ••••• 678')
  })
})
