// The service worker: what makes SideKeys installable and usable with the network off.
//
// It is not built by Vite — it has to sit at the app root, outside the bundle, so that its scope
// covers the whole app. `scripts/build-sw.mjs` copies it into dist/ and fills in the two
// placeholders below with the real file list and a cache name derived from it. Editing the file
// list by hand is therefore impossible, which is the point: Vite hashes its filenames.
//
// Why an app may be cached at all: everything SideKeys does — the analyzer, the path, the daily
// challenge — is arithmetic in this browser. There is no server to be offline from.

const CACHE = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

const shellUrl = new URL('./index.html', self.location.href).href;

// Every lookup ignores Vary, and that is not a shortcut — it is the whole reason offline works.
// A static host answers these files with `Vary: Origin` (vite preview does, and GitHub Pages is
// free to). The worker precaches them with its own fetches, which carry no Origin header, while
// the page asks for the bundle with `crossorigin`, which does carry one. Vary would call that a
// different request, miss the cache, and fall through to a network that is not there — which is
// exactly what happened the first time this was tested with the server stopped. The files are
// content-hashed, so they do not vary by anything.
const MATCH = { ignoreVary: true };

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE);
    // Take over straight away rather than waiting for every tab to close. The page keeps the code
    // it already loaded until it is reloaded, so nothing changes under a run in progress.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Anything on another origin is somebody else's business, and caching it would be presumptuous.
  if (new URL(request.url).origin !== self.location.origin) return;
  // Nor the worker script itself: build-sw.mjs keeps it out of the precache list for the same
  // reason, and a cached copy would be a stale answer to anyone who asks for it.
  if (request.url === self.location.href) return;

  event.respondWith(request.mode === 'navigate' ? openPage(request) : fromCache(request));
});

/**
 * A page: network first, so a new version is picked up the moment it is published, and the cached
 * shell when there is no network. The shell is the answer to every route — the app has no server
 * routes to get wrong.
 */
async function openPage(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE);
    cache.put(shellUrl, response.clone());
    return response;
  } catch {
    const cached = await caches.match(shellUrl, MATCH);
    if (cached) return cached;
    throw new Error('offline, and no page cached yet');
  }
}

/**
 * Everything else: cache first. Vite puts a content hash in each filename, so a cached asset can
 * never be the wrong version of itself — a different build asks for a different name.
 */
async function fromCache(request) {
  const cached = await caches.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  // Only keep what came back whole: a 206 or an opaque error would poison the cache.
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}
