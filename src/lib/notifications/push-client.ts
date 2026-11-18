"use client";

import { VAPID_PUBLIC_KEY } from "../config";
import type { Backend } from "../data/backend";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Su Android l'app installata si apre a tutto schermo.
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * I passaggi per accendere le notifiche. Ognuno ha un tempo massimo: il telefono a volte non
 * risponde mai (servizio notifiche addormentato dal risparmio batteria, rete appesa) e senza un
 * limite la rotellina girerebbe per sempre.
 */
export type PushStep = "permesso" | "app" | "iscrizione" | "salvataggio";

export const PUSH_LIMITS: Record<PushStep, number> = {
  // Qui si aspetta la persona che risponde alla richiesta del telefono: tempo largo.
  permesso: 40_000,
  app: 15_000,
  iscrizione: 25_000,
  salvataggio: 15_000,
};

/** Un passaggio che non ha risposto in tempo (o ha dato errore). */
export class PushStuck extends Error {
  constructor(
    readonly step: PushStep,
    readonly timedOut: boolean,
    readonly cause?: unknown,
    /** Quanto si è aspettato prima di arrendersi. */
    readonly ms = PUSH_LIMITS[step],
  ) {
    super(
      timedOut
        ? `${step}: nessuna risposta in ${ms / 1000}s`
        : `${step}: ${errorText(cause)}`,
    );
    this.name = "PushStuck";
  }
}

