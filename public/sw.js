// Our Week service worker: shows reminder notifications and opens the right day when one is tapped.
// It doesn't cache anything, so the site always loads fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Our Week", {
    body: d.body || "",
    tag: d.tag || undefined,       // "starting now" replaces that item's earlier reminder
    renotify: !!d.tag,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { day: d.day || "" },
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(e.notification.data && e.notification.data.day) ? e.notification.data.day : "";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      await w.focus();
      if (day) w.postMessage({ type: "open-day", day });
      return;
    }
    await self.clients.openWindow(day ? `/?day=${day}` : "/");
  })());
});
