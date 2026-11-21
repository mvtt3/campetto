"use client";

import { VAPID_PUBLIC_KEY, oneSignalFor } from "../config";
import type { Backend } from "../data/backend";
import {
  ONESIGNAL_PREFIX,
  type OneSignalApi,
  loadOneSignal,
  oneSignalId,
  oneSignalSubscribe,
} from "./onesignal";

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

/** Chi usa l'app su questo telefono: decide se le notifiche passano da OneSignal. */
let who: { id: string; isAdmin: boolean } | null = null;

const viaOneSignal = () => oneSignalFor(who);

/** Da chiamare appena si sa chi è entrato, prima dei controlli sulle notifiche. */
export function configurePush(
  me: { id: string; isAdmin: boolean } | null | undefined,
) {
  const before = viaOneSignal();
  who = me ? { id: me.id, isAdmin: me.isAdmin } : null;
  // Cambia la strada delle notifiche: il controllo fatto con l'altra non vale più.
  if (before !== viaOneSignal()) checked = null;
}

/** Evento sulla finestra quando un'accensione andata oltre il tempo finisce bene più tardi. */
export const PUSH_LATE_EVENT = "campetto:notifiche-accese";

const WANT_KEY = "campetto:notifiche-volute";

/**
 * Se su questo telefono le notifiche sono state chieste (e non spente a mano). Serve per accenderle
 * da sole quando il permesso arriva dopo: risposta in ritardo, o dato dalle impostazioni.
 */
export function wantPush(): boolean {
  return pushWish() === "1";
}

/** "1" chieste, "0" spente a mano, null mai toccate su questo telefono. */
function pushWish(): "1" | "0" | null {
  try {
    const v = localStorage.getItem(WANT_KEY);
    return v === "1" || v === "0" ? v : null;
  } catch {
    return null;
  }
}

export function setWantPush(on: boolean) {
  try {
    localStorage.setItem(WANT_KEY, on ? "1" : "0");
  } catch {
    /* senza memoria locale si chiede di nuovo a mano */
  }
}

/**
 * Com'è finita l'accensione. "dismissed": la richiesta è sparita senza risposta (Chrome su Android
 * ora mostra una richiesta leggera che scade da sola, e nell'app installata a volte non si vede).
 */
export type EnableResult =
  "ok" | "denied" | "dismissed" | "unsupported" | "install";

/** Un'accensione a mano in corso: intanto niente accensioni da sole, si pesterebbero i piedi. */
let enabling = false;

export async function enablePush(backend: Backend): Promise<EnableResult> {
  enabling = true;
  try {
    return await enableNow(backend);
  } finally {
    enabling = false;
  }
}

