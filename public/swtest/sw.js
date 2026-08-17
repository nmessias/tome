// Tome SW test worker: caches /sw-test/ so an offline reload proves the feature.
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open('sw-test-v1')
      .then(function (cache) { return cache.addAll(['/sw-test/']); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      return hit || fetch(event.request).then(function (res) {
        var copy = res.clone();
        caches.open('sw-test-v1').then(function (cache) { cache.put(event.request, copy); });
        return res;
      });
    })
  );
});