/**
 * Minimal service worker — enables browser “Install app” (PWA).
 * Network-only: no offline data cache (staff app requires internet).
 */
const SW_VERSION = 'mojo-pms-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
