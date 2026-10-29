"use client";

import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data/provider";
import { ToastProvider } from "./ui/toast";
import { primeAudio } from "@/lib/sound";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => primeAudio(), []);
  // Niente zoom: Safari ha i suoi gesti del pizzico, i computer il pizzico del trackpad (ctrl + rotella).
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const wheel = (e: WheelEvent) => e.ctrlKey && e.preventDefault();
    for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(t, stop, { passive: false });
    window.addEventListener("wheel", wheel, { passive: false });
    return () => {
      for (const t of ["gesturestart", "gesturechange", "gestureend"]) document.removeEventListener(t, stop);
      window.removeEventListener("wheel", wheel);
    };
  }, []);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return (
    <DataProvider>
      <ToastProvider>{children}</ToastProvider>
    </DataProvider>
  );
}
