/* global caches, self */

const SHELL_CACHE = 'nextclaw-ui-shell-v2';
const SHELL_ASSETS = ['/offline.html', '/manifest.webmanifest', '/logo.svg', '/pwa-192.png', '/pwa-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key.startsWith('nextclaw-ui-') && key !== SHELL_CACHE).map((key) => caches.delete(key)));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(readShellAsset(request));
  }
});

async function readShellAsset(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  const shellCache = await caches.open(SHELL_CACHE);
  shellCache.put(request, response.clone());
  return response;
}
