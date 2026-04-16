/* global caches, self */

const SHELL_CACHE = 'nextclaw-ui-shell-v1';
const RUNTIME_CACHE = 'nextclaw-ui-runtime-v1';
const SHELL_ASSETS = ['/', '/offline.html', '/manifest.webmanifest', '/logo.svg', '/pwa-192.png', '/pwa-512.png'];

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
      await Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAIT') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) {
    return;
  }

  if (['script', 'style', 'image', 'font'].includes(request.destination) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(handleStaticAsset(request));
  }
});

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    runtimeCache.put(request, response.clone());
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return caches.match('/offline.html');
  }
}

async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  runtimeCache.put(request, response.clone());
  return response;
}
