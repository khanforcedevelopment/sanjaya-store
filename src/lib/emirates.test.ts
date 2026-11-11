import { describe, expect, it } from 'vitest'
import { emirateFromName, emirateName, isEmirateCode } from './emirates'

describe('emirates', () => {
  it('maps OpenStreetMap state names to codes', () => {
    expect(emirateFromName('Dubai')).toBe('DXB')
    expect(emirateFromName('Abu Dhabi Emirate')).toBe('AUH')
    expect(emirateFromName('Emirate of Sharjah')).toBe('SHJ')
    expect(emirateFromName('Umm Al Qaiwain')).toBe('UAQ')
    expect(emirateFromName('Maharashtra')).toBeNull()
  })
  it('validates and names codes', () => {
    expect(isEmirateCode('RAK')).toBe(true)
    expect(isEmirateCode('400001')).toBe(false)
    expect(emirateName('FUJ')).toBe('Fujairah')
  })
})
