import { describe, expect, it } from 'vitest'
import { displayUaeMobile, localUaeMobile, normaliseUaeMobile } from './phone'

describe('normaliseUaeMobile', () => {
  it.each([
    ['050 123 4567', '+971501234567'], ['50 123 4567', '+971501234567'], ['+971 50 123 4567', '+971501234567'],
    ['00971 55 987 6543', '+971559876543'], ['971-56-911-0077', '+971569110077'],
  ])('accepts %s', (input, want) => expect(normaliseUaeMobile(input)).toBe(want))
  it.each(['12345', '04 123 4567', '+91 98765 43210', '051 123 4567'])('rejects %s', (input) => expect(normaliseUaeMobile(input)).toBeNull())
  it('formats for display and editing', () => {
    expect(displayUaeMobile('+971501234567')).toBe('+971 50 123 4567')
    expect(localUaeMobile('+971501234567')).toBe('50 123 4567')
  })
})
