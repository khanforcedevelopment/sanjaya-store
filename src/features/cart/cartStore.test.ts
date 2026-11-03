import { beforeEach, describe, expect, it } from 'vitest'
import { addItem, loadCart, saveCart, setQuantity, toLines, type CartItem } from './cartStore'

const item = (id: string, quantity = 1): CartItem => ({
  variant_id: id, quantity, product_name: 'P', variant_name: 'V', slug: 'p', image_url: null, unit_price_paise: 100,
})

describe('cart store', () => {
  beforeEach(() => localStorage.clear())
  it('merges the same variant and caps quantity', () => {
    let c = addItem([], item('a', 15))
    c = addItem(c, item('a', 10))
    expect(c).toHaveLength(1)
    expect(c[0]!.quantity).toBe(20)
  })
  it('removes a line when quantity reaches zero', () => {
    expect(setQuantity([item('a', 2)], 'a', 0)).toEqual([])
  })
  it('persists and ignores corrupt data', () => {
    saveCart([item('a', 2)])
    expect(loadCart()).toHaveLength(1)
    localStorage.setItem('sanjaya.cart.v1', '{bad json')
    expect(loadCart()).toEqual([])
  })
  it('sends only ids and quantities to the server', () => {
    expect(toLines([item('a', 3)])).toEqual([{ variant_id: 'a', quantity: 3 }])
  })
})
