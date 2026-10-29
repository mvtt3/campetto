"use client";

import { useEffect, useState } from "react";
import { forecastUrl, parseForecast, type Forecast } from "./weather";

const KEY = "campetto:weather";
const TTL = 60 * 60_000;
let inflight: Promise<Forecast> | null = null;

async function load(): Promise<Forecast> {
  try {
    const cached = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (cached && Date.now() - cached.at < TTL) return cached.f as Forecast;
  } catch {
    /* ignore */
  }
  if (!inflight) {
    inflight = fetch(forecastUrl())
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("meteo"))))
      .then((j) => {
        const f = parseForecast(j);
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), f }));
        } catch {
          /* ignore */
        }
        return f;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Hourly forecast for Nichelino (Open-Meteo, free, no key). Null while loading or offline. */
export function useForecast(): Forecast | null {
  const [f, setF] = useState<Forecast | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((x) => alive && setF(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return f;
}
