import { describe, expect, it } from 'vitest'
import { csvToObjects, parseCsv } from './csv'

describe('csv', () => {
  it('handles quotes, commas and newlines', () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi""\nthere"\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"\nthere']])
  })
  it('maps headers', () => {
    expect(csvToObjects('﻿Product Slug,SKU\nkurta,K1\n\n')).toEqual([{ product_slug: 'kurta', sku: 'K1' }])
  })
})
