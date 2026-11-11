// Copies product photos that point at another website (for example a supplier's CDN, added by the CSV
// import) into our own Storage bucket, then repoints the product_images rows at the copy. This way the
// shop never hotlinks a supplier: their links can break or change without affecting us. Idempotent:
// rows that already point at our storage or at a site path ("/...") are skipped.
import { Db, DbError } from '../_shared/clients.ts'
import { corsHeaders, json, requireEnv } from '../_shared/http.ts'
import { assertPublicHttpsUrl, isPrivateIp, parseHostList } from '../_shared/url-guard.ts'

const MAX_BYTES = 10 * 1024 * 1024
const MAX_SLUGS = 25
const BUCKET = 'product-images'

interface Product { id: string; slug: string }
interface Image { id: string; product_id: string; url: string }

/** Detects the image type from its first bytes, so a mislabelled or non-image download is refused. */
export function sniff(b: Uint8Array): { ext: string; type: string } | null {
  const s = (o: number, t: string) => [...t].every((c, i) => b[o + i] === c.charCodeAt(0))
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' }
  if (b[0] === 0x89 && s(1, 'PNG')) return { ext: 'png', type: 'image/png' }
  if (s(0, 'RIFF') && s(8, 'WEBP')) return { ext: 'webp', type: 'image/webp' }
  if (s(0, 'GIF8')) return { ext: 'gif', type: 'image/gif' }
  if (s(4, 'ftyp') && (s(8, 'avif') || s(8, 'avis'))) return { ext: 'avif', type: 'image/avif' }
  return null
}

async function sha(text: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return [...d.slice(0, 10)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

const MAX_REDIRECTS = 3
// Optional: IMAGE_HOST_ALLOWLIST="ourshopee.com,cdn.example.com" limits downloads to those domains.
const ALLOW_HOSTS = parseHostList(Deno.env.get('IMAGE_HOST_ALLOWLIST'))

/** Refuses host names that resolve to a private or internal address (DNS check, best effort). */
async function assertResolvesPublic(host: string) {
  const resolve = (Deno as unknown as { resolveDns?: (h: string, t: 'A' | 'AAAA') => Promise<string[]> }).resolveDns
  if (!resolve) return
  const ips = (await Promise.all([resolve(host, 'A').catch(() => []), resolve(host, 'AAAA').catch(() => [])])).flat()
  if (ips.some(isPrivateIp)) throw new Error('link points to an internal address')
}

async function readCapped(res: Response): Promise<Uint8Array<ArrayBuffer>> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('image is larger than 10 MB') }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.length }
  return out
}

async function download(url: string) {
  // Follow redirects by hand so every hop is checked (a public link must not bounce to an internal one).
  let target = assertPublicHttpsUrl(url, ALLOW_HOSTS)
  let res: Response | null = null
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertResolvesPublic(target.hostname)
    res = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SanjayaStoreImageImport/1.0)', Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*' },
    })
    if (res.status < 300 || res.status > 399) break
    const next = res.headers.get('location')
    await res.body?.cancel()
    if (!next || hop === MAX_REDIRECTS) throw new Error('too many redirects')
    target = assertPublicHttpsUrl(new URL(next, target).href, ALLOW_HOSTS)
  }
  if (!res || !res.ok) throw new Error(`supplier server answered ${res?.status ?? 'nothing'}`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) { await res.body?.cancel(); throw new Error('image is larger than 10 MB') }
  const body = await readCapped(res)
  const kind = sniff(body)
  if (!kind) throw new Error('link did not return a JPG, PNG, WebP, GIF or AVIF image')
  return { body, ...kind }
}

async function upload(path: string, body: Uint8Array<ArrayBuffer>, type: string) {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const res = await fetch(`${requireEnv('SUPABASE_URL')}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: key, ...(key.split('.').length === 3 ? { Authorization: `Bearer ${key}` } : {}),
      'Content-Type': type, 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000',
    },
    body,
  })
  if (!res.ok) throw new Error(`storage upload failed (${res.status})`)
  return `${requireEnv('SUPABASE_URL')}/storage/v1/object/public/${BUCKET}/${path}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405)
  try {
    const { product_slugs } = await req.json().catch(() => ({}))
    const caller = Db.asUser(req)
    if (!(await caller.user())) return json(req, { error: 'Please sign in to continue.' }, 401)
    if (!(await caller.rpc<boolean>('has_any_role', { p_roles: ['operations'] }))) return json(req, { error: 'Not allowed' }, 403)
    const slugs = Array.isArray(product_slugs) ? [...new Set(product_slugs.map(String))] : []
    if (!slugs.length || slugs.length > MAX_SLUGS || slugs.some((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s))) {
      return json(req, { error: `Send 1 to ${MAX_SLUGS} product slugs.` }, 400)
    }

    const admin = Db.admin()
    const products = await admin.select<Product>('products', `slug=in.(${slugs.join(',')})&select=id,slug`)
    if (!products.length) return json(req, { copied: 0, failed: [] })
    const slugOf = new Map(products.map((p) => [p.id, p.slug]))
    const own = `${requireEnv('SUPABASE_URL')}/storage/`
    const images = (await admin.select<Image>('product_images', `product_id=in.(${products.map((p) => p.id).join(',')})&select=id,product_id,url`))
      .filter((i) => /^https?:\/\//i.test(i.url) && !i.url.startsWith(own))

    let copied = 0
    const failed: { product_slug: string; url: string; error: string }[] = []
    const queue = [...images]
    const worker = async () => {
      for (let img = queue.shift(); img; img = queue.shift()) {
        const slug = slugOf.get(img.product_id)!
        try {
          const file = await download(img.url)
          const url = await upload(`imported/${slug}/${await sha(img.url)}.${file.ext}`, file.body, file.type)
          await admin.update('product_images', `id=eq.${img.id}`, { url })
          copied++
        } catch (e) {
          failed.push({ product_slug: slug, url: img.url, error: e instanceof DbError ? 'database update failed' : (e as Error).message })
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    return json(req, { copied, failed })
  } catch (e) {
    console.error('rehost-images', e)
    return json(req, { error: 'Copying images failed. Please try again.' }, 500)
  }
})
