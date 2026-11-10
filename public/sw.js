const CACHE_NAME = 'bizbizeriders-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  let data = { title: 'BizBize Riders', body: 'Yeni bildirim var', type: 'message' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {}

  const options = {
    body: data.body || 'Yeni bir mesaj veya arama var',
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'Uygulamayı Aç' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'BizBize Riders', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
