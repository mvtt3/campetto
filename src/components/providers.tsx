"use client";

import { useEffect, type ReactNode } from "react";
import { DataProvider } from "@/lib/data/provider";
import { ToastProvider } from "./ui/toast";
import { primeAudio } from "@/lib/sound";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => primeAudio(), []);
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
