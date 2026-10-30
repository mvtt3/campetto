"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useData } from "@/lib/data/provider";
import { currentSubscription, disablePush, enablePush } from "./push-client";

/** Notifiche su questo telefono: stato e interruttore, con i messaggi di Spicchio. */
export function usePush() {
  const { backend } = useData();
  const toast = useToast();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void currentSubscription().then((s) => setOn(Boolean(s)));
  }, []);

  const toggle = async (want: boolean) => {
    setBusy(true);
    try {
      if (want) {
        const r = await enablePush(backend);
        if (r === "ok") {
          setOn(true);
          toast("Fatto, ora ti avviso io");
          void backend.notify({ type: "test" });
        } else if (r === "denied")
          toast(
            "Il telefono mi blocca: riattiva le notifiche di Campetto nelle impostazioni del telefono",
            "error",
          );
        else if (r === "install")
          toast(
            "Su iPhone prima aggiungimi alla schermata Home, poi ti posso avvisare",
            "error",
          );
        else
          toast("Da questo browser non riesco a mandarti notifiche", "error");
      } else {
        await disablePush(backend);
        setOn(false);
        toast("Ok, niente più notifiche su questo telefono");
      }
    } catch {
      toast(
        "Non sono riuscito a cambiare le notifiche, riprova tra poco",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return { on, busy, toggle };
}
