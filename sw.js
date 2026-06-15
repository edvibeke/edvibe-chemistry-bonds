/* =========================================================
   QUANTUM BOND — SERVICE WORKER (Phase 7)
   Strategy: Cache First, Network Fallback.
   On install: pre-cache every app file + CDN assets.
   On fetch:   serve from cache instantly; update in background.
   On activate: delete old caches so stale files never persist.
   ========================================================= */

const CACHE_NAME    = 'quantum-bond-v1';
const OFFLINE_PAGE  = '/quantum-bond/offline.html';

/* ---- Every file in the project ---- */
const APP_SHELL = [
  /* Offline fallback */
  '/quantum-bond/offline.html',

  /* Core shared files */
  '/quantum-bond/core/theme.css',
  '/quantum-bond/core/scene.js',
  '/quantum-bond/core/elements.js',
  '/quantum-bond/core/atom.js',
  '/quantum-bond/core/ui.js',
  '/quantum-bond/core/bond.js',
  '/quantum-bond/core/lattice.js',
  '/quantum-bond/core/sandbox.js',

  /* Phase pages */
  '/quantum-bond/phase1/index.html',
  '/quantum-bond/phase2/index.html',
  '/quantum-bond/phase3/index.html',
  '/quantum-bond/phase4/index.html',
  '/quantum-bond/phase5/index.html',
  '/quantum-bond/phase6/index.html',
  '/quantum-bond/phase7/index.html',
  '/quantum-bond/phase8/index.html',
];

/* ---- CDN assets (Three.js + controls + fonts) ---- */
const CDN_ASSETS = [
  /* Three.js r160 */
  'https://unpkg.com/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js',

  /* Lucide icons */
  'https://unpkg.com/lucide@latest/dist/umd/lucide.js',

  /* Google Fonts — preconnect isn't enough offline, cache the actual CSS + woff2 */
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap',
];

/* =========================================================
   INSTALL — pre-cache everything
   ========================================================= */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      /* Cache app shell (must all succeed) */
      await cache.addAll(APP_SHELL);

      /* Cache CDN assets individually — if one fails don't block install */
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => { /* CDN down at install time — skip gracefully */ })
        )
      );
    })
  );
  /* Take control immediately without waiting for old SW to unload */
  self.skipWaiting();
});

/* =========================================================
   ACTIVATE — clean up old caches
   ========================================================= */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/* =========================================================
   FETCH — cache first, network fallback
   ========================================================= */
self.addEventListener('fetch', event => {
  /* Only handle GET requests */
  if (event.request.method !== 'GET') return;

  /* Skip non-http requests (chrome-extension://, etc.) */
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        /* Serve from cache immediately */
        /* Revalidate in background (stale-while-revalidate) */
        const revalidate = fetch(event.request)
          .then(fresh => {
            if (fresh && fresh.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, fresh.clone()));
            }
            return fresh;
          })
          .catch(() => {});
        return cached;
      }

      /* Not in cache — try network */
      return fetch(event.request)
        .then(response => {
          if (!response || !response.ok) return response;
          /* Cache successful responses for future offline use */
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          return response;
        })
        .catch(() => {
          /* Network failed and not cached — show offline page for navigation requests */
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
          }
          /* For other assets (JS, CSS) return empty 503 */
          return new Response('', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});
