/* Offline support for the installed web app: keep every game file cached, refresh in the background. */
'use strict';

const CACHE = 'jc-car-crasher-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/game.css',
  'fonts/bungee.woff2', 'fonts/overpass.woff2', 'fonts/overpass-mono.woff2',
  'js/util.js', 'js/flags.js', 'js/vehicles.js', 'js/locations.js', 'js/props.js',
  'js/terrain.js', 'js/landmarks.js', 'js/audio.js', 'js/game.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Serve from cache straight away; fetch a fresh copy for next launch when online.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const fresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
});
