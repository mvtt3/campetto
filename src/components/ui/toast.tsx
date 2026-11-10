"use client";

import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { IconAlertCircle, IconCheck } from "@tabler/icons-react";
import { play } from "@/lib/sound";

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "error";
  leaving?: boolean;
}

const ToastCtx = createContext<(text: string, tone?: "ok" | "error") => void>(
  () => {},
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    if (tone === "error") play("error");
    // Un messaggio alla volta: quello nuovo prende il posto del vecchio, che svanisce.
    setItems((xs) => [
      ...xs.filter((x) => !x.leaving).map((x) => ({ ...x, leaving: true })),
      { id, text, tone },
    ]);
    setTimeout(
      () => setItems((xs) => xs.filter((x) => x.id === id || !x.leaving)),
      520,
    );
    const stay = tone === "error" ? 5200 : 3000;
    setTimeout(
      () =>
        setItems((xs) =>
          xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)),
        ),
      stay,
    );
    setTimeout(
      () => setItems((xs) => xs.filter((x) => x.id !== id)),
      stay + 520,
    );
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] grid justify-items-center px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={clsx(
              "toast pointer-events-auto col-start-1 row-start-1 flex max-w-[22rem] items-center gap-2 rounded-full bg-text py-2 pl-2.5 pr-4 text-[13px] font-semibold leading-snug text-bg [text-wrap:pretty]",
              t.leaving && "toast-leave",
            )}
          >
            {t.tone === "error" ? (
              <IconAlertCircle size={17} className="shrink-0 text-danger" aria-hidden />
            ) : (
              <IconCheck size={17} strokeWidth={2.6} className="shrink-0 text-ok" aria-hidden />
            )}
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
