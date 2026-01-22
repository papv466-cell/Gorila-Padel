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

  const title = data.title || "Global Padel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url }, // guardamos el deep link
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetPath = data.url || "/partidos";

  // ✅ URL ABSOLUTA para que no se pierda el ?openChat=
  const targetUrl = new URL(targetPath, self.location.origin).toString();

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1) si hay pestaña abierta, la enfocamos y navegamos al deep link
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }

      // 2) si no hay ninguna, abrimos nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});

