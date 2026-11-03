import { describe, expect, it } from 'vitest'
import { addressSchema, emptyAddress, formatAddressLines } from './addresses'

const valid = { ...emptyAddress, recipient_name: 'Priya Shah', phone: '98765 43210', house: '12B', street: 'Linking Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' }

describe('addressSchema', () => {
  it('normalises the phone and empty landmark', () => {
    const r = addressSchema.parse(valid)
    expect(r.phone).toBe('+919876543210')
    expect(r.landmark).toBeNull()
    expect(r.location_source).toBe('manual')
  })
  it('rejects a bad pincode and phone', () => {
    const r = addressSchema.safeParse({ ...valid, pincode: '012345', phone: '12345' })
    expect(r.success).toBe(false)
    expect(r.error!.issues.map((i) => i.path[0]).sort()).toEqual(['phone', 'pincode'])
  })
  it('formats lines', () => {
    expect(formatAddressLines({ ...valid, landmark: 'Bandra station' })).toEqual(['12B, Linking Road', 'Near Bandra station', 'Mumbai, Maharashtra 400050'])
  })
})
