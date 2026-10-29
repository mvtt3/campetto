"use client";

import clsx from "clsx";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

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
              "sticker pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-[14px] font-bold",
              t.tone === "error" ? "bg-surface text-danger" : "bg-volt text-volt-ink",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
