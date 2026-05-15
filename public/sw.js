/* global self, clients */
const DEFAULT_ICON = "/icon-192.png";

self.addEventListener("push", (event) => {
  let title = "Kore";
  let body = "";
  let url = "/";
  try {
    if (event.data) {
      const json = event.data.json();
      if (typeof json?.title === "string") title = json.title;
      if (typeof json?.body === "string") body = json.body;
      if (typeof json?.url === "string") url = json.url;
    }
  } catch {
    try {
      const text = event.data?.text?.();
      if (text) body = text;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body || "Kore",
      icon: DEFAULT_ICON,
      badge: DEFAULT_ICON,
      data: { url: url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const origin = self.location.origin;
  const target = url.startsWith("http") ? url : `${origin}${url.startsWith("/") ? url : `/${url}`}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === target && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
    }),
  );
});
