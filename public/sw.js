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
// P21b: replaced at build time with the app version plus a hash of the
// bundle's file names (vite.config.ts, swVersion plugin), so every release
// gets its own cache and `activate` drops the previous one.
const CACHE_NAME = 'anonymaizer-__SW_VERSION__';
// The last entry is replaced with the entry and route chunks at build time (P21b).
const APP_SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '__PRECACHE__'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  // No skipWaiting() here (P21b): a new worker waits until the page's
  // "New version available — reload" prompt asks it to take over, instead of
  // swapping the app out from under an open session.
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
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
