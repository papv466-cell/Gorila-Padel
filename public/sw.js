/* GP_SW_MARK_2026_01_21 */

self.__GP_SW_MARK = "GP_SW_MARK_2026_01_21";
console.log("✅ GP SW activo:", self.__GP_SW_MARK);

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/** PUSH */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Gorila Pádel", body: "Nuevo mensaje", url: "/partidos" };
  }

  const title = data.title || "Gorila Pádel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url },
      tag: data.tag || "gp-chat",
      renotify: true,
    })
  );
});

/** CLICK en NOTIFICACIÓN (aquí va lo de focus/navigate) */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/partidos";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        // si ya hay una pestaña abierta, la enfocamos y navegamos
        try {
          if ("focus" in client) await client.focus();
          if ("navigate" in client) {
            await client.navigate(url);
            return;
          }
        } catch {}
      }

      // si no hay pestaña, abrimos una nueva
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});

/** FETCH: solo arregla la navegación SPA */
self.addEventListener("fetch", (event) => {
  // Para rutas tipo /mapa /login /partidos (SPA)
  if (event.request.mode === "navigate") {
    event.respondWith(fetch("/index.html", { cache: "no-store" }));
    return;
  }  
});
