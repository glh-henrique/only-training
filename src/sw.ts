/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Keep install lightweight: only precache app shell essentials.
// Route chunks are cached on-demand when users navigate.
const PRECACHE_PATTERNS = [
  /^index\.html$/,
  /^manifest\.webmanifest$/,
  /^registerSW\.js$/,
  /^favicon\./,
  /^apple-touch-icon\./,
  /^mask-icon\./,
  /^pwa-\d+x\d+\.png$/,
]

const minimalManifest = self.__WB_MANIFEST.filter((entry) => {
  const url = typeof entry === 'string' ? entry : entry.url
  return PRECACHE_PATTERNS.some((pattern) => pattern.test(url))
})

precacheAndRoute(minimalManifest)

registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'static-resources' }),
)

registerRoute(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({ cacheName: 'image-resources' }),
)

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'finish') {
    // We can't easily trigger the Zustand store from the SW directly
    // but we can tell the app to do it if it's open, or just open the app.
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({ type: 'FINISH_WORKOUT' })
            return client.focus()
          }
        }
        if (self.clients.openWindow) {
          // If no client is open, open the app with a query param
            return self.clients.openWindow('/only-training/#/home?action=finish-workout')
        }
      })
    )
  } else {
    // Default action (or 'continue'): just focus the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow('/only-training/')
      })
    )
  }
})
