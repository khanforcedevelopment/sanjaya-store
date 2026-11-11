import { describe, expect, it } from 'vitest'
import { liveBanners } from './api'

const b = (is_active: boolean, starts_at: string | null = null, ends_at: string | null = null) => ({ is_active, starts_at, ends_at })

describe('liveBanners', () => {
  const now = Date.parse('2026-11-11T12:00:00Z')
  it('drops switched-off banners (staff can read them)', () => {
    expect(liveBanners([b(true), b(false)], now)).toHaveLength(1)
  })
  it('respects the schedule window', () => {
    expect(liveBanners([b(true, '2026-11-12T00:00:00Z'), b(true, null, '2026-11-10T00:00:00Z'), b(true, '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z')], now)).toHaveLength(1)
  })
})