function errorText(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`.slice(0, 160);
  return String(e).slice(0, 160);
}

/** Aspetta al massimo il tempo del passaggio; un errore viene etichettato col passaggio. */
export function within<T>(
  p: Promise<T>,
  step: PushStep,
  ms = PUSH_LIMITS[step],
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new PushStuck(step, true, undefined, ms)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e instanceof PushStuck ? e : new PushStuck(step, false, e));
      },
    );
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try {
    const reg = await within(
      navigator.serviceWorker.getRegistration("/"),
      "app",
      5000,
    );
    return (await reg?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/** La parte dell'app che riceve le notifiche, accesa e pronta. Se manca, la si registra di nuovo. */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const sw = navigator.serviceWorker;
  const reg = await within(sw.getRegistration("/"), "app", 5000);
  if (!reg?.active) await within(sw.register("/sw.js", { scope: "/" }), "app");
  return within(sw.ready, "app");
}

/** Evento sulla finestra quando un'accensione andata oltre il tempo finisce bene più tardi. */
export const PUSH_LATE_EVENT = "campetto:notifiche-accese";

export async function enablePush(
  backend: Backend,
): Promise<"ok" | "denied" | "unsupported" | "install"> {
  if (!pushSupported())
    return isIos() && !isStandalone() ? "install" : "unsupported";
  // Se il controllo all'apertura sta già rifacendo l'iscrizione, gli si lascia un attimo per finire:
  // due iscrizioni insieme sullo stesso telefono si pestano i piedi.
  if (checking) await Promise.race([checking, sleep(4000)]);
  let permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission !== "granted")
    permission = await within(Notification.requestPermission(), "permesso");
  if (permission !== "granted") return "denied";
  const reg = await readyRegistration();
  const subscribing = freshSubscription(reg);
  let sub: PushSubscription;
  try {
    sub = await within(subscribing, "iscrizione");
  } catch (e) {
    if (e instanceof PushStuck && e.timedOut) {
      // Il telefono ci mette più del dovuto: se poi risponde, si finisce da soli e la pagina lo sa.
      void subscribing
        .then((late) => backend.savePushSubscription(late.toJSON()))
        .then(() => {
          pushChecked(true);
          window.dispatchEvent(new Event(PUSH_LATE_EVENT));
        })
        .catch(() => {});
    }
    if (blockedBySystem(e)) return "denied";
    throw e;
  }
  await within(backend.savePushSubscription(sub.toJSON()), "salvataggio");
  pushChecked(true);
  return "ok";
}

/** Chrome dice "permesso negato" anche quando le notifiche sono spente per Chrome nel telefono. */
function blockedBySystem(e: unknown): boolean {
  const cause = e instanceof PushStuck ? e.cause : e;
  return (
    cause instanceof Error &&
    (cause.name === "NotAllowedError" ||
      /permission denied/i.test(cause.message))
  );
}

/**
 * Un'iscrizione nuova di zecca. Quella vecchia si butta: può essere scaduta (Apple e Google la
 * rifiutano e il server la cancella) o fatta con una chiave vecchia, e riusarla vorrebbe dire
 * "attive" sul telefono ma niente che arriva.
 */
async function freshSubscription(
  reg: ServiceWorkerRegistration,
): Promise<PushSubscription> {
  const old = await reg.pushManager.getSubscription();
  if (old)
    await within(old.unsubscribe(), "iscrizione", 8000).catch(() => false);
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

let checked: Promise<boolean> | null = null;
/** Il controllo all'apertura mentre è ancora in corso. */
let checking: Promise<boolean> | null = null;
/**
 * All'apertura: se il telefono ha le notifiche accese ma il server non ha più la sua iscrizione
 * (scaduta, o mai salvata per un errore di rete), ne fa una nuova e la salva, senza chiedere nulla.
 * Restituisce se le notifiche su questo telefono sono davvero attive. Una volta per apertura,
 * e mai per più di qualche decina di secondi.
 */
export function checkPush(backend: Backend): Promise<boolean> {
  if (checked) return checked;
  const run = (async () => {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    try {
      const reg = await within(
        navigator.serviceWorker.getRegistration("/"),
        "app",
        5000,
      );
      const sub = await reg?.pushManager.getSubscription();
      if (!reg || !sub) return false;
      // Se il server non risponde si tiene per buona l'iscrizione che c'è: rifarla per un intoppo di
      // rete vorrebbe dire buttarne una che funziona.
      const known = await within(
        backend.hasPushSubscription(sub.endpoint),
        "salvataggio",
      ).catch(() => true);
      if (known) return true;
      const fresh = await within(freshSubscription(reg), "iscrizione");
      await within(backend.savePushSubscription(fresh.toJSON()), "salvataggio");
      return true;
    } catch {
      return false; // l'interruttore torna spento: un tocco e si rifà da capo
    } finally {
      checking = null;
    }
  })();
  checking = run;
  checked = run;
  return run;
}

/** Dopo un'accensione o uno spegnimento a mano il controllo all'apertura non serve più. */
export function pushChecked(on: boolean) {
  checked = Promise.resolve(on);
}

export async function disablePush(backend: Backend): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await within(backend.removePushSubscription(sub.endpoint), "salvataggio");
  await within(sub.unsubscribe(), "iscrizione").catch(() => false);
  pushChecked(false);
}

/** Com'è messo il telefono, in breve: per la segnalazione automatica quando qualcosa si blocca. */
export async function pushSnapshot(): Promise<string> {
  const parts: string[] = [];
  try {
    parts.push(`permesso ${Notification.permission}`);
    parts.push(isStandalone() ? "app installata" : "nel browser");
    const reg = await within(
      navigator.serviceWorker.getRegistration("/"),
      "app",
      3000,
    ).catch(() => undefined);
    parts.push(
      reg
        ? `sw ${reg.active?.state ?? "non attivo"}${reg.installing ? " +installing" : ""}${reg.waiting ? " +waiting" : ""}`
        : "sw assente",
    );
    parts.push(
      navigator.serviceWorker.controller
        ? "pagina controllata"
        : "pagina non controllata",
    );
    const sub = await reg?.pushManager.getSubscription().catch(() => null);
    parts.push(
      sub ? `iscrizione ${new URL(sub.endpoint).host}` : "nessuna iscrizione",
    );
    parts.push(navigator.onLine ? "online" : "offline");
  } catch (e) {
    parts.push(errorText(e));
  }
  return parts.join(", ");
}
