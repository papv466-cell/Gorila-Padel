/* eslint-disable no-restricted-globals */
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

console.log("GP_SW_MARK_2026_01_19");

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Push OK", {
      body: "Este es el SW NUEVO",
      icon: "/logo.png",
      data: { url: "/partidos" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/partidos"));
});
