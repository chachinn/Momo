// ========================================
// MOMO SERVICE WORKER
// Reliable GitHub Pages + iPhone PWA updates
// ========================================

const CACHE_NAME = "momo-shell-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260808-1",
  "./app.js?v=20260808-1",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];


// Install the current shell, but do not block forever
// if one optional asset is temporarily unavailable.
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(
            new Request(url, {
              cache: "reload"
            })
          )
        )
      );
    })
  );
});


// Remove only old Momo shell caches.
// IndexedDB, localStorage, expenses, trips, budgets,
// photos, favorites, and appearance settings are untouched.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) =>
              key.startsWith("momo-shell-") &&
              key !== CACHE_NAME
            )
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});


function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}


function isAppCodeRequest(request) {
  const url = new URL(request.url);

  return (
    request.mode === "navigate" ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/app.js") ||
    url.pathname.endsWith("/styles.css") ||
    url.pathname.endsWith("/manifest.json")
  );
}


// HTML, JS, CSS, and manifest:
// NETWORK FIRST so GitHub updates are preferred.
// If offline, fall back to the last working cached copy.
//
// Static same-origin assets:
// CACHE FIRST for fast/offline loading, while a successful
// network response refreshes the cache where appropriate.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (
    request.method !== "GET" ||
    !isSameOrigin(request)
  ) {
    return;
  }

  if (isAppCodeRequest(request)) {
    event.respondWith(
      fetch(
        new Request(request, {
          cache: "no-store"
        })
      )
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
            });
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);

          if (cached) {
            return cached;
          }

          if (request.mode === "navigate") {
            return (
              (await caches.match("./index.html")) ||
              (await caches.match("./"))
            );
          }

          throw new Error("Momo is offline and this resource is not cached.");
        })
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (
          response &&
          response.ok
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});
