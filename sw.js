/* Arroyo Store POS — service worker */
const CACHE = 'mystore-tfxj3w1ldl9z-v1790244458547';
const CORE = ['./','./index.html','./manifest.json','./version.json',
              './icon-192.png','./icon-512.png','./apple-touch-icon.png','./offline.html'];

self.addEventListener('install', e => {
  /* addAll rejects the whole install if ONE file 404s, which would leave
     the till on the previous worker with no clue why. Add individually. */
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(CORE.map(u => c.add(u).catch(err => console.warn('[sw] skip', u, err))))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;

  /* Not ours: anything that is not a same-origin GET. Returning without
     calling respondWith() hands the request straight to the network.
     This is the line that stops a failed Supabase POST from being
     answered with a cached HTML page and counted as delivered. */
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* Page loads go to the network first, so a redeploy is picked up on
     the next open rather than being masked by a stale cache. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return r;
      }).catch(() =>
        caches.match(req)
          .then(r => r || caches.match('./index.html'))
          .then(r => r || caches.match('./offline.html'))
      )
    );
    return;
  }

  /* Static assets: cache first, and only cache a clean same-origin 200. */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(resp => {
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return resp;
    }))
  );
});
