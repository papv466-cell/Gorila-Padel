self.__GP_SW_MARK = "GP_SW_MARK_2026_01_20";
console.log("✅ SW PUBLIC OK:", self.__GP_SW_MARK);

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Gorila Padel";
  const body = data.body || "Nuevo aviso";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow((event.notification.data && event.notification.data.url) || "/partidos")
  );
});
