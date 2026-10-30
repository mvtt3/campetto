"use client";

import clsx from "clsx";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  type LucideIcon,
  Droplets,
} from "lucide-react";
import {
  rainRisk,
  WEATHER_LABEL,
  weatherAt,
  weatherKind,
  type WeatherKind,
} from "@/lib/weather";
import { useForecast } from "@/lib/use-weather";

const ICON: Record<WeatherKind, LucideIcon> = {
  sereno: Sun,
  "poco-nuvoloso": CloudSun,
  nuvoloso: Cloud,
  nebbia: CloudFog,
  pioggia: CloudRain,
  neve: Snowflake,
  temporale: CloudLightning,
};

export function WeatherChip({
  at,
  className,
}: {
  at: string;
  className?: string;
}) {
  const f = useForecast();
  const w = f ? weatherAt(f, at) : null;
  if (!w) return null;
  const kind = weatherKind(w.code);
  const Icon = ICON[kind];
  const risk = rainRisk(w);
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold",
        risk ? "bg-ball-soft text-ball" : "bg-raised text-muted",
        className,
      )}
      title={`${WEATHER_LABEL[kind]}, pioggia ${w.rainProb}%`}
    >
      <Icon size={15} aria-hidden />
      <span className="tnum">{Math.round(w.temp)}°</span>
      {risk ? (
        // Compatto: una goccia e la percentuale, così il giorno della partita resta leggibile.
        <span className="inline-flex items-center gap-0.5">
          <Droplets size={13} aria-hidden />
          <span className="tnum">{w.rainProb}%</span>
          <span className="sr-only">di rischio pioggia</span>
        </span>
      ) : (
        <span className="sr-only">{WEATHER_LABEL[kind]}</span>
      )}
    </span>
  );
}
