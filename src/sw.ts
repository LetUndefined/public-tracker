/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA fallback: any navigation request that isn't a precached file
// gets served the cached index.html so Vue Router can handle the route
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/public-tracker/index.html'))
)

// When user taps a notification — focus the app or open it
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = '/public-tracker/'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes('/public-tracker/') && 'focus' in client) {
            return (client as WindowClient).focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})
