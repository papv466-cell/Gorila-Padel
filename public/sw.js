// public/sw.js

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("✅ GP SW activo");
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

  const title = data.title || "Gorila Pádel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        url,
        type: data.type || null,
        matchId: data.matchId || null,
      },
    })
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

      // ✅ Si ya hay una pestaña abierta: enfocamos y MANDAMOS MENSAJE (sin recarga, sin splash)
      for (const client of allClients) {
        try {
          if ("focus" in client) await client.focus();

          // Mandamos el deep link para que React Router navegue sin reload
          if ("postMessage" in client) {
            client.postMessage({
              type: "NAVIGATE",
              url: targetPath, // IMPORTANTE: path relativo con query ?openChat=
            });
            return;
          }
        } catch {
          // seguimos intentando con otros clients
        }
      }

      // ✅ Si no hay pestaña abierta: abrimos nueva (aquí sí habrá splash porque es arranque real)
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
