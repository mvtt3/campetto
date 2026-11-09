"use client";

import { useEffect, useState } from "react";

/** Current time, refreshed every minute: keeps "today", "upcoming" and similar labels pure during render. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
