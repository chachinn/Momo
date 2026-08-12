// ========================================
// MOMO SERVICE WORKER
// Momo 1.4.0 — About Momo + update banner + push reminders + stable network-first PWA shell
// ========================================

const CACHE_NAME =
  "momo-runtime-shell-v1.4.0";


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


self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});


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


self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { body: event.data?.text?.() || "Momo has a reminder for you." }; }

  const title = data.title || "Momo reminder";
  const options = {
    body: data.body || "You have something coming up.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.tag || `momo-${Date.now()}`,
    renotify: false,
    data: { url: data.url || "./index.html" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const scopeUrl =
    self.registration.scope ||
    new URL("./", self.location.href).href;

  let targetUrl;

  try {
    const candidate = new URL(
      event.notification.data?.url ||
        "index.html",
      scopeUrl
    );

    targetUrl =
      candidate.origin ===
      self.location.origin
        ? candidate.href
        : new URL(
            "index.html",
            scopeUrl
          ).href;
  } catch {
    targetUrl = new URL(
      "index.html",
      scopeUrl
    ).href;
  }

  event.waitUntil(
    (async () => {
      const windows =
        await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });

      for (const client of windows) {
        if (
          client.url.startsWith(
            scopeUrl
          ) &&
          "focus" in client
        ) {
          try {
            if (
              client.url !==
              targetUrl &&
              "navigate" in client
            ) {
              await client.navigate(
                targetUrl
              );
            }
          } catch {}

          return client.focus();
        }
      }

      return self.clients.openWindow
        ? self.clients.openWindow(
            targetUrl
          )
        : undefined;
    })()
  );
});

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