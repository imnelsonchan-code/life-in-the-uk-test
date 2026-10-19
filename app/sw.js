/* Life in the UK Test — offline cache.
 *
 * Strategy: network-first. Every same-origin GET goes to the network and a copy
 * is cached on the way back; when the network is unavailable the cached copy is
 * served instead (and index.html for a navigation, so the app still opens from
 * the home screen). Nothing is precached, so a cold offline start needs one
 * earlier online visit — but a file can never be served stale, which matters
 * because the deploy stamps a new `?v=` on every release.
 *
 * The `?v=<commit>` on this script's own URL names the cache, so a new deploy
 * gets a fresh cache and activate() drops the previous one.
 */

const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'liuk-' + VERSION;
const PREFIX = 'liuk-';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.indexOf(PREFIX) === 0 && k !== CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // The GitHub star count is a best-effort lookup: never cache it, never
  // queue it for offline, just let the page fail softly as it already does.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => {
          if (hit) return hit;
          if (req.mode === 'navigate') {
            return caches.match('index.html').then((page) => page || Response.error());
          }
          return Response.error();
        })
      )
  );
});
