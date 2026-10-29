import type { Format, Match } from "./types";

export type Period =
  | { kind: "all" }
  | { kind: "month"; year: number; month: number } // month 0-11
  | { kind: "season"; year: number; quarter: number }; // quarter 0-3

export type FormatFilter = Format | "all";

export interface Filter {
  period: Period;
  format: FormatFilter;
}

export const MONTHS_IT = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export const SEASON_NAMES = ["Inverno", "Primavera", "Estate", "Autunno"];

export function monthOf(date: Date | string): { year: number; month: number } {
  const d = typeof date === "string" ? new Date(date) : date;
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function seasonOf(date: Date | string): { year: number; quarter: number } {
  const { year, month } = monthOf(date);
  return { year, quarter: Math.floor(month / 3) };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function seasonKey(year: number, quarter: number): string {
  return `${year}-S${quarter + 1}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS_IT[month]} ${year}`;
}

export function seasonLabel(year: number, quarter: number): string {
  const from = MONTHS_IT[quarter * 3].slice(0, 3).toLowerCase();
  const to = MONTHS_IT[quarter * 3 + 2].slice(0, 3).toLowerCase();
  return `Stagione ${from}–${to} ${year}`;
}

export function periodLabel(p: Period): string {
  if (p.kind === "all") return "Sempre";
  if (p.kind === "month") return monthLabel(p.year, p.month);
  return seasonLabel(p.year, p.quarter);
}

export function periodRange(p: Period): { start: Date; end: Date } | null {
  if (p.kind === "all") return null;
  if (p.kind === "month") {
    return { start: new Date(p.year, p.month, 1), end: new Date(p.year, p.month + 1, 1) };
  }
  return { start: new Date(p.year, p.quarter * 3, 1), end: new Date(p.year, p.quarter * 3 + 3, 1) };
}

export function inPeriod(dateIso: string, p: Period): boolean {
  const r = periodRange(p);
  if (!r) return true;
  const t = new Date(dateIso).getTime();
  return t >= r.start.getTime() && t < r.end.getTime();
}

export function isPeriodOver(p: Period, now: Date = new Date()): boolean {
  const r = periodRange(p);
  if (!r) return false;
  return now.getTime() >= r.end.getTime();
}

export function filterMatches(matches: Match[], f: Partial<Filter>): Match[] {
  return matches.filter(
    (m) =>
      (!f.period || inPeriod(m.playedAt, f.period)) &&
      (!f.format || f.format === "all" || m.format === f.format),
  );
}

export function sortChrono(matches: Match[]): Match[] {
  return [...matches].sort(
    (a, b) => a.playedAt.localeCompare(b.playedAt) || a.createdAt.localeCompare(b.createdAt),
  );
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function shiftSeason(year: number, quarter: number, delta: number) {
  const idx = year * 4 + quarter + delta;
  return { year: Math.floor(idx / 4), quarter: ((idx % 4) + 4) % 4 };
}

/** All months (oldest first) that contain at least one match. */
export function monthsWithMatches(matches: Match[]): { year: number; month: number }[] {
  const keys = new Map<string, { year: number; month: number }>();
  for (const m of matches) {
    const mo = monthOf(m.playedAt);
    keys.set(monthKey(mo.year, mo.month), mo);
  }
  return [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

export function seasonsWithMatches(matches: Match[]): { year: number; quarter: number }[] {
  const keys = new Map<string, { year: number; quarter: number }>();
  for (const m of matches) {
    const s = seasonOf(m.playedAt);
    keys.set(seasonKey(s.year, s.quarter), s);
  }
  return [...keys.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}
