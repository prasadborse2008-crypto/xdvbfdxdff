// RuralCare Service Worker
const CACHE_NAME = 'ruralcare-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // For API calls: Network first, fallback to cached response if offline with stale flag
  if (url.pathname.startsWith('/api/')) {
    // If it's a mutation (POST, PATCH, DELETE), do not cache
    if (event.request.method !== 'GET') {
      return;
    }

    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            // Add a header indicating this is cached offline data
            const headers = new Headers(cachedResponse.headers);
            headers.set('X-RuralCare-Cached', 'true');
            return new Response(await cachedResponse.blob(), {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: headers,
            });
          }
          return new Response(
            JSON.stringify({
              success: false,
              error: {
                code: 'OFFLINE_NO_CACHE',
                message: 'You are currently offline. Please dial emergency helpline 108 or 112 directly.',
              },
            }),
            {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            }
          );
        })
    );
    return;
  }

  // Static assets: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).catch(() => {
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        })
      );
    })
  );
});
