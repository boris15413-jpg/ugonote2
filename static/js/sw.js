const CACHE = "ugoku-v4",
  URLS = ["/", "static/css/app.css"];
(self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(URLS))
      .then(() => self.skipWaiting()),
  ),
),
  self.addEventListener("activate", (e) =>
    e.waitUntil(
      caches
        .keys()
        .then((ks) =>
          Promise.all(
            ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
          ),
        )
        .then(() => self.clients.claim()),
    ),
  ),
  self.addEventListener("fetch", (e) => {
    "GET" === e.request.method &&
      e.respondWith(
        caches.match(e.request).then(
          (r) =>
            r ||
            fetch(e.request)
              .then((nr) => {
                if (nr.ok) {
                  const c = nr.clone();
                  caches.open(CACHE).then((cache) => cache.put(e.request, c));
                }
                return nr;
              })
              .catch(() => new Response("Offline", { status: 503 })),
        ),
      );
  }));
