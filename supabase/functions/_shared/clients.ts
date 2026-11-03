// Dependency-free clients for Supabase (REST) and Stripe (HTTPS API), so functions boot fast and
// have no third-party packages to audit. Secrets come only from Supabase function secrets.
import { requireEnv } from './http.ts'

type Json = Record<string, unknown>

export class DbError extends Error {}

const isJwt = (key: string) => key.split('.').length === 3

/** Calls the database REST API, either as the service role (bypasses RLS) or as the signed-in caller. */
export class Db {
  /** `apikey` identifies the project key; `bearer` is a JWT (user session or legacy key) or empty. */
  constructor(private bearer: string, private apikey = requireEnv('SUPABASE_ANON_KEY')) {}
  /**
   * Service role. Hosted projects may inject either a legacy JWT key or a new `sb_secret_` key. A new
   * key is not a JWT, so it must go in `apikey` only: the API gateway rejects it as a Bearer token.
   */
  static admin() {
    const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    return new Db(isJwt(key) ? key : '', key)
  }
  static asUser(req: Request) { return new Db((req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')) }

  private async call(path: string, init: RequestInit & { prefer?: string } = {}) {
    const res = await fetch(`${requireEnv('SUPABASE_URL')}${path}`, {
      ...init,
      headers: {
        apikey: this.apikey, 'Content-Type': 'application/json',
        ...(this.bearer ? { Authorization: `Bearer ${this.bearer}` } : {}),
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
    })
    const text = await res.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { if (res.ok) throw new DbError(`Database returned non-JSON (${res.status})`) }
    if (!res.ok) throw new DbError(String(body?.message ?? body?.msg ?? `Database error ${res.status}: ${text.slice(0, 200)}`))
    return body
  }
  rpc<T = unknown>(fn: string, args: Json): Promise<T> { return this.call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) }) }
  select<T = Json>(table: string, query: string): Promise<T[]> { return this.call(`/rest/v1/${table}?${query}`) }
  insert(table: string, row: Json, onConflictIgnore = false) {
    return this.call(`/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(row), prefer: onConflictIgnore ? 'resolution=ignore-duplicates,return=minimal' : 'return=minimal' })
  }
  update(table: string, query: string, patch: Json) { return this.call(`/rest/v1/${table}?${query}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' }) }
  async user(): Promise<{ id: string; email?: string } | null> {
    try { return await this.call('/auth/v1/user') } catch { return null }
  }
}

// ---------- Stripe ----------
export class StripeError extends Error {}

function form(obj: unknown, prefix = '', out: string[] = []): string[] {
  if (obj === undefined || obj === null) return out
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Json)) form(v, prefix ? `${prefix}[${k}]` : k, out)
  } else out.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(obj))}`)
  return out
}
export const encodeForm = (obj: Json) => form(obj).join('&')

export async function stripe<T = Json>(path: string, params: Json, idempotencyKey?: string): Promise<T> {
  const base = Deno.env.get('STRIPE_API_BASE') ?? 'https://api.stripe.com' // override only for local tests
  const res = await fetch(`${base}/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2025-02-24.acacia', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: encodeForm(params),
  })
  const body = await res.json()
  if (!res.ok) throw new StripeError(body?.error?.message ?? `Stripe error ${res.status}`)
  return body as T
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Verifies a Stripe-Signature header (HMAC-SHA256, 5-minute tolerance). */
export async function verifyStripeSignature(payload: string, header: string, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]))
  const t = Number(parts.t)
  const sigs = header.split(',').filter((p) => p.trim().startsWith('v1=')).map((p) => p.trim().slice(3))
  if (!t || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`)))
  return sigs.some((s) => s.length === expected.length && [...s].reduce((acc, c, i) => acc | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0)
}

export const isLiveKey = (key: string) => key.startsWith('sk_live_') || key.startsWith('rk_live_')

/** Live payments stay off until the owner switches payments.live_enabled on in admin settings. */
export async function assertPaymentsAllowed(admin: Db, installment = false) {
  if (!isLiveKey(requireEnv('STRIPE_SECRET_KEY'))) return
  const rows = await admin.select<{ key: string; value: { live_enabled?: boolean } }>('site_settings', 'key=in.(payments,installments)&select=key,value')
  const on = (k: string) => rows.find((r) => r.key === k)?.value?.live_enabled === true
  if (!on('payments')) throw new Error('Live payments are not switched on yet')
  // Six-installment plans need their own switch (legal review pending)
  if (installment && !on('installments')) throw new Error('Live installments are not switched on yet')
}
