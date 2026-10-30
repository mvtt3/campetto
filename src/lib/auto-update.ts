/**
 * Aggiornamento automatico: chi ha l'app aperta da giorni, o installata sul telefono, non deve
 * restare con la versione vecchia. All'apertura e ogni volta che l'app torna in primo piano
 * chiediamo al server quale versione è pubblicata; se è diversa togliamo le pagine salvate
 * (così non può ripartire la copia vecchia) e ricarichiamo. Mai durante un lavoro a metà.
 */
const MINE = process.env.NEXT_PUBLIC_BUILD ?? "dev";
const BUSY = ["/nuova", "/video", "/importa"];
const TRIED = "campetto:aggiornamento-provato";
let last = 0;

async function dropSavedPages() {
  if (!("caches" in window)) return;
  for (const name of await caches.keys()) {
    const c = await caches.open(name);
    for (const r of await c.keys()) {
      const p = new URL(r.url).pathname;
      if (!p.startsWith("/_next/static/") && !p.startsWith("/icons/"))
        await c.delete(r);
    }
  }
}

export async function checkForUpdate(): Promise<void> {
  if (MINE === "dev" || Date.now() - last < 30_000) return;
  if (BUSY.some((b) => location.pathname.startsWith(b))) return;
  if (document.querySelector('[role="dialog"]')) return;
  last = Date.now();
  let live: string | undefined;
  try {
    const res = await fetch("/api/versione", { cache: "no-store" });
    live = ((await res.json()) as { v?: string }).v;
  } catch {
    return; // senza rete si resta come si è
  }
  if (!live || live === "dev" || live === MINE) return;
  // Una volta sola per versione: se la rete non collabora non si ricarica all'infinito.
  try {
    if (sessionStorage.getItem(TRIED) === live) return;
    sessionStorage.setItem(TRIED, live);
  } catch {
    /* ignore */
  }
  await dropSavedPages().catch(() => undefined);
  const reg = await navigator.serviceWorker
    ?.getRegistration?.()
    .catch(() => undefined);
  await reg?.update().catch(() => undefined);
  location.reload();
}
