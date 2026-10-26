/**
 * CARPA Reference service worker.
 *
 * The build fills in BUILD below with the list of every file in this release and its
 * SHA-256. A release is installed only if EVERY file downloads and matches its hash; if
 * anything fails, the install fails, the partial cache is deleted, and the previous
 * release keeps running. A new release never takes over by itself: the app activates it
 * only when the user taps "Apply update" with no patient session open.
 */
const BUILD = __CARPA_BUILD__;
const CACHE = `carpa-${BUILD.buildId}`;

function hex(buffer) {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(buffer) {
  return hex(await crypto.subtle.digest('SHA-256', buffer));
}

function absolute(url) {
  return new URL(url, self.registration.scope).href;
}

async function installRelease() {
  const cache = await caches.open(CACHE);
  for (const file of BUILD.files) {
    const url = absolute(file.url);
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Download failed: ${file.url} (${response.status})`);
    const body = await response.arrayBuffer();
    if ((await sha256(body)) !== file.sha256) throw new Error(`Integrity check failed: ${file.url}`);
    await cache.put(
      url,
      new Response(body, {
        headers: { 'Content-Type': response.headers.get('Content-Type') ?? 'application/octet-stream' },
      }),
    );
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    installRelease().catch(async (error) => {
      await caches.delete(CACHE);
      throw error;
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('carpa-') && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  // The page re-checks the cached files itself (reading cache bodies from the page is more
  // reliable across browsers); the worker supplies the expected list and hashes.
  if (type === 'BUILD_INFO' && event.ports[0]) {
    event.ports[0].postMessage({
      cacheName: CACHE,
      buildId: BUILD.buildId,
      releaseId: BUILD.releaseId,
      files: BUILD.files,
    });
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === 'navigate') {
        const scope = new URL(self.registration.scope);
        const isShell = url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`;
        // Other pages (e.g. signin.html) go to the network so a hosting login can be shown.
        if (!isShell)
          return fetch(request).catch(async () => (await cache.match(absolute('index.html'))) ?? Response.error());
        const shell = await cache.match(absolute('index.html'));
        if (shell) return shell;
      }
      const hit = await cache.match(request, { ignoreSearch: true });
      return hit ?? fetch(request);
    })(),
  );
});
