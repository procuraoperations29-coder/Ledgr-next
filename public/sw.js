/*
 * Ledgr service worker.
 *
 * Deliberately conservative for an authenticated accounting app:
 *  - Navigations are network-first, so pages always show fresh data when online
 *    and fall back to a friendly offline page when the network is gone.
 *  - Only content-hashed, immutable build assets (/_next/static, /icons, fonts)
 *    are cached, and served cache-first.
 *  - API, auth and any non-GET request are never touched by the worker, so
 *    financial data and sessions are never served stale from a cache.
 */
const VERSION = 'v1';
const STATIC_CACHE = `ledgr-static-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Immutable, safe-to-cache asset paths (same-origin only).
function isCacheableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|svg|gif|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let cross-origin pass through

  // Never intercept API / auth / server actions — always straight to network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  // App navigations: network-first with an offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      })
    );
    return;
  }

  // Static assets: cache-first, then fill the cache in the background.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        } catch {
          return hit || Response.error();
        }
      })
    );
  }
});
