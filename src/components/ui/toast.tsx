"use client";

import clsx from "clsx";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { SpicchioFace } from "./pull-to-refresh";

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "error";
}

const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 5000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={clsx(
              "sticker pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-[20px] py-2 pl-2 pr-4 text-[14px] font-bold leading-snug [text-wrap:pretty]",
              t.tone === "error" ? "bg-surface text-text" : "bg-volt text-volt-ink",
            )}
          >
            <span className={clsx("grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#1d1a16]", t.tone === "error" ? "bg-danger" : "bg-court")}>
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
