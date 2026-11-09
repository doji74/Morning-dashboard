/* Service Worker: macht die Seite installierbar und offline lesbar.
 * Strategie: eigene Dateien "erst Netz, dann Cache" – so gibt es morgens immer
 * die frischen Daten, und ohne Netz die zuletzt geladene Version.
 * Fremde Anfragen (Bahn-/Wetter-API) werden nicht angefasst. */
const CACHE = "morgen-dashboard-{{VERSION}}";
const SHELL = ["./", "index.html", "data.json", "app.js", "style.css", "manifest.json",
  "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || caches.match("index.html")))
  );
});
