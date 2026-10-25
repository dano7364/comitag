// Comitag: guarda una copia de la página para que abra aunque no haya internet.
// Los datos (comidas, horarios) NO pasan por aquí: los maneja la página.
const CACHE = "comitag-v3";   // al cambiar el nombre, los teléfonos botan la copia antigua
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c =>
    // "reload": trae la versión nueva de verdad, sin usar copias intermedias
    Promise.all(["/index.html", LIB].map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))
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
    // La copia se saca AL TIRO: si se espera, la página ya leyó la respuesta y la copia falla
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)).catch(() => {}); }
    return res;
  });
  const slow = new Promise(r => setTimeout(r, 4000)).then(() => caches.match(key));
  return Promise.race([net.catch(() => caches.match(key)), slow.then(c => c || net)])
    .then(r => r || net);
}

// Aviso "X no ha comido" que manda Supabase cuando un horario queda pendiente
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Comitag", {
    body: d.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    tag: d.tag || "comitag",
    data: { url: d.url || "/" },
  }));
});

// Al tocar el aviso, abre (o enfoca) la página de esa mascota
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url === url && "focus" in c) return c.focus();
    return clients.openWindow(url);
  }));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    const path = new URL(req.url).pathname;
    // Solo la página de las mascotas se guarda para usarla sin internet (no el panel del dueño)
    if (path === "/" || path === "/index.html" || path.startsWith("/p/")) return e.respondWith(networkFirst(req, "/index.html"));
    return;
  }
  if (req.url.startsWith(LIB)) return e.respondWith(networkFirst(req, LIB));
});
