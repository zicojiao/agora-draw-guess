// Cache only this public offline screen and its icon. Never store game pages,
// API responses, drawings, access credentials, or queued game/AI requests.
const CACHE = 'draw-guess-offline-v1'
const PUBLIC_ASSETS = ['/offline.html', '/favicon-192x192.png']

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    await cache.addAll(PUBLIC_ASSETS)
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith('draw-guess-offline-') && name !== CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/access') return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => {
      const cache = await caches.open(CACHE)
      return await cache.match('/offline.html') || Response.error()
    }))
  } else if (PUBLIC_ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE)
      return await cache.match(url.pathname) || fetch(request)
    })())
  }
})
