import { describe, expect, it } from 'vitest'
import { resolveAsk } from './ask'

describe('resolveAsk', () => {
  it('opens the page a question is about', () => {
    expect(resolveAsk('pending orders')).toBe('/admin/orders?status=awaiting_approval')
    expect(resolveAsk('Delivery fleet')).toBe('/admin/fleet')
    expect(resolveAsk('which items are low stock?')).toBe('/admin/products?stock=low')
    expect(resolveAsk('out of stock')).toBe('/admin/products?stock=out')
    expect(resolveAsk('top customers')).toBe('/admin/customers')
    expect(resolveAsk('profit this month')).toBe('/admin/reports')
    expect(resolveAsk('add product')).toBe('/admin/products/new')
  })
  it('finds an order number', () => {
    expect(resolveAsk('snj 1042')).toBe('/admin/orders?q=SNJ1042')
  })
  it('falls back to a product search and ignores empty input', () => {
    expect(resolveAsk('  Milton lunch box ')).toBe('/admin/products?q=Milton%20lunch%20box')
    expect(resolveAsk('   ')).toBeNull()
  })
})

describe('resolveAsk order of rules', () => {
  it('keeps payment and zone questions apart from orders and fleet', () => {
    expect(resolveAsk('payment pending')).toBe('/admin/orders?status=payment_pending')
    expect(resolveAsk('delivery fee for Sharjah')).toBe('/admin/delivery')
  })
})
