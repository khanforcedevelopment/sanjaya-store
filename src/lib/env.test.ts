import { describe, expect, it } from 'vitest'
import { parsePublicEnv } from './env'

const fakeJwt = (role: string) =>
  ['eyJhbGciOiJIUzI1NiJ9', btoa(JSON.stringify({ role })).replace(/=+$/, ''), 'sig'].join('.')

describe('parsePublicEnv', () => {
  it('accepts public values', () => {
    const env = parsePublicEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: fakeJwt('anon'),
      VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
    })
    expect(env.supabaseUrl).toBe('https://abc.supabase.co')
    expect(env.stripePublishableKey).toBe('pk_test_123')
  })

  it('treats missing values as not configured', () => {
    const env = parsePublicEnv({})
    expect(env.supabaseUrl).toBeNull()
    expect(env.stripePublishableKey).toBeNull()
  })

  it('rejects a Stripe secret key', () => {
    expect(() => parsePublicEnv({ VITE_STRIPE_PUBLISHABLE_KEY: 'sk_live_abc' })).toThrow(/SECRET/)
  })

  it('rejects a Stripe webhook secret in any variable', () => {
    expect(() => parsePublicEnv({ VITE_SITE_URL: 'whsec_abc' })).toThrow(/webhook/)
  })

  it('rejects a Supabase service_role key', () => {
    expect(() => parsePublicEnv({ VITE_SUPABASE_ANON_KEY: fakeJwt('service_role') })).toThrow(/service_role/)
  })

  it('rejects a non-https Supabase URL', () => {
    expect(() => parsePublicEnv({ VITE_SUPABASE_URL: 'http://abc.supabase.co' })).toThrow(/https/)
  })
})
