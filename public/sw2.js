// public/sw.js

const SW_VERSION = "3.0.0";
const CACHE_NAME = "gp-cache-" + SW_VERSION;

self.addEventListener("install", (e) => {
  self.skipWaiting();
  console.log("✅ SW instalado v" + SW_VERSION);
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  console.log("✅ GP SW activo v" + SW_VERSION);
});

// ─── helper: mandar mensaje a TODAS las pestañas abiertas ───────────────────
async function broadcastMessage(msg) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  for (const client of allClients) {
    try { client.postMessage(msg); } catch {}
  }
}

// ─── Mensajes desde la app ──────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  const data = event?.data || {};
  const type = String(data.type || "");

  if (type === "PUSH_RECEIVED") {
    event.waitUntil(
      broadcastMessage({
        type: "PUSH_RECEIVED",
        title: data.title || "TEST 🦍",
        body: data.body || "",
        url: data.url || "/partidos",
      })
    );
  }
});

// ─── Push recibido ──────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || "Gorila Pádel 🦍";
  const body = data.body || "Tienes una notificación";
  const url = data.data?.url || data.url || "/partidos";
  const matchId = data.data?.matchId || data.matchId || null;
  const notifType = data.data?.type || data.type || null;

  event.waitUntil(
    (async () => {
      // Si la app está abierta → mandar mensaje para que suene en app
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const appOpen = allClients.length > 0;

      if (appOpen) {
        await broadcastMessage({ type: "PUSH_RECEIVED", title, body, url });
      }

      // Siempre mostrar notificación del sistema
      return self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],       // vibración gorila 🦍
        silent: true,                    // ← evita el sonido del sistema
        data: { url, type: notifType, matchId },
      });
    })()
  );
});

// ─── Click en notificación ──────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetPath = data.url || "/partidos";
  const targetUrl = new URL(targetPath, self.location.origin).toString();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      if (allClients.length > 0) {
        // App abierta → enfocar + navegar + sonar
        const client = allClients[0];
        try { await client.focus(); } catch {}

        // PUSH_CLICKED → App.jsx reproduce el sonido y despacha el evento gp:push
        client.postMessage({ type: "PUSH_CLICKED", title: event.notification.title, body: event.notification.body, url: targetPath });
        // NAVIGATE → App.jsx navega a la URL
        client.postMessage({ type: "NAVIGATE", url: targetPath });
      } else {
        // App cerrada → abrir nueva pestaña (el sonido se reproducirá cuando cargue)
        if (self.clients.openWindow) {
          await self.clients.openWindow(targetUrl);
        }
      }
    })()
  );
});
