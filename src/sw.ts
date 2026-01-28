/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

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
