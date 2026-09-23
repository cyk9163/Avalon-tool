/* Only a public offline notice is cached. Game data and private cards never are. */
const OFFLINE_CACHE = "avalon-offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload", credentials: "omit" }));
  })());
  // Updates wait until old pages close: never reload an ongoing game.
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "轮到你了";
  const room = typeof payload.url === "string" && /^\/\?room=\d{6}$/.test(payload.url) ? payload.url : "/";
  event.waitUntil(self.registration.showNotification("圆桌", {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: room },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data && typeof event.notification.data.url === "string" ? event.notification.data.url : "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => window.url.includes(url));
    if (existing) return existing.focus();
    return self.clients.openWindow(url);
  }));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("avalon-offline-") && key !== OFFLINE_CACHE).map(key => caches.delete(key)));
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  // API requests, RSC responses and subresources go straight to the browser/network.
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  event.respondWith((async () => {
    try {
      // Preserve HTTP errors as returned by the server; only connectivity failures fall back.
      return await fetch(request, { cache: "no-store" });
    } catch {
      const cache = await caches.open(OFFLINE_CACHE);
      const offline = await cache.match(OFFLINE_URL);
      if (offline) {
        // Asset hosts may redirect /offline.html to /offline. A followed-redirect
        // Response cannot satisfy a navigation with redirect mode "manual".
        // Rebuild only this known public document, dropping redirect metadata and
        // transport headers such as Content-Encoding/Length from the cached fetch.
        return new Response(offline.body, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      return new Response("圆桌暂时无法连接，请恢复网络后刷新。", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  })());
});
