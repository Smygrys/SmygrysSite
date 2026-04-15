const CACHE = "trash-v1";
const urls = ["./", "./index.html", "./style.css", "./script.js", "./config.js", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(urls).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.status === 200) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
    return r;
  }).catch(() => caches.match(e.request).then(r => r || new Response("Offline"))));
});