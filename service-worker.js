// ========================================
// MOMO SERVICE WORKER — V5
// Atomic app-shell updates for iPhone PWA
// ========================================

const CACHE_NAME = "momo-shell-v5";

const APP_SHELL = [
  "./index.html",
  "./styles.css?v=20260808-5",
  "./app.js?v=20260808-5",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];


self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(
        APP_SHELL.map(
          (url) =>
            new Request(
              url,
              {
                cache: "reload"
              }
            )
        )
      )
    )
  );
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("momo-shell-") &&
              key !== CACHE_NAME
          )
          .map(
            (key) =>
              caches.delete(key)
          )
      )
    ).then(
      () =>
        self.clients.claim()
    )
  );
});


function sameOrigin(
  request
) {

  return (
    new URL(
      request.url
    ).origin ===
    self.location.origin
  );

}


function isVersionedAppAsset(
  request
) {

  const url =
    new URL(
      request.url
    );


  return (
    url.pathname.endsWith(
      "/app.js"
    ) ||
    url.pathname.endsWith(
      "/styles.css"
    )
  );

}


self.addEventListener("fetch", (event) => {
  const request =
    event.request;


  if (
    request.method !==
      "GET" ||
    !sameOrigin(
      request
    )
  ) {

    return;

  }


  if (
    request.mode ===
    "navigate"
  ) {

    event.respondWith(
      fetch(
        new Request(
          "./index.html",
          {
            cache: "no-store"
          }
        )
      )
        .then(
          (response) => {

            if (
              response.ok
            ) {

              caches.open(
                CACHE_NAME
              ).then(
                (cache) =>
                  cache.put(
                    "./index.html",
                    response.clone()
                  )
              );

            }


            return response;

          }
        )
        .catch(
          () =>
            caches.match(
              "./index.html"
            )
        )
    );


    return;

  }


  if (
    isVersionedAppAsset(
      request
    )
  ) {

    event.respondWith(
      fetch(
        new Request(
          request,
          {
            cache: "no-store"
          }
        )
      )
        .then(
          (response) => {

            if (
              response.ok
            ) {

              caches.open(
                CACHE_NAME
              ).then(
                (cache) =>
                  cache.put(
                    request,
                    response.clone()
                  )
              );

            }


            return response;

          }
        )
        .catch(
          () =>
            caches.match(
              request
            )
        )
    );


    return;

  }


  event.respondWith(
    caches.match(
      request
    ).then(
      (cached) =>
        cached ||
        fetch(
          request
        )
    )
  );
});
