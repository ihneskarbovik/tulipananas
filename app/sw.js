// Gjør webappen installerbar og lar den virke uten nett med det den har sett før.
const CACHE = "tulipananas-v1";
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "TulipText-Italic.ttf", "icon-192.png"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
));
// Nett først (nye quizer hver dag), lagret kopi hvis nettet er borte.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
