const CACHE = 'grinta-v1';

// Shell assets to pre-cache on install
const PRECACHE = [
  '/',
  '/home',
  '/login',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

// Network-first: always try the network, fall back to cache
self.addEventListener('fetch', (e) => {
  // Skip non-GET and Supabase API calls (auth/data must be fresh)
  const url = new URL(e.request.url);
  if (
    e.request.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache successful responses for Next.js pages/assets
        if (res.ok && (url.pathname.startsWith('/_next/') || PRECACHE.includes(url.pathname))) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
