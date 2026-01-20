self.__GP_SW_MARK__ = "GP_SW_MARK_2026_01_19";
/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ✅ Log para saber si ESTE sw.js es el que está activo
console.log("✅ GP SW cargado: src/sw.js");

// ✅ TEST PUSH (sin backend)
self.addEventListener("push", (event) => {
  console.log("✅ PUSH EVENT recibido", event);

  event.waitUntil(
    self.registration.showNotification("✅ Push OK (test)", {
      body: "Si ves esto, el SW recibe push.",
      icon: "/logo.png",
      badge: "/logo.png",
      data: { url: "/partidos" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/partidos";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })()
  );
});
