"use client";

import { ONESIGNAL_APP_ID, ONESIGNAL_SAFARI_WEB_ID } from "../config";

/** La parte di OneSignal che usiamo (SDK web v16). */
export interface OneSignalApi {
  init(options: Record<string, unknown>): Promise<void>;
  login(externalId: string): Promise<void>;
  Notifications: {
    requestPermission(): Promise<boolean>;
  };
  User: {
    PushSubscription: {
      readonly id: string | null | undefined;
      readonly token: string | null | undefined;
      readonly optedIn: boolean;
      optIn(): Promise<void>;
      optOut(): Promise<void>;
      addEventListener(
        event: "change",
        listener: (e: OneSignalChange) => void,
      ): void;
      removeEventListener(
        event: "change",
        listener: (e: OneSignalChange) => void,
      ): void;
    };
  };
}

export interface OneSignalChange {
  previous: { id?: string | null; optedIn?: boolean };
  current: { id?: string | null; optedIn?: boolean };
}

type Deferred = ((os: OneSignalApi) => void | Promise<void>)[];

export const ONESIGNAL_SDK =
  "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";

/** Le iscrizioni di OneSignal si salvano così, al posto dell'indirizzo del telefono. */
export const ONESIGNAL_PREFIX = "onesignal:";

let loading: Promise<OneSignalApi> | null = null;

/**
 * Carica OneSignal e lo avvia una volta sola. La parte che riceve le notifiche è la nostra
 * (sw.js), che OneSignal registra con il suo App ID nell'indirizzo: così resta una sola.
 */
export function loadOneSignal(): Promise<OneSignalApi> {
  if (loading) return loading;
  const run = new Promise<OneSignalApi>((resolve, reject) => {
    const w = window as unknown as { OneSignalDeferred?: Deferred };
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (os) => {
      try {
        await os.init({
          appId: ONESIGNAL_APP_ID,
          safari_web_id: ONESIGNAL_SAFARI_WEB_ID,
          serviceWorkerPath: "sw.js",
          serviceWorkerParam: { scope: "/" },
          autoResubscribe: true,
          notifyButton: { enable: false },
          // Il benvenuto lo mandiamo noi ("Notifiche accese").
          welcomeNotification: { disable: true },
          persistNotification: false,
          // Al tocco: l'app aperta va alla pagina giusta, invece di aprirne un'altra.
          notificationClickHandlerMatch: "origin",
          notificationClickHandlerAction: "navigate",
        });
        resolve(os);
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
    if (!document.querySelector(`script[src="${ONESIGNAL_SDK}"]`)) {
      const s = document.createElement("script");
      s.src = ONESIGNAL_SDK;
      s.defer = true;
      s.onerror = () => reject(new Error("OneSignal non raggiungibile"));
      document.head.appendChild(s);
    }
  });
  loading = run;
  // Se non si carica (rete), al prossimo tentativo si riprova da capo.
  run.catch(() => {
    if (loading === run) loading = null;
  });
  return run;
}

/** L'iscrizione di OneSignal su questo telefono, se c'è ed è attiva. */
export function oneSignalId(os: OneSignalApi): string | null {
  const sub = os.User.PushSubscription;
  return sub.optedIn && sub.id ? sub.id : null;
}

/**
 * Accende l'iscrizione di OneSignal (il permesso del telefono deve esserci già) e aspetta che
 * OneSignal le dia il suo numero. Restituisce quel numero.
 */
export async function oneSignalSubscribe(os: OneSignalApi): Promise<string> {
  const sub = os.User.PushSubscription;
  const ready = oneSignalId(os);
  if (ready) return ready;
  const got = new Promise<string>((resolve) => {
    const onChange = (e: OneSignalChange) => {
      if (e.current.id && e.current.optedIn) {
        sub.removeEventListener("change", onChange);
        resolve(e.current.id);
      }
    };
    sub.addEventListener("change", onChange);
  });
  await sub.optIn();
  // Con il permesso già dato, questo crea l'iscrizione (e sostituisce quella vecchia del telefono).
  await os.Notifications.requestPermission();
  const now = oneSignalId(os);
  if (now) return now;
  // Il numero arriva dal server di OneSignal qualche istante dopo.
  return Promise.race([
    got,
    (async () => {
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const id = oneSignalId(os);
        if (id) return id;
      }
      throw new Error("OneSignal non ha dato il numero dell'iscrizione");
    })(),
  ]);
}
