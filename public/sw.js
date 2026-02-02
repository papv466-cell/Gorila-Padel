// public/sw.js

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("✅ GP SW activo");
});

// 🔔 PUSH
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}

  const title = data.title || "Gorila Pádel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  const payloadForClients = {
    type: "PUSH_RECEIVED",
    title,
    body,
    url,
    // extras opcionales
    pushType: data.type || null,
    matchId: data.matchId || null,
    classId: data.classId || null,
  };

  event.waitUntil(
    (async () => {
      // 1) Mostrar notificación SIEMPRE
      await self.registration.showNotification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        data: {
          url,
          type: data.type || null,
          matchId: data.matchId || null,
          classId: data.classId || null,
        },
      });

      // 2) Si hay pestañas/ventanas abiertas, avisar a React (para sonido gorila)
      //    OJO: el SW no puede reproducir audio; solo manda un mensaje.
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          if ("postMessage" in client) client.postMessage(payloadForClients);
        } catch {}
      }
    })()
  );
});

// 👉 CLICK EN NOTIFICACIÓN
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

      // ✅ Si ya hay una pestaña abierta: enfocamos y mandamos NAVIGATE (sin reload)
      for (const client of allClients) {
        try {
          if ("focus" in client) await client.focus();

          if ("postMessage" in client) {
            client.postMessage({
              type: "NAVIGATE",
              url: targetPath,
            });

            // 🔊 además, avisamos de que fue “click en notificación”
            client.postMessage({
              type: "PUSH_CLICKED",
              url: targetPath,
              pushType: data.type || null,
              matchId: data.matchId || null,
              classId: data.classId || null,
            });

            return;
          }
        } catch {}
      }

      // ✅ Si no hay pestaña abierta: abrimos nueva
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })()
  );
});
