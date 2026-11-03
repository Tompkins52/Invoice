/* Billhead service worker.
   The whole app shell (page, styles, code, fonts, the PDF library, icons) is cached together under one
   VERSION when this worker installs, and every page load is served from that one cache, so a phone never
   mixes a page from one release with code from another, and invoices can be made with no connection.
   The deploy writes a hash of the shell into VERSION (tools/stamp_sw.py), so any change is a new worker:
   it caches the new shell in full, takes over, and the app offers a reload. If a shell file is missing,
   the install fails and the phone keeps the version it has. */
var VERSION = 'bh-dev';
var SHELL = ['./', './index.html', './app.css', './js/model.js', './js/pdf.js', './js/app.js', './manifest.webmanifest',
  './vendor/jspdf.umd.min.js', './vendor/signature_pad.umd.min.js',
  './fonts/plex-sans-400.woff2', './fonts/plex-sans-500.woff2', './fonts/plex-sans-600.woff2', './fonts/plex-sans-700.woff2',
  './fonts/plex-mono-400.woff2', './fonts/plex-mono-500.woff2', './fonts/plex-mono-600.woff2',
  './fonts/plex-sans-400.ttf', './fonts/plex-sans-600.ttf', './fonts/plex-mono-500.ttf',
  './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  var key = req.mode === 'navigate' ? new URL('./', location.href).toString() : withoutQuery(req.url);
  e.respondWith(caches.match(key, { cacheName: VERSION }).then(function (hit) {
    return hit || caches.match(key).then(function (any) { return any || fetch(req); });
  }));
});
function withoutQuery(href) { var u = new URL(href); u.search = ''; u.hash = ''; return u.toString(); }
