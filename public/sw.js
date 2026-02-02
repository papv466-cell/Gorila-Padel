// public/sw.js

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("✅ GP SW activo");
});

// ✅ helper: mandar mensaje a TODAS las pestañas abiertas (clientes)
async function broadcastMessage(msg) {
  const allClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  for (const client of allClients) {
    try {
      client.postMessage(msg);
    } catch {}
  }
}

// ✅ Recibir mensajes desde la app (para tests y para cosas futuras)
self.addEventListener("message", (event) => {
  const data = event?.data || {};
  const type = String(data.type || "");

  // ✅ TEST: simular push recibido estando la app abierta
  if (type === "PUSH_RECEIVED") {
    // reenviamos a la app para que suene el gorila
    event.waitUntil(
      broadcastMessage({
        type: "PUSH_RECEIVED",
        title: data.title || "TEST 🦍",
        body: data.body || "Si ves esto dentro de la app, ya está.",
        url: data.url || "/partidos",
      })
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

  const title = data.title || "Gorila Pádel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  // ✅ si la app está abierta, además de mostrar notificación
  // le mandamos un mensaje para que suene el gorila en App.jsx
  event.waitUntil(
    (async () => {
      // 1) sonido en app abierta
      await broadcastMessage({
        type: "PUSH_RECEIVED",
        title,
        body,
        url,
      });

      // 2) notificación del sistema (cuando esté en background)
      return self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url,
          type: data.type || null,
          matchId: data.matchId || null,
        },
      });
    })()
  );
});

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

      // ✅ Si ya hay una pestaña abierta: enfocamos y navegamos sin reload
      for (const client of allClients) {
        try {
          if ("focus" in client) await client.focus();

          if ("postMessage" in client) {
            client.postMessage({
              type: "PUSH_CLICKED",
              url: targetPath,
            });

            // y además usamos tu NAVIGATE (sin reload)
            client.postMessage({
              type: "NAVIGATE",
              url: targetPath,
            });
            return;
          }
        } catch {}
      }

      // ✅ Si no hay pestaña abierta: abrimos nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