async function enableNow(backend: Backend): Promise<EnableResult> {
  if (!pushSupported())
    return isIos() && !isStandalone() ? "install" : "unsupported";
  setWantPush(true);
  // Se il controllo all'apertura sta già rifacendo l'iscrizione, gli si lascia un attimo per finire:
  // due iscrizioni insieme sullo stesso telefono si pestano i piedi.
  if (checking) await Promise.race([checking, sleep(4000)]);
  let permission = Notification.permission;
  if (permission === "denied") return "denied";
  if (permission !== "granted") {
    const asking = Notification.requestPermission();
    try {
      permission = await within(asking, "permesso");
    } catch (e) {
      // La richiesta resta aperta: se il telefono risponde sì più tardi, si finisce da soli.
      if (e instanceof PushStuck && e.timedOut)
        void asking
          .then((p) => (p === "granted" ? lateFinish(backend) : undefined))
          .catch(() => {});
      throw e;
    }
  }
  if (permission === "default") return "dismissed";
  if (permission !== "granted") return "denied";
  if (viaOneSignal()) return enableOneSignal(backend);
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

/** Un'accensione finita più tardi del previsto: la pagina lo sa e accende l'interruttore. */
async function lateFinish(backend: Backend) {
  if (await resumePush(backend))
    window.dispatchEvent(new Event(PUSH_LATE_EVENT));
}

let resuming: Promise<boolean> | null = null;
/**
 * Il permesso c'è ma l'iscrizione no, e su questo telefono le notifiche erano state chieste: la si
 * fa adesso, senza chiedere nulla. Succede tornando dalle impostazioni dove si è dato il permesso,
 * o quando la richiesta del telefono riceve un sì dopo il tempo massimo.
 */
export function resumePush(backend: Backend): Promise<boolean> {
  if (resuming) return resuming;
  if (
    enabling ||
    !pushSupported() ||
    Notification.permission !== "granted" ||
    !wantPush()
  )
    return Promise.resolve(false);
  const run = (async () => {
    try {
      if (viaOneSignal()) return await oneSignalCheck(backend);
      const reg = await readyRegistration();
      const old = await reg.pushManager.getSubscription();
      if (old) {
        const known = await within(
          backend.hasPushSubscription(old.endpoint),
          "salvataggio",
        ).catch(() => true);
        if (known) {
          pushChecked(true);
          return true;
        }
      }
      const fresh = await within(freshSubscription(reg), "iscrizione");
      await within(backend.savePushSubscription(fresh.toJSON()), "salvataggio");
      pushChecked(true);
      return true;
    } catch {
      return false;
    } finally {
      resuming = null;
    }
  })();
  resuming = run;
  return run;
}

/**
 * Avvisa quando il permesso delle notifiche cambia: dalla richiesta del telefono, dai controlli del
 * sito di Chrome o tornando nell'app dalle impostazioni. Restituisce come smettere di ascoltare.
 */
export function watchPermission(
  onChange: (p: NotificationPermission) => void,
): () => void {
  if (!pushSupported()) return () => {};
  let last = Notification.permission;
  let alive = true;
  const check = () => {
    const now = Notification.permission;
    if (!alive || now === last) return;
    last = now;
    onChange(now);
  };
  let status: PermissionStatus | null = null;
  void navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((s) => {
      if (!alive) return;
      status = s;
      s.addEventListener("change", check);
    })
    .catch(() => {});
  document.addEventListener("visibilitychange", check);
  window.addEventListener("focus", check);
  return () => {
    alive = false;
    status?.removeEventListener("change", check);
    document.removeEventListener("visibilitychange", check);
    window.removeEventListener("focus", check);
  };
}

/** Dove si dà il permesso, a seconda del telefono e del browser. */
export type PermissionHelp = "chrome" | "samsung" | "ios" | "altro";

export function permissionHelp(): PermissionHelp {
  if (isIos()) return "ios";
  const ua = navigator.userAgent;
  if (/SamsungBrowser/i.test(ua)) return "samsung";
  if (/Android/i.test(ua) && /Chrome\//.test(ua)) return "chrome";
  return "altro";
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
      if (viaOneSignal()) {
        // OneSignal si carica quando l'app è già aperta: non rallenta l'avvio.
        await sleep(1500);
        return await oneSignalCheck(backend);
      }
      const reg = await within(
        navigator.serviceWorker.getRegistration("/"),
        "app",
        5000,
      );
      if (!reg) return false;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        // Il telefono ha perso l'iscrizione (o non è mai arrivata): se le notifiche erano state
        // chieste qui e il permesso c'è, se ne fa una nuova senza disturbare.
        if (!wantPush()) return false;
        const fresh = await within(freshSubscription(reg), "iscrizione");
        await within(
          backend.savePushSubscription(fresh.toJSON()),
          "salvataggio",
        );
        return true;
      }
      // Se il server non risponde si tiene per buona l'iscrizione che c'è: rifarla per un intoppo di
      // rete vorrebbe dire buttarne una che funziona.
      const known = await within(
        backend.hasPushSubscription(sub.endpoint),
        "salvataggio",
      ).catch(() => true);
      if (known) {
        setWantPush(true);
        return true;
      }
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
  setWantPush(false);
  if (viaOneSignal()) {
    const os = await within(loadOneSignal(), "app");
    const id = os.User.PushSubscription.id;
    await within(os.User.PushSubscription.optOut(), "iscrizione");
    if (id)
      await within(
        backend.removePushSubscription(ONESIGNAL_PREFIX + id),
        "salvataggio",
      );
    pushChecked(false);
    return;
  }
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
    if (viaOneSignal())
      parts.push(
        lastOs
          ? `OneSignal ${oneSignalId(lastOs) ?? "senza iscrizione"}`
          : "OneSignal non caricato",
      );
    parts.push(navigator.onLine ? "online" : "offline");
  } catch (e) {
    parts.push(errorText(e));
  }
  return parts.join(", ");
}

/** Lo stato da mostrare subito, prima del controllo completo. */
export async function quickPushState(): Promise<boolean> {
  if (!viaOneSignal()) return Boolean(await currentSubscription());
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const wish = pushWish();
  return (
    wish === "1" || (wish === null && Boolean(await currentSubscription()))
  );
}

