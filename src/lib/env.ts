/**
 * Public runtime configuration.
 *
 * Every value here is compiled into the browser bundle, so it must be safe to
 * publish. parsePublicEnv refuses values that look like server secrets, so a
 * misplaced Stripe secret key or Supabase service_role key breaks the build
 * loudly instead of leaking.
 */

export interface PublicEnv {
  supabaseUrl: string | null
  supabaseAnonKey: string | null
  stripePublishableKey: string | null
  siteUrl: string
}

type RawEnv = Partial<Record<keyof ImportMetaEnv, string | undefined>> & Record<string, unknown>

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/^sk_(test|live)_/, 'a Stripe SECRET key (sk_...)'],
  [/^rk_(test|live)_/, 'a Stripe restricted key (rk_...)'],
  [/^whsec_/, 'a Stripe webhook secret (whsec_...)'],
]

function decodeJwtRole(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json) as { role?: unknown }
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

function clean(value: string | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

export function parsePublicEnv(raw: RawEnv): PublicEnv {
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || !value) continue
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(value.trim())) {
        throw new Error(`${name} contains ${label}. Secret keys must never be placed in the website build.`)
      }
    }
    if (decodeJwtRole(value.trim()) === 'service_role') {
      throw new Error(`${name} contains a Supabase service_role key. Use the anon public key instead.`)
    }
    if (value.trim().startsWith('sb_secret_')) {
      throw new Error(`${name} contains a Supabase secret key. Use the publishable/anon key instead.`)
    }
  }

  const stripeKey = clean(raw.VITE_STRIPE_PUBLISHABLE_KEY)
  if (stripeKey && !/^pk_(test|live)_/.test(stripeKey)) {
    throw new Error('VITE_STRIPE_PUBLISHABLE_KEY must start with pk_test_ or pk_live_.')
  }

  const supabaseUrl = clean(raw.VITE_SUPABASE_URL)
  if (supabaseUrl && !/^https:\/\//.test(supabaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(supabaseUrl)) {
    throw new Error('VITE_SUPABASE_URL must be an https:// URL.')
  }

  return {
    supabaseUrl,
    supabaseAnonKey: clean(raw.VITE_SUPABASE_ANON_KEY),
    stripePublishableKey: stripeKey,
    siteUrl: clean(raw.VITE_SITE_URL) ?? 'http://localhost:5173',
  }
}

export const env: PublicEnv = parsePublicEnv(import.meta.env)

export const isBackendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
export const isStripeLiveMode = env.stripePublishableKey?.startsWith('pk_live_') ?? false
