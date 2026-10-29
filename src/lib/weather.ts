export const NICHELINO = { lat: 44.995, lon: 7.646 };

export interface HourWeather {
  time: string;
  temp: number;
  rainProb: number;
  code: number;
}

export type WeatherKind = "sereno" | "poco-nuvoloso" | "nuvoloso" | "nebbia" | "pioggia" | "neve" | "temporale";

/** WMO weather codes used by Open-Meteo. */
export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "sereno";
  if (code <= 2) return "poco-nuvoloso";
  if (code === 3) return "nuvoloso";
  if (code === 45 || code === 48) return "nebbia";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "pioggia";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "neve";
  if (code >= 95) return "temporale";
  return "nuvoloso";
}

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  sereno: "Sereno",
  "poco-nuvoloso": "Poco nuvoloso",
  nuvoloso: "Nuvoloso",
  nebbia: "Nebbia",
  pioggia: "Pioggia",
  neve: "Neve",
  temporale: "Temporale",
};

export function rainRisk(w: Pick<HourWeather, "rainProb" | "code">): boolean {
  const k = weatherKind(w.code);
  return w.rainProb >= 50 || k === "pioggia" || k === "temporale" || k === "neve";
}

export function forecastUrl(): string {
  const p = new URLSearchParams({
    latitude: String(NICHELINO.lat),
    longitude: String(NICHELINO.lon),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    timezone: "Europe/Rome",
    forecast_days: "16",
  });
  return `https://api.open-meteo.com/v1/forecast?${p}`;
}

export interface Forecast {
  hours: HourWeather[];
}

export function parseForecast(json: {
  hourly?: { time: string[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; weather_code: number[] };
}): Forecast {
  const h = json.hourly;
  if (!h) return { hours: [] };
  return {
    hours: h.time.map((time, i) => ({
      time,
      temp: h.temperature_2m[i],
      rainProb: h.precipitation_probability[i] ?? 0,
      code: h.weather_code[i],
    })),
  };
}

/** Hour closest to the given instant (forecast times are local Europe/Rome, "YYYY-MM-DDTHH:00"). */
export function weatherAt(f: Forecast, iso: string): HourWeather | null {
  if (!f.hours.length) return null;
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const key = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:00`;
  return f.hours.find((h) => h.time === key) ?? null;
}
