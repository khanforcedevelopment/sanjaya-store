import { describe, expect, it } from 'vitest'
import { normaliseIndianMobile } from './phone'

describe('normaliseIndianMobile', () => {
  it.each([
    ['98765 43210', '+919876543210'], ['+91 98765-43210', '+919876543210'], ['09876543210', '+919876543210'], ['919876543210', '+919876543210'],
  ])('accepts %s', (input, want) => expect(normaliseIndianMobile(input)).toBe(want))
  it.each(['12345', '5876543210', '+1 415 555 0100'])('rejects %s', (input) => expect(normaliseIndianMobile(input)).toBeNull())
})
