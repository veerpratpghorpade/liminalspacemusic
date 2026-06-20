const CACHE_NAME = 'darkbeat-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.endsWith('.mp3') || url.pathname.endsWith('.ogg')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME + '-audio').then(cache => cache.put(e.request, clone));
          return response;
        }).catch(() => cached);
      })
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached =>
        cached || fetch(e.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        }).catch(() => cached)
      )
    );
  }
});
