// Offline support for the hosted build (the portable build is opened from
// file:// and never runs a service worker).
//
// Two strategies, split by what can go stale:
//
// - Navigations — /, /app, /privacy, /cookies, /terms, all of which are the
//   same index.html — are network-first, falling back to the cache offline.
//   A cache-first index.html pinned returning users to the release they first
//   saw (P21b) and would have hidden every privacy-policy update from anyone
//   who had visited once (P19). The legal pages are part of the bundle, so
//   the fresh index.html is what brings their new text.
// - Everything else same-origin (hashed /assets/*, the favicon, the manifest)
//   is cache-first and filled as it is fetched. Hashed assets are immutable
//   by name, and a parser chunk is only cached once a user imports that
//   format — the same trade the lazy split makes over the network.
//
// Still no network beyond same-origin (hard rules 2–3).
const CACHE_NAME = 'anonymaizer-v3';
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg'];

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

const putInCache = (request, response) => {
  if (response.ok) {
    const copy = response.clone();
    void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // Every route is index.html, so one cache entry ('/') serves them all offline.
    event.respondWith(
      fetch(request)
        .then((response) => putInCache('/', response))
        .catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request).then((r) => putInCache(request, r))));
});
