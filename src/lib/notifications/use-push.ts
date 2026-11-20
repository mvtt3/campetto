"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import type { Backend } from "@/lib/data/backend";
import { deviceInfo } from "@/lib/device-info";
import {
  DEFAULT_NOTIFY_PREFS,
  NOTIFY_GROUPS,
  type NotifyPrefs,
} from "@/lib/types";
import {
  PUSH_LATE_EVENT,
  PushStuck,
  type PermissionHelp,
  type PushStep,
  checkPush,
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  permissionHelp,
  pushSnapshot,
  resumePush,
  watchPermission,
} from "./push-client";

/** Cosa dire quando un passaggio si blocca: cosa fare, non cosa è successo dentro. */
function stuckMessage(step: PushStep): string {
  switch (step) {
    case "permesso":
      return "Il telefono non mi ha mostrato la richiesta: qui sotto ti dico dove darmi il permesso";
    case "app":
      return "L'app non si è caricata del tutto: chiudila dalle app recenti, riaprila e riprova";
    case "iscrizione":
      return isIos()
        ? "Il servizio notifiche di Apple non risponde: riprova tra qualche minuto"
        : "Il servizio notifiche del telefono non risponde. Di solito è il risparmio batteria: metti Chrome su «Senza restrizioni» e riprova";
    case "salvataggio":
      return "Connessione lenta: non sono riuscito a salvare, riprova tra poco";
  }
}

/** Il nome del passaggio per la riga di dettaglio sotto l'interruttore. */
const STEP_NAME: Record<PushStep, string> = {
  permesso: "richiesta del permesso",
  app: "avvio dell'app",
  iscrizione: "servizio notifiche del telefono",
  salvataggio: "salvataggio sul server",
};

const REPORT_KEY = "campetto:notifiche-segnalate";
const REPORT_EVERY = 6 * 60 * 60 * 1000;

/** Chi tiene bloccato il permesso, per il messaggio di Spicchio. */
const BLOCKER: Record<PermissionHelp, string> = {
  chrome: "Chrome",
  samsung: "Samsung Internet",
  ios: "L'iPhone",
  altro: "Il browser",
};

/**
 * Quando l'accensione si blocca, una segnalazione arriva da sola a chi aggiusta l'app, con il
 * passaggio fermo e com'è messo il telefono. Senza notifica: è solo da leggere. Al massimo una
 * ogni sei ore per telefono.
 */
async function report(backend: Backend, what: string) {
  try {
    const last = Number(localStorage.getItem(REPORT_KEY) ?? 0);
    if (Date.now() - last < REPORT_EVERY) return;
    localStorage.setItem(REPORT_KEY, String(Date.now()));
  } catch {
    /* senza memoria locale si manda lo stesso */
  }
  await backend
    .sendFeedback({
      kind: "problema",
      message:
        `[Segnalazione automatica] Notifiche non accese. ${what}. ${await pushSnapshot()}`.slice(
          0,
          1900,
        ),
      screen: "/profilo/notifiche",
      device: deviceInfo(),
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    })
    .catch(() => {});
}

/**
 * Notifiche su questo telefono: stato e interruttore, con i messaggi di Spicchio.
 * È l'interruttore principale: accenderlo accende tutti i tipi di notifica, spegnerlo li
 * spegne tutti. Il silenzio di notte resta com'è (lo decide solo chi lo tocca).
 */
export function usePush() {
  const { backend, me, mutate } = useData();

  const setAll = async (value: boolean) => {
    if (!me) return;
    const next: NotifyPrefs = { ...DEFAULT_NOTIFY_PREFS, ...me.notifyPrefs };
    for (const g of NOTIFY_GROUPS)
      for (const it of g.items) next[it.kind] = value;
    mutate((d) => ({
      ...d,
      players: d.players.map((p) =>
        p.id === me.id ? { ...p, notifyPrefs: next } : p,
      ),
    }));
    await backend.updateMe({ notifyPrefs: next }).catch(() => {});
  };
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Dove si è fermato l'ultimo tentativo, per la riga di dettaglio. */
  const [stuck, setStuck] = useState<string | null>(null);
  /** Il permesso manca: dove andare a darlo (la pagina mostra i passaggi). */
  const [help, setHelp] = useState<PermissionHelp | null>(null);

  useEffect(() => {
    // Prima quello che dice il telefono, poi la conferma del server (che ripara se serve).
    let alive = true;
    void currentSubscription().then((s) => alive && setOn(Boolean(s)));
    void checkPush(backend).then((ok) => alive && setOn(ok));
    return () => {
      alive = false;
    };
  }, [backend]);

  /** L'accensione arrivata da sola è già stata annunciata (può arrivare da due strade insieme). */
  const lateDone = useRef(false);
  // Un'accensione andata oltre il tempo che poi finisce bene: si accende da sola.
  useEffect(() => {
    const late = () => {
      if (lateDone.current) return;
      lateDone.current = true;
      setOn(true);
      setStuck(null);
      setHelp(null);
      void setAll(true);
      toast("Eccole, ora sono attive");
    };
    window.addEventListener(PUSH_LATE_EVENT, late);
    return () => window.removeEventListener(PUSH_LATE_EVENT, late);
  });

  // Il permesso arriva da fuori (impostazioni, controlli del sito): si finisce senza altri tocchi.
  useEffect(
    () =>
      watchPermission((p) => {
        if (p !== "granted") return;
        void resumePush(backend).then((ok) => {
          if (ok) window.dispatchEvent(new Event(PUSH_LATE_EVENT));
        });
      }),
    [backend],
  );

  const toggle = async (want: boolean) => {
    if (busy) return;
    setBusy(true);
    setStuck(null);
    setHelp(null);
    lateDone.current = false;
    try {
      if (want) {
        const r = await enablePush(backend);
        if (r === "ok") {
          lateDone.current = true;
          setOn(true);
          await setAll(true);
          toast("Fatto, ora ti avviso io");
          void backend.notify({ type: "test" });
        } else if (r === "denied" || r === "dismissed") {
          const where = permissionHelp();
          setHelp(where);
          toast(
            r === "denied"
              ? `${BLOCKER[where]} mi tiene le notifiche bloccate: qui sotto ti dico come sbloccarle`
              : "Non è arrivata nessuna risposta alla richiesta: qui sotto ti dico dove darmi il permesso",
            "error",
          );
          setStuck(
            `Fermo su: permesso del browser, ${r === "denied" ? "bloccato" : "nessuna risposta"}`,
          );
          void report(backend, `permesso: ${r}`);
        } else if (r === "install")
          toast(
            "Su iPhone prima aggiungimi alla schermata Home, poi ti posso avvisare",
            "error",
          );
        else
          toast("Da questo browser non riesco a mandarti notifiche", "error");
      } else {
        await disablePush(backend);
        setOn(false);
        await setAll(false);
        toast("Ok, niente più notifiche su questo telefono");
      }
    } catch (e) {
      if (want && e instanceof PushStuck) {
        toast(stuckMessage(e.step), "error");
        if (e.step === "permesso") setHelp(permissionHelp());
        setStuck(
          `Fermo su: ${STEP_NAME[e.step]}${e.timedOut ? `, nessuna risposta in ${Math.round(e.ms / 1000)} secondi` : ""}`,
        );
        void report(backend, e.message);
      } else
        toast(
          "Non sono riuscito a cambiare le notifiche, riprova tra poco",
          "error",
        );
    } finally {
      setBusy(false);
    }
  };

  return { on, busy, stuck, help, toggle };
}
