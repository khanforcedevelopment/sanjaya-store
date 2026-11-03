import { describe, expect, it } from 'vitest'
import { parseNominatim } from './geocode'

describe('parseNominatim', () => {
  it('maps an Indian address', () => {
    const r = parseNominatim({ display_name: 'x', address: { road: 'Hill Road', suburb: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', postcode: '400 050' } })
    expect(r).toEqual({ pincode: '400050', street: 'Hill Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', display: 'x' })
  })
  it('ignores a non-Indian postcode', () => {
    expect(parseNominatim({ address: { postcode: 'SW1A 1AA', town: 'London' } })?.pincode).toBeNull()
  })
})
