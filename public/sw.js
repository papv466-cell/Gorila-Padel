/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

// ✅ Marca para comprobar que es ESTE
console.log("✅ GP SW cargado: public/sw.js");

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
