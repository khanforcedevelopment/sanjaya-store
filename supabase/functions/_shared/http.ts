// Shared helpers for Edge Functions. Secrets come only from Supabase function secrets (Deno.env).

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://sanjayatrading.store,http://localhost:5173')
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
    Vary: 'Origin',
  }
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
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
