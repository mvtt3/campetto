"use client";

import clsx from "clsx";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SpicchioFace } from "./pull-to-refresh";

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "error";
  leaving?: boolean;
}

const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    // Un messaggio alla volta: quello nuovo prende il posto del vecchio, che svanisce.
    setItems((xs) => [...xs.filter((x) => !x.leaving).map((x) => ({ ...x, leaving: true })), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id === id || !x.leaving)), 520);
    const stay = tone === "error" ? 5200 : 3000;
    setTimeout(() => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x))), stay);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), stay + 520);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] grid justify-items-center px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={clsx(
              "toast pointer-events-auto col-start-1 row-start-1 flex max-w-sm items-center gap-2.5 rounded-[22px] border-2 border-edge bg-surface py-2 pl-2 pr-4 text-[14px] font-semibold leading-snug text-text [text-wrap:pretty]",
              t.leaving && "toast-leave",
            )}
          >
            <span className={clsx("grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#1d1a16]", t.tone === "error" ? "bg-ball-soft" : "bg-volt")}>
              <SpicchioFace size={30} pose={t.tone === "error" ? "boh" : "ciao"} />
            </span>
            <span className="min-w-0">{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
