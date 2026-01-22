// public/sw.js
// ✅ GP Service Worker

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("✅ GP SW activo: GP_SW_MARK_2026_01_21");
});

// Recibe push desde backend y muestra notificación
self.addEventListener("push", (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Global Padel";
    const body = data.body || "Tienes una notificación";
    const url = data.url || "/partidos"; // ✅ URL destino al click

    const options = {
      body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url }, // ✅ aquí guardamos la URL para notificationclick
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // fallback si viene texto plano
    const title = "Global Padel";
    const options = { body: "Tienes una notificación", data: { url: "/partidos" } };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// ✅ Al pulsar la notificación: abrir esa URL (o enfocar pestaña)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification?.data?.url || "/partidos";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Si ya hay una pestaña abierta, la enfocamos y la navegamos
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          // Navega a la url destino (abre chat si lleva openChat)
          client.navigate(urlToOpen);
          return;
        }
      }

      // Si no hay pestaña, abre nueva
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })()
  );
});
