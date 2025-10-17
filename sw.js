/* FruitSeeker service worker */
const CACHE_NAME = "fruitseeker-v1";
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
  if (url.origin === self.location.origin) {
    e.respondWith((async ()=>{
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try{
        const res = await fetch(e.request);
        if (e.request.method === "GET" && res && res.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(e.request, res.clone());
        }
        return res;
      }catch(err){
        return cached || new Response("Offline", {status: 503, statusText: "Offline"});
      }
    })());
  }
});
