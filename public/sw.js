/* eslint-disable */
/**
 * Finance Tracker service worker.
 *
 * Strategy: network-first with a cache fallback.
 * Field agents are online most of the time but lose signal without warning, so
 * fresh data wins and the cache is only the safety net.
 *
 * Hard rules:
 * - NEVER cache anything under /api/. Money data must come from the server.
 * - NEVER cache a non-GET request.
 * - Bump CACHE_VERSION whenever the shell changes; `activate` deletes the rest.
 */

const CACHE_VERSION = 'v1'
const CACHE_NAME = `finance-tracker-${CACHE_VERSION}`

/** App shell — precached on install so a cold offline start still renders. */
const PRECACHE_URLS = ['/', '/offline', '/manifest.json', '/favicon.ico']

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // One missing URL must not fail the whole install.
      .then(cache => Promise.all(PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function isCacheable(request) {
  if (request.method !== 'GET') return false

  const url = new URL(request.url)

  // Same-origin only. Do not cache third-party requests.
  if (url.origin !== self.location.origin) return false

  // Never cache API responses — they are money data and auth-scoped.
  if (url.pathname.startsWith('/api/')) return false

  // Auth routes must always hit the network.
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/logout')) return false

  return true
}

self.addEventListener('fetch', event => {
  const request = event.request

  // Non-GET (every write) goes straight to the network, untouched.
  // lib/offline-queue.ts owns retrying those.
  if (request.method !== 'GET') return

  if (!isCacheable(request)) return

  event.respondWith(
    fetch(request)
      .then(response => {
        // Only store a real, complete, successful response.
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {})
        }
        return response
      })
      .catch(() =>
        caches.match(request).then(cached => {
          if (cached) return cached
          // A navigation with nothing cached: fall back to the shell.
          if (request.mode === 'navigate') {
            return caches.match('/offline').then(offline => offline || caches.match('/'))
          }
          return Response.error()
        }),
      ),
  )
})
