// Service worker: lần đầu tải bình thường; từ lần thứ 2 mở gần như tức thì và chịu được mạng chập chờn.
// - /assets/* (tên có hash, không bao giờ đổi): cache-first
// - trang HTML: trả cache ngay + cập nhật ngầm (lần mở sau có bản mới)
// - ảnh + font: stale-while-revalidate (trả cache ngay, cập nhật ngầm); giới hạn số ảnh cache
const V = 'pp-v2';
// ignoreVary: nhiều host gửi `Vary: Origin`; request module script có header Origin nên sẽ KHÔNG khớp bản cache nếu không bỏ qua Vary
const M = { ignoreVary: true };
const STATIC = `${V}-static`;
const PHOTOS = `${V}-photos`;
const MAX_PHOTOS = 240;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k);
      await self.clients.claim();
    })(),
  ),
);

// Lần đầu: trang tải xong trước khi SW kịp kiểm soát → trang gửi danh sách file vừa dùng để cất ngay
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'precache') return;
  e.waitUntil(
    (async () => {
      const st = await caches.open(STATIC);
      const ph = await caches.open(PHOTOS);
      for (const u of e.data.urls) {
        try {
          const url = new URL(u);
          const photo = url.pathname.includes('/photos/');
          const cache = photo ? ph : st;
          const key = url.origin === self.location.origin && !url.pathname.match(/\.[a-z0-9]+$/i) ? url.origin + url.pathname : u;
          if (await cache.match(key, M)) continue;
          const res = await fetch(u, { mode: url.origin === self.location.origin ? 'same-origin' : 'no-cors' });
          if (res.ok || res.type === 'opaque') await cache.put(key, res);
        } catch {
          /* bỏ qua */
        }
      }
    })(),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;

  if (req.mode === 'navigate') {
    // HTML: trả bản cache NGAY (mở tức thì dù mạng yếu), đồng thời tải bản mới cho lần sau.
    // Asset có hash nên bản HTML cũ vẫn chạy đúng với asset cũ đã cache.
    e.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const key = new Request(url.origin + url.pathname);
        const hit = await cache.match(key, M);
        const net = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(key, res.clone());
            return res;
          })
          .catch(() => hit);
        if (hit) e.waitUntil(net.catch(() => {}));
        return hit || net;
      }),
    );
    return;
  }

  if (same && url.pathname.includes('/assets/')) {
    e.respondWith(
      caches.match(req, M).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  const photo = same && url.pathname.includes('/photos/');
  const name = photo ? PHOTOS : STATIC;
  e.respondWith(
    caches.open(name).then(async (cache) => {
      const hit = await cache.match(req, M);
      const net = fetch(req)
        .then((res) => {
          if (res.ok || res.type === 'opaque') {
            cache.put(req, res.clone()).then(() => photo && trim(cache));
          }
          return res;
        })
        .catch(() => hit);
      if (hit) e.waitUntil(net.catch(() => {}));
      return hit || net;
    }),
  );
});
