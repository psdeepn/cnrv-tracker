const CACHE = "cnrv-v2";
const ASSETS = ["./", "./index.html", "./dist/bundle.js", "./dist/styles.css", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first: always fetch the freshest app code when online, and fall back
// to the cache only when offline. This prevents users being stuck on a stale
// bundle after a new deploy.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(e.request))
  );
});
