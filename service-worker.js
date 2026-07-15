const CACHE_NAME = "hot-issue-v1";
const SHELL = ["./manifest.json", "./icon-192.png", "./icon-512.png", "./style.css", "./app.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return; // never intercept cross-origin API calls (Upbit/CoinGecko/RSS/blockstream)
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
