import { describe, expect, it } from 'vitest'
import { addressSchema, emptyAddress, formatAddressLines } from './addresses'

const valid = { ...emptyAddress, recipient_name: 'Priya Shah', phone: '050 123 4567', house: 'Villa 12', street: 'Al Wasl Road', city: 'Jumeirah', state: 'Dubai', pincode: 'DXB' }

describe('addressSchema', () => {
  it('normalises the phone and empty landmark', () => {
    const r = addressSchema.parse(valid)
    expect(r.phone).toBe('+971501234567')
    expect(r.landmark).toBeNull()
    expect(r.location_source).toBe('manual')
  })
  it('rejects an Indian pincode and phone', () => {
    const r = addressSchema.safeParse({ ...valid, pincode: '400050', phone: '98765 43210' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(['phone', 'pincode'])
  })
  it('formats lines', () => {
    expect(formatAddressLines({ ...valid, landmark: 'Mercato Mall' })).toEqual(['Villa 12, Al Wasl Road', 'Near Mercato Mall', 'Jumeirah, Dubai'])
  })
})
