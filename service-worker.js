// ========================================
// MOMO SERVICE WORKER
// Momo 1.3.2 — stable network-first PWA shell
// ========================================

const CACHE_NAME =
  "momo-runtime-shell-v1.3.2";


const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-momo.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


self.addEventListener(
  "install",
  (event) => {

    self.skipWaiting();


    event.waitUntil(
      caches
        .open(
          CACHE_NAME
        )
        .then(
          async (
            cache
          ) => {

            await Promise.allSettled(
              APP_SHELL.map(
                (
                  url
                ) =>
                  cache.add(
                    new Request(
                      url,
                      {
                        cache:
                          "reload"
                      }
                    )
                  )
              )
            );

          }
        )
    );

  }
);


self.addEventListener(
  "activate",
  (event) => {

    event.waitUntil(
      caches
        .keys()
        .then(
          (
            keys
          ) =>
            Promise.all(
              keys
                .filter(
                  (
                    key
                  ) =>
                    key !==
                      CACHE_NAME &&
                    key.startsWith(
                      "momo-"
                    )
                )
                .map(
                  (
                    key
                  ) =>
                    caches.delete(
                      key
                    )
                )
            )
        )
        .then(
          () =>
            self.clients.claim()
        )
    );

  }
);


function isSameOrigin(
  request
) {

  return (
    new URL(
      request.url
    ).origin ===
    self.location.origin
  );

}


function isAppShellRequest(
  request
) {

  const url =
    new URL(
      request.url
    );


  return (
    request.mode ===
      "navigate" ||
    url.pathname.endsWith(
      "/index.html"
    ) ||
    url.pathname.endsWith(
      "/styles.css"
    ) ||
    url.pathname.endsWith(
      "/app.js"
    ) ||
    url.pathname.endsWith(
      "/firebase-momo.js"
    ) ||
    url.pathname.endsWith(
      "/manifest.json"
    )
  );

}


async function cacheSuccessfulResponse(
  request,
  response
) {

  if (
    !response ||
    !response.ok
  ) {

    return response;

  }


  const cache =
    await caches.open(
      CACHE_NAME
    );


  await cache.put(
    request,
    response.clone()
  );


  return response;

}


self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;


    if (
      request.method !==
        "GET" ||
      !isSameOrigin(
        request
      )
    ) {

      return;

    }


    if (
      isAppShellRequest(
        request
      )
    ) {

      event.respondWith(
        fetch(
          new Request(
            request,
            {
              cache:
                "no-store"
            }
          )
        )
          .then(
            (
              response
            ) =>
              cacheSuccessfulResponse(
                request,
                response
              )
          )
          .catch(
            async () => {

              const cached =
                await caches.match(
                  request
                );


              if (
                cached
              ) {

                return cached;

              }


              if (
                request.mode ===
                  "navigate"
              ) {

                return (
                  await caches.match(
                    "./index.html"
                  )
                );
              }


              throw new Error(
                "Momo is offline and this file is not cached yet."
              );

            }
          )
      );


      return;

    }


    event.respondWith(
      caches
        .match(
          request
        )
        .then(
          async (
            cached
          ) => {

            if (
              cached
            ) {

              return cached;

            }


            const response =
              await fetch(
                request
              );


            return cacheSuccessfulResponse(
              request,
              response
            );

          }
        )
    );

  }
);
