const CACHE_NAME = 'apexflow-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Do not intercept or cache dynamic API requests
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // Cache the successful GET network response for offline use
        if (e.request.method === 'GET' && networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(e.request).then((cachedResponse) => {
          return cachedResponse || new Response('Offline Content Unavailable', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

