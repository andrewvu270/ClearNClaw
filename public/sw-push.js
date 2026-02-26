// Push notification event handlers for the service worker.
// This file is imported by the vite-plugin-pwa generated service worker
// via the workbox importScripts configuration.

self.addEventListener('push', (event) => {
  let data = { title: 'Clear & Claw', body: 'Time to get back on track!', taskId: null }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [100, 50, 100],
    data: { taskId: data.taskId, url: '/' },
    actions: [{ action: 'open', title: 'Open Task' }],
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const taskId = event.notification.data?.taskId
  const url = taskId ? `/tasks?focus=${taskId}` : '/tasks'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already an open window, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.navigate(url)
          return
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url)
    })
  )
})
