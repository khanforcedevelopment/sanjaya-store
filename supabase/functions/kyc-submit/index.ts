// Customer submits identity documents for review. The ID number is normalised and hashed with a
// server-side secret (KYC_HASH_SALT) so duplicates can be found without ever storing the number.
import { Db, DbError } from '../_shared/clients.ts'
import { corsHeaders, json, requireEnv } from '../_shared/http.ts'

const FORMATS: Record<string, { re: RegExp; label: string }> = {
  emirates_id: { re: /^784[0-9]{12}$/, label: 'Emirates ID must be 15 digits starting with 784, e.g. 784-1990-1234567-1' },
  passport: { re: /^[A-Z0-9]{6,9}$/, label: 'Enter the passport number as printed (6 to 9 letters and digits)' },
  driving_licence: { re: /^[0-9]{5,10}$/, label: 'Enter the UAE driving licence number (digits only)' },
}

async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  try {
    const caller = Db.asUser(req)
    const user = await caller.user()
    if (!user) return json(req, { error: 'Please sign in to continue.' }, 401)
    const body = await req.json().catch(() => ({}))
    const type = String(body.document_type ?? '')
    const number = String(body.document_number ?? '').toUpperCase().replace(/[\s-]/g, '')
    const name = String(body.name_on_document ?? '').trim()
    const paths: string[] = Array.isArray(body.paths) ? body.paths.map(String) : []
    const fmt = FORMATS[type]
    if (!fmt) return json(req, { error: 'Choose a document type.' }, 400)
    if (!fmt.re.test(number)) return json(req, { error: fmt.label }, 400)
    if (name.length < 3 || name.length > 120) return json(req, { error: 'Enter your name exactly as printed on the document.' }, 400)
    if (body.consent !== true) return json(req, { error: 'Please agree to the identity check.' }, 400)
    if (paths.length < 2 || paths.length > 3 || paths.some((p) => !p.startsWith(`${user.id}/`) || p.includes('..'))) return json(req, { error: 'Upload the ID photo and a selfie.' }, 400)

    const hash = await hmac(requireEnv('KYC_HASH_SALT'), `${type}:${number}`)
    try {
      const result = await Db.admin().rpc('register_manual_kyc', {
        p_user: user.id, p_document_type: type, p_document_number_hash: hash, p_document_last4: number.slice(-4),
        p_name_on_document: name, p_paths: paths,
      })
      return json(req, result)
    } catch (e) {
      if (e instanceof DbError) return json(req, { error: e.message }, 400)
      throw e
    }
  } catch (e) {
    console.error('kyc-submit', e)
    return json(req, { error: 'Could not submit your documents. Please try again.' }, 500)
  }
})
