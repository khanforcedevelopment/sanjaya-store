import { describe, expect, it } from 'vitest'
import { EMPTY_BULK, buildBulkChanges } from './bulkEdit'

describe('buildBulkChanges', () => {
  it('needs at least one change', () => {
    expect(buildBulkChanges(EMPTY_BULK)).toEqual({ error: 'Choose at least one change.' })
  })
  it('builds the server payload', () => {
    const r = buildBulkChanges({ ...EMPTY_BULK, status: 'hidden', addTags: 'Sale, Eid ', priceMode: 'percent', price: '-10', costMode: 'set', cost: 'AED 12.50', stockMode: 'add', stock: '5' })
    expect('changes' in r && r.changes).toEqual({
      is_active: false, add_tags: ['sale', 'eid'], price: { mode: 'percent', value: -10 },
      cost: { mode: 'set', value: 12.5 }, stock: { mode: 'add', value: 5 },
    })
  })
  it('rejects bad numbers', () => {
    expect(buildBulkChanges({ ...EMPTY_BULK, priceMode: 'set', price: '0' })).toHaveProperty('error')
    expect(buildBulkChanges({ ...EMPTY_BULK, priceMode: 'percent', price: '-100' })).toHaveProperty('error')
    expect(buildBulkChanges({ ...EMPTY_BULK, stockMode: 'set', stock: '1.5' })).toHaveProperty('error')
    expect(buildBulkChanges({ ...EMPTY_BULK, mrpMode: 'markup', mrp: '' })).toHaveProperty('error')
  })
  it('clearing needs no value, and an empty brand clears it', () => {
    const r = buildBulkChanges({ ...EMPTY_BULK, mrpMode: 'clear', brandOn: true, brand: '' })
    expect('changes' in r && r.changes).toEqual({ mrp: { mode: 'clear' }, brand: '' })
  })
})
