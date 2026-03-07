const CACHE_VERSION = 'gorila-v' + Date.now();
const CACHE_NAME = CACHE_VERSION;

// Al instalar, tomar control inmediatamente
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Al activar, eliminar TODOS los cachés anteriores
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          console.log('[SW] Eliminando caché viejo:', key);
          return caches.delete(key);
        })
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // No cachear NUNCA
  if (e.request.method !== 'GET') return;
  if (url.pathname === '/' || url.pathname === '/index.html') return; // ← CLAVE
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (url.hostname.includes('google')) return;

  // Solo cachear assets estáticos con hash en el nombre (JS, CSS, imágenes)
  const isStaticAsset = url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2)$/)
    && url.pathname.includes('-'); // los archivos con hash tienen guión: index-Bo-ZFzpW.js

  if (!isStaticAsset) return; // si no es asset estático, ni lo tocamos

  e.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(e.request).then(cached => {
        if (cached) return cached; // asset estático con hash → siempre válido
        return fetch(e.request).then(res => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        });
      })
    )
  );
});