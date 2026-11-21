/* Campetto service worker: apertura veloce anche con poca rete, offline di base e notifiche push. */
const VERSION = "campetto-v3";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
/** Con la rete lenta (al campetto, una tacca) non si aspetta più di così: si apre l'ultima versione salvata. */
const NAV_TIMEOUT = 1500;
/** File salvati al massimo: quelli vecchi delle versioni precedenti se ne vanno da soli. */
const MAX_STATIC = 220;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
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

async function trim(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith("/_next/static/"));
  // Le chiavi sono in ordine di inserimento: si tolgono le più vecchie.
  for (const r of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(r);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // File statici con hash (non cambiano mai): dalla cache, altrimenti dalla rete e si salvano.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(
                caches.open(VERSION).then(async (c) => {
                  await c.put(req, copy);
                  if (Math.random() < 0.1) await trim(c);
                }),
              );
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pagine: la versione nuova dalla rete, ma se tarda si apre subito l'ultima salvata
  // (e quella nuova si salva lo stesso per la prossima volta). Offline: l'ultima salvata.
  if (req.mode === "navigate") {
    const net = fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        return caches
          .open(VERSION)
          .then((c) => c.put(req, copy))
          .then(() => res);
      }
      return res;
    });
    event.waitUntil(net.catch(() => {}));
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (!cached) return net.catch(async () => (await caches.match("/")) || Response.error());
        const late = new Promise((r) => setTimeout(() => r(null), NAV_TIMEOUT));
        const fresh = await Promise.race([net.catch(() => null), late]);
        return fresh || cached;
      })(),
    );
  }
});

/** Le notifiche mandate da OneSignal le mostra OneSignal: le riconosce da custom.i. */
const fromOneSignal = (data) => Boolean(data && data.custom && typeof data.custom.i === "string");

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Campetto", body: event.data ? event.data.text() : "" };
  }
  if (fromOneSignal(data)) return;
  // Le nostre: OneSignal (se c'è) non le tocca.
  event.stopImmediatePropagation();
  const title = data.title || "Campetto";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || "/", ...(data.data || {}) },
      actions: (data.actions || []).slice(0, 2),
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const d = event.notification.data || {};
  // Quelle di OneSignal (hanno il loro numero): il tocco lo gestisce OneSignal.
  if (d.notificationId) return;
  event.stopImmediatePropagation();
  event.notification.close();
  let url = d.url || "/";
  // Risposta diretta dai pulsanti della notifica: l'app la registra appena si apre.
  if (event.action && d.proposalId) url = `/organizza?p=${d.proposalId}&r=${event.action}`;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Notifiche con OneSignal: OneSignal registra questa stessa sw.js con il suo App ID
// nell'indirizzo. Solo in quel caso si carica la sua parte (dopo le nostre, che passano prima).
// Se la rete non la dà, l'app funziona lo stesso: si riprova al prossimo aggiornamento.
if (new URL(self.location.href).searchParams.has("appId")) {
  try {
    importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
  } catch {
    /* senza OneSignal per ora: le nostre notifiche funzionano comunque */
  }
}
