const clearLegacyCaches = () =>
  caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))));

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(clearLegacyCaches());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await clearLegacyCaches();
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: "UOR_CONNECT_CACHE_CLEARED" });
      }
      await self.registration.unregister();
    })(),
  );
});

self.addEventListener("fetch", () => {
  // Let the network/browser handle every request. This file only clears old PWA caches.
});
