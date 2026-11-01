// Offline support: cache the app shell, serve it when the network is unavailable.
const CACHE = "journal-prompts-v1.3.0";
const SHELL = ["./", "index.html", "theme.css", "styles.css", "main.js", "manifest.webmanifest", "icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // webhook posts always go to the network
  const url = new URL(request.url);
  if (url.origin !== location.origin) {
    // Fonts: cache after first use.
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => Response.error()))
    );
    return;
  }
  // Same origin: network first, fall back to cache (pages ignore the query string).
  event.respondWith(
    fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
      return res;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match("index.html")))
  );
});
