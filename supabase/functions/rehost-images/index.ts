// Copies product photos that point at another website (for example a supplier's CDN, added by the CSV
// import) into our own Storage bucket, then repoints the product_images rows at the copy. This way the
// shop never hotlinks a supplier: their links can break or change without affecting us. Idempotent:
// rows that already point at our storage or at a site path ("/...") are skipped.
import { Db, DbError } from '../_shared/clients.ts'
import { corsHeaders, json, requireEnv } from '../_shared/http.ts'

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

async function download(url: string) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SanjayaStoreImageImport/1.0)', Accept: 'image/avif,image/webp,image/jpeg,image/png,image/*' },
  })
  if (!res.ok) throw new Error(`supplier server answered ${res.status}`)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('image is larger than 10 MB')
  const body = new Uint8Array(await res.arrayBuffer())
  if (body.length > MAX_BYTES) throw new Error('image is larger than 10 MB')
  const kind = sniff(body)
  if (!kind) throw new Error('link did not return a JPG, PNG, WebP, GIF or AVIF image')
  return { body, ...kind }
}

async function upload(path: string, body: Uint8Array, type: string) {
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
