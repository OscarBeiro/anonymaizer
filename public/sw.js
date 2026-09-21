// Cache-first app shell so the PWA works offline once installed.
//
// The hosted build (`npm run build`) is an ordinary code-split Vite build
// since M3/P8b — the JS and CSS live in /assets/ and each document parser is
// its own lazily-imported chunk, so precaching a fixed list is no longer
// enough. The shell below is what exists at a known URL; everything else,
// including a parser chunk the first time a user imports that format, is
// added to the cache as it is fetched. A format never used is never cached,
// which is the same trade the lazy split makes over the network.
//
// (The portable build has no separate assets to cache and does not run from
// a service worker at all — it is opened straight from file://.)
const CACHE_NAME = 'anonymaizer-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
