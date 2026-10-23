// Comitag: guarda una copia de la página para que abra aunque no haya internet.
// Los datos (comidas, horarios) NO pasan por aquí: los maneja la página.
const CACHE = "comitag-v1";
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(["/index.html", LIB].map(u => c.add(u).catch(() => {})))
  ));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pide a internet, pero si tarda más de 4 s o no hay conexión, usa la copia guardada.
function networkFirst(req, key) {
  const net = fetch(req).then(res => {
    if (res.ok) caches.open(CACHE).then(c => c.put(key, res.clone()));
    return res;
  });
  const slow = new Promise(r => setTimeout(r, 4000)).then(() => caches.match(key));
  return Promise.race([net.catch(() => caches.match(key)), slow.then(c => c || net)])
    .then(r => r || net);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") return e.respondWith(networkFirst(req, "/index.html"));
  if (req.url.startsWith(LIB)) return e.respondWith(networkFirst(req, LIB));
});
