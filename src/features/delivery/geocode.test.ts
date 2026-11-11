import { describe, expect, it } from 'vitest'
import { parseNominatim } from './geocode'

describe('parseNominatim', () => {
  it('maps a UAE address to its emirate', () => {
    const r = parseNominatim({ display_name: 'x', address: { road: 'Al Wasl Road', suburb: 'Jumeirah 1', city: 'Dubai', state: 'Dubai', country_code: 'ae' } })
    expect(r).toEqual({ pincode: 'DXB', street: 'Al Wasl Road, Jumeirah 1', city: 'Dubai', state: 'Dubai', display: 'x' })
  })
  it('understands "Abu Dhabi Emirate"', () => {
    expect(parseNominatim({ address: { city: 'Al Ain', state: 'Abu Dhabi Emirate', country_code: 'ae' } })).toMatchObject({ pincode: 'AUH', state: 'Abu Dhabi' })
  })
  it('ignores places outside the UAE', () => {
    expect(parseNominatim({ address: { postcode: '400050', city: 'Mumbai', state: 'Maharashtra', country_code: 'in' } })?.pincode).toBeNull()
  })
})
