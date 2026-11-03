/* Sanjaya Store service worker: offline shell and fast repeat visits.
   Never caches API calls, payments or account data. */
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`
const ASSETS = `assets-${VERSION}`
const IMAGES = `images-${VERSION}`

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png'])).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS, IMAGES].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

async function trim(name, max) {
  const c = await caches.open(name); const keys = await c.keys()
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i])
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Pages: network first, fall back to the cached app shell, then the offline page
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone(); caches.open(SHELL).then((c) => c.put('/', copy)); return res
    }).catch(async () => (await caches.match('/')) || caches.match('/offline.html')))
    return
  }
  // Hashed build files never change: cache first
  if (url.origin === location.origin && url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(ASSETS).then((c) => c.put(req, copy)) } return res
    })))
    return
  }
  // Product and banner images (public bucket or our own folder): stale while revalidate, capped
  const isImage = req.destination === 'image' && (url.origin === location.origin || url.pathname.includes('/storage/v1/object/public/'))
  if (isImage) {
    e.respondWith(caches.open(IMAGES).then(async (c) => {
      const hit = await c.match(req)
      const net = fetch(req).then((res) => { if (res.ok) { c.put(req, res.clone()); trim(IMAGES, 300) } return res }).catch(() => hit)
      return hit || net
    }))
  }
  // Everything else (Supabase API, Stripe, maps) goes straight to the network
})
