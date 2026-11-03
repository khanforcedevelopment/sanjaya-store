// Public sitemap.xml for search engines: home, categories, info pages and every active product.
import { Db } from '../_shared/clients.ts'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async () => {
  const site = (Deno.env.get('SITE_URL') ?? 'https://sanjayatrading.store').replace(/\/$/, '')
  try {
    const db = Db.admin()
    const [cats, prods] = await Promise.all([
      db.select<{ slug: string }>('categories', 'is_active=eq.true&select=slug'),
      db.select<{ slug: string; updated_at: string }>('products', 'is_active=eq.true&select=slug,updated_at&order=updated_at.desc&limit=45000'),
    ])
    const urls: [string, string | null][] = [
      ['/', null], ['/categories', null], ['/deals', null], ['/delivery', null], ['/installments', null],
      ['/about', null], ['/contact', null], ['/policies/terms', null], ['/policies/privacy', null], ['/policies/returns', null], ['/policies/shipping', null],
      ...cats.map((c) => [`/c/${c.slug}`, null] as [string, null]),
      ...prods.map((p) => [`/p/${p.slug}`, p.updated_at] as [string, string]),
    ]
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
      urls.map(([u, d]) => `  <url><loc>${esc(site + u)}</loc>${d ? `<lastmod>${d.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')
    }\n</urlset>\n`
    return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } })
  } catch (e) {
    console.error('sitemap', e)
    return new Response('Sitemap unavailable', { status: 503 })
  }
})
