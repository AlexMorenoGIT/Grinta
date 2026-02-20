const CACHE = 'grinta-v2';

self.addEventListener('install', (e) => {
  // Don't pre-cache pages (they may redirect due to auth).
  // Only cache static assets that will always return 200.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll([
        '/manifest.webmanifest',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png',
      ])
    )
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
  const url = new URL(e.request.url);

  // Skip non-GET and Supabase API calls (auth/data must be fresh)
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
        // Cache successful responses for Next.js static assets
        if (res.ok && url.pathname.startsWith('/_next/')) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
