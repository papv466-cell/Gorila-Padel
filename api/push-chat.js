/* public/sw.js */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/**
 * PUSH payload esperado:
 * {
 *   title, body, url, type, matchId
 * }
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || "Gorila Pádel";
  const body = data.body || "Tienes una notificación";
  const url = data.url || "/partidos";

  const options = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // IMPORTANT: guardamos TODO para usarlo en el click
    data: {
      url,
      type: data.type || null,
      matchId: data.matchId || null,
    },
    // opcional: agrupa notifs del mismo tipo
    tag: data.type ? `gp-${data.type}` : "gp",
    renotify: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

function toAbsoluteUrl(maybeRelativeUrl) {
  try {
    return new URL(maybeRelativeUrl, self.location.origin).href;
  } catch {
    return new URL("/partidos", self.location.origin).href;
  }
}

function extractOpenChatIdFromUrl(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get("openChat") || null;
  } catch {
    return null;
  }
}

/**
 * CLICK EN NOTIFICACIÓN
 * ✅ intenta reutilizar pestaña existente
 * ✅ navega a la URL ABSOLUTA
 * ✅ manda postMessage con matchId para forzar abrir chat aunque el query se pierda
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const absUrl = toAbsoluteUrl(data.url || "/partidos");

  // matchId puede venir en data o dentro de ?openChat=
  const matchId = data.matchId || extractOpenChatIdFromUrl(absUrl);

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 1) Preferimos una pestaña visible del MISMO origin
      const sameOriginClients = allClients.filter((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      const targetClient =
        sameOriginClients.find((c) => c.visibilityState === "visible") ||
        sameOriginClients[0];

      if (targetClient) {
        try {
          await targetClient.focus();

          // Navegamos a la ruta del chat
          if ("navigate" in targetClient) {
            await targetClient.navigate(absUrl);
          }

          // Y además enviamos mensaje para que la app abra el chat sí o sí
          if (matchId) {
            targetClient.postMessage({
              type: "GP_OPEN_CHAT",
              matchId,
              url: absUrl,
            });
          }

          return;
        } catch {
          // si falla, seguimos al openWindow
        }
      }

      // 2) Si no hay pestaña, abrimos una nueva
      const opened = await self.clients.openWindow(absUrl);

      // Nota: si no hay pestaña previa, no podemos garantizar postMessage inmediato.
      // Por eso mantenemos también ?openChat=... en la URL.
      return opened;
    })()
  );
});