/* ---------------------------------------------------------------------------------------------
 * OneSignal: il permesso lo chiediamo noi come prima (con i tempi massimi e l'aiuto), poi
 * l'iscrizione la fa OneSignal. Sul server resta una riga "onesignal:<numero>" al posto
 * dell'indirizzo del telefono: così le preferenze e i promemoria funzionano come prima.
 * ------------------------------------------------------------------------------------------- */

/** L'ultimo OneSignal caricato, per la segnalazione automatica. */
let lastOs: OneSignalApi | null = null;
const SAVED_KEY = "campetto:onesignal-id";

async function openOneSignal(): Promise<OneSignalApi> {
  const os = await within(loadOneSignal(), "app", 20_000);
  lastOs = os;
  watchOneSignal(os);
  // Il nome sul pannello di OneSignal: utile per le prove, non blocca nulla.
  if (who && !loggedIn) {
    loggedIn = true;
    void os.login(who.id).catch(() => {
      loggedIn = false;
    });
  }
  return os;
}
let loggedIn = false;

/** Salva sul server l'iscrizione di OneSignal (e toglie quella vecchia di questo telefono). */
async function saveOneSignal(backend: Backend, id: string) {
  await backend.savePushSubscription({
    endpoint: ONESIGNAL_PREFIX + id,
    keys: { p256dh: "onesignal", auth: "onesignal" },
  });
  let prev: string | null = null;
  try {
    prev = localStorage.getItem(SAVED_KEY);
    localStorage.setItem(SAVED_KEY, id);
  } catch {
    /* senza memoria locale la vecchia la ripulisce il server */
  }
  if (prev && prev !== id)
    await backend
      .removePushSubscription(ONESIGNAL_PREFIX + prev)
      .catch(() => {});
}

/** La vecchia iscrizione del telefono (prima di OneSignal): via dal server. */
function dropLegacy(
  backend: Backend,
  os: OneSignalApi,
  legacy: PushSubscription | null,
) {
  if (legacy && legacy.endpoint !== os.User.PushSubscription.token)
    void backend.removePushSubscription(legacy.endpoint).catch(() => {});
}

let watching = false;
/** Se OneSignal cambia il numero dell'iscrizione, il server lo sa subito. */
function watchOneSignal(os: OneSignalApi) {
  if (watching) return;
  watching = true;
  os.User.PushSubscription.addEventListener("change", (e) => {
    const id = e.current.id;
    if (!id || !e.current.optedIn || !wantPush() || !savedBackend) return;
    void saveOneSignal(savedBackend, id).catch(() => {});
  });
}
let savedBackend: Backend | null = null;

async function enableOneSignal(backend: Backend): Promise<EnableResult> {
  savedBackend = backend;
  const legacy = await currentSubscription();
  const os = await openOneSignal();
  const subscribing = oneSignalSubscribe(os);
  let id: string;
  try {
    id = await within(subscribing, "iscrizione");
  } catch (e) {
    if (e instanceof PushStuck && e.timedOut) {
      // OneSignal ci mette più del dovuto: se poi risponde, si finisce da soli.
      void subscribing
        .then((late) => saveOneSignal(backend, late))
        .then(() => {
          pushChecked(true);
          window.dispatchEvent(new Event(PUSH_LATE_EVENT));
        })
        .catch(() => {});
    }
    throw e;
  }
  await within(saveOneSignal(backend, id), "salvataggio");
  dropLegacy(backend, os, legacy);
  pushChecked(true);
  return "ok";
}

/**
 * All'apertura (e quando il permesso arriva da fuori): chi aveva le notifiche passa a OneSignal
 * da solo, senza chiedere nulla; chi le ha già con OneSignal controlla che il server lo sappia.
 */
async function oneSignalCheck(backend: Backend): Promise<boolean> {
  savedBackend = backend;
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const wish = pushWish();
  const legacy = await currentSubscription();
  if (wish === "0" || (wish === null && !legacy)) return false;
  const os = await openOneSignal();
  const id =
    oneSignalId(os) ?? (await within(oneSignalSubscribe(os), "iscrizione"));
  setWantPush(true);
  const known = await within(
    backend.hasPushSubscription(ONESIGNAL_PREFIX + id),
    "salvataggio",
  ).catch(() => true);
  if (!known) await within(saveOneSignal(backend, id), "salvataggio");
  dropLegacy(backend, os, legacy);
  return true;
}
