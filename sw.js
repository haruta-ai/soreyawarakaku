/* オフライン用キャッシュ。ファイル更新時は CACHE_NAME の番号を上げます。 */
const CACHE_NAME = "yawarakaku-v1.0.10";
const APP_FILES = ["./", "./index.html", "./styles.css?v=1.0.10", "./data.js?v=1.0.10", "./app.js?v=1.0.10", "./manifest.webmanifest?v=1.0.10", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.status === 200 && response.type === "basic") {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match("./index.html"))));
});
