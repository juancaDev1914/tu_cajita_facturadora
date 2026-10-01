// Service Worker de Cajita POS — estrategia offline-first
// - App shell cacheado en la instalación
// - Navegación: network-first con respaldo al index.html cacheado
// - Estáticos: stale-while-revalidate (usa caché y actualiza en segundo plano)
//
// IMPORTANTE sobre los datos: el service worker NUNCA toca IndexedDB ni
// localStorage. Los datos del negocio viven ahí, así que un despliegue en
// Vercel no los borra: este archivo solo controla el CÓDIGO (HTML, JS, CSS).

const CACHE = 'cajita-pos-v3'
const CORE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  // NO se llama a skipWaiting() a propósito: si el service worker se activa
  // mientras el usuario está cobrando, se le cambiaría el código bajo los pies
  // a mitad de una venta. En su lugar se avisa a la app (evento 'updatefound')
  // y es el UpdateAlert quien decide cuándo recargar.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .catch(() => {
        // Un recurso que falla (icono nuevo, por ejemplo) no debe impedir instalar
      }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// La app pide activarlo explícitamente (botón "Actualizar ya")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // version.json SIEMPRE desde la red: es el archivo que le dice a la app que
  // hay un despliegue nuevo. Servirlo desde caché haría creer que todo está
  // actualizado cuando no lo está.
  if (url.pathname === '/version.json') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        new Response('null', { status: 503, headers: { 'Content-Type': 'application/json' } }),
      ),
    )
    return
  }

  // Navegación: red primero, si falla sirve el app shell
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  // Estáticos: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})