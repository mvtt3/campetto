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

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function enablePush(
  backend: Backend,
): Promise<"ok" | "denied" | "unsupported" | "install"> {
  if (!pushSupported())
    return isIos() && !isStandalone() ? "install" : "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  await backend.savePushSubscription((await freshSubscription(reg)).toJSON());
  pushChecked(true);
  return "ok";
}

/**
 * Un'iscrizione nuova di zecca. Quella vecchia si butta: può essere scaduta (Apple e Google la
 * rifiutano e il server la cancella) o fatta con una chiave vecchia, e riusarla vorrebbe dire
 * "attive" sul telefono ma niente che arriva.
 */
async function freshSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe().catch(() => false);
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

let checked: Promise<boolean> | null = null;
/**
 * All'apertura: se il telefono ha le notifiche accese ma il server non ha più la sua iscrizione
 * (scaduta, o mai salvata per un errore di rete), ne fa una nuova e la salva, senza chiedere nulla.
 * Restituisce se le notifiche su questo telefono sono davvero attive. Una volta per apertura.
 */
export function checkPush(backend: Backend): Promise<boolean> {
  checked ??= (async () => {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!reg || !sub) return false;
    if (await backend.hasPushSubscription(sub.endpoint).catch(() => true)) return true;
    try {
      await backend.savePushSubscription((await freshSubscription(reg)).toJSON());
      return true;
    } catch {
      return false; // l'interruttore torna spento: un tocco e si rifà da capo
    }
  })();
  return checked;
}

/** Dopo un'accensione o uno spegnimento a mano il controllo all'apertura non serve più. */
export function pushChecked(on: boolean) {
  checked = Promise.resolve(on);
}

export async function disablePush(backend: Backend): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await backend.removePushSubscription(sub.endpoint);
  await sub.unsubscribe();
  pushChecked(false);
}
