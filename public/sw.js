const CACHE_VERSION = 'gorila-v3';
const CACHE_NAME = CACHE_VERSION;

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname === '/' || url.pathname === '/index.html') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('google')) return;
  const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2)$/) && url.pathname.includes('-');
  if (!isStaticAsset) return;
  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
      })
    )
  );
});

// ── PUSH NOTIFICATIONS ──────────────────────────────────────
self.addEventListener('push', e => {
  let data = { title: '🦍 Gorila Pádel', body: 'Tienes una notificación nueva' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch {}

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    image: data.image || undefined,
    tag: data.tag || data.notificationId || 'gorila-notif',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/', notificationId: data.notificationId },
    actions: data.actions || [],
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// ── CLICK EN NOTIFICACIÓN ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', url });
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ── PUSH SUBSCRIPTION CHANGE ─────────────────────────────────
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then(sub => {
        // Notificar al cliente para que actualice la suscripción en BD
        return clients.matchAll().then(clients => {
          clients.forEach(c => c.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED', subscription: sub.toJSON() }));
        });
      })
  );
});
