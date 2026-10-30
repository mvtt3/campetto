"use client";

import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data/provider";
import { ToastProvider } from "./ui/toast";
import { primeAudio } from "@/lib/sound";
import { checkForUpdate } from "@/lib/auto-update";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => primeAudio(), []);
  // Schermo intero su Android: lo fa il manifest ("display": "fullscreen"), senza chiederlo
  // dalla pagina. La richiesta dalla pagina faceva comparire ogni volta l'avviso del telefono
  // "trascina verso il basso per uscire", fastidioso: tolta.
  // Niente zoom, mai. Ogni browser ha la sua strada, quindi le chiudiamo tutte:
  // - Safari: i gesti del pizzico (gesturestart/change/end);
  // - Chrome e Samsung Internet: due dita sullo schermo, fermate appena si appoggia la seconda;
  // - computer: ctrl + rotella del trackpad;
  // - "forza lo zoom" nelle impostazioni di accessibilità: se la pagina risulta comunque
  //   ingrandita, la riportiamo subito alla dimensione normale.
  useEffect(() => {
    const stop = (e: Event) => e.cancelable && e.preventDefault();
    const wheel = (e: WheelEvent) => e.ctrlKey && e.preventDefault();
    const twoFingers = (e: TouchEvent) =>
      e.touches.length > 1 && e.cancelable && e.preventDefault();
    const opts = { passive: false, capture: true } as const;
    for (const t of ["gesturestart", "gesturechange", "gestureend"])
      document.addEventListener(t, stop, opts);
    window.addEventListener("touchstart", twoFingers, opts);
    window.addEventListener("touchmove", twoFingers, opts);
    window.addEventListener("wheel", wheel, { passive: false });
    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="viewport"]',
    );
    const vv = window.visualViewport;
    const reset = () => {
      if (!vv || !meta || vv.scale <= 1.01) return;
      const content = meta.content;
      // Cambiare il viewport costringe il browser a tornare alla scala 1.
      meta.content = `${content.replace(/,?\s*maximum-scale=[^,]*/g, "")}, maximum-scale=1.0001`;
      requestAnimationFrame(() => (meta.content = content));
    };
    vv?.addEventListener("resize", reset);
    return () => {
      for (const t of ["gesturestart", "gesturechange", "gestureend"])
        document.removeEventListener(t, stop, opts);
      window.removeEventListener("touchstart", twoFingers, opts);
      window.removeEventListener("touchmove", twoFingers, opts);
      window.removeEventListener("wheel", wheel);
      vv?.removeEventListener("resize", reset);
    };
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }
  }, []);
  // La versione nuova arriva da sola: all'apertura e quando si torna nell'app.
  useEffect(() => {
    void checkForUpdate();
    const onShow = () =>
      document.visibilityState === "visible" && void checkForUpdate();
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);
  return (
    <DataProvider>
      <ToastProvider>{children}</ToastProvider>
    </DataProvider>
  );
}
