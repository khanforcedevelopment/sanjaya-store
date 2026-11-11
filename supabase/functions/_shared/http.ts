// Shared helpers for Edge Functions. Secrets come only from Supabase function secrets (Deno.env).

// Production origins only. For local development set ALLOWED_ORIGINS=http://localhost:5173 in
// supabase/functions/.env (never on the live project).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sanjayatrading.store,https://www.sanjayatrading.store')
  .split(',').map((s) => s.trim()).filter(Boolean)

function originAllowed(origin: string | null): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  // Netlify deploy previews of this site
  return /^https:\/\/[a-z0-9-]+--sanjayatrading\.netlify\.app$/.test(origin)
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  return {
    'Access-Control-Allow-Origin': originAllowed(origin) ? origin! : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}

/** Base URL for Stripe redirects: the caller's origin if it is ours, otherwise the main site. */
export function siteUrl(req: Request): string {
  const origin = req.headers.get('origin')
  return originAllowed(origin) ? origin! : (Deno.env.get('SITE_URL') ?? ALLOWED_ORIGINS[0])
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Server is missing ${name}`)
  return v
}

/** Constant-time string comparison (for secrets). */
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * True only when the request carries one of this project's server keys (legacy service_role JWT or
 * a new sb_secret_ key), compared exactly. A JWT is never trusted just because it says role=service_role.
 */
export function hasServerKey(req: Request): boolean {
  const keys = [Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '']
  try { keys.push(...Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>)) } catch { /* not set */ }
  const sent = [(req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, ''), req.headers.get('apikey') ?? '']
  return keys.some((k) => !!k && sent.some((s) => safeEqual(s, k)))
}
