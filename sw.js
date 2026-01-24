const CACHE_NAME = 'skit-attendance-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event: Caches the files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Fetch Event: Serve from Cache if offline
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});