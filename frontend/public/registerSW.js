if ("serviceWorker" in navigator) {
  const clearLegacyCaches = () => {
    if (!window.caches) return Promise.resolve();
    return caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))));
  };

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => undefined)
      .finally(() => {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
        clearLegacyCaches();
      });
  });

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "UOR_CONNECT_CACHE_CLEARED") {
      clearLegacyCaches();
    }
  });
}
