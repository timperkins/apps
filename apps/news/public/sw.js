// Tim News service worker.
// Caches the app shell and pages the reader has opened so they can be read offline.
// Third-party images and video are never cached: media is always loaded from its original host.

const VERSION = "tim-news-v1";
const SHELL = ["/", "/interests", "/manifest.webmanifest", "/icons/icon-192.png"];
const MAX_ENTRIES = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Keeps the cache bounded, oldest entries first. The app shell always stays. */
async function trim(cache) {
  const keys = await cache.keys();
  const extra = keys.filter((r) => !SHELL.includes(new URL(r.url).pathname));
  for (const request of extra.slice(0, Math.max(0, extra.length - MAX_ENTRIES))) await cache.delete(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Only our own GET requests. Never API calls, Firebase, or third-party media.
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Build assets are content-hashed: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) caches.open(VERSION).then((c) => c.put(request, res.clone()));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages and data: network first, falling back to the last copy we saw.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(request, copy).then(() => trim(c)));
        }
        return res;
      })
      .catch(async () => (await caches.match(request)) || (await caches.match("/")) || Response.error()),
  );
});
