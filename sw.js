/* Simple offline-first service worker (no external dependencies) */
const CACHE_NAME = "product-finder-offline-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./js/app.js",
  "./js/db.js",
  "./js/csv.js"
];

self.addEventListener("install", (e)=>{
  e.waitUntil((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e)=>{
  e.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve()));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e)=>{
  const url = new URL(e.request.url);
  // Only handle same-origin requests
  if (url.origin === self.location.origin) {
    e.respondWith((async ()=>{
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try{
        const res = await fetch(e.request);
        // Cache GET responses
        if (e.request.method === "GET" && res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, res.clone());
        }
        return res;
      }catch(err){
        // Offline fallback to cache (if not already matched)
        return cached || new Response("Offline", {status: 503, statusText: "Offline"});
      }
    })());
  }
});
