// Offline support. Serves from cache first and refreshes in the background, so a new deploy shows up on the next open.
const CACHE = 'ram-vn-v1';
const ASSETS = ['./', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/base.css', 'css/home.css', 'css/journey.css', 'css/chat.css',
  'js/app.js', 'js/core.js', 'js/icons.js', 'js/data.js', 'js/journey.js', 'js/chat.js', 'js/flows.js', 'js/screens.js',
  'icons/icon.svg', 'icons/icon-maskable.svg', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  // Cache each file on its own, so one missing file never blocks the rest.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
