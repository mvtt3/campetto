import { TEAM_SIZE, type Format } from "../types";

export const SUMMARY_INTERVAL_MIN = 30;
export const DEFAULT_NEEDED = 6;

export function neededPlayers(format: Format | null): number {
  return format ? TEAM_SIZE[format] * 2 : DEFAULT_NEEDED;
}

export interface ProposalNotifyState {
  format: Format | null;
  lastSummaryAt: string | null;
  thresholdNotified: boolean;
  /** "si" responses, in the order they arrived. */
  yesNames: string[];
  /** "si" responses not yet included in a summary. */
  pendingYes: number;
}

export interface NotifyDecision {
  threshold: boolean;
  summary: boolean;
}

/**
 * Grouped notifications: never one per answer. A summary goes out at most every
 * 30 minutes and only if there are new "sì"; reaching the number of players
 * triggers a single "Si gioca!" (which also counts as the summary).
 */
export function decideProposalNotifications(
  s: ProposalNotifyState,
  now: Date = new Date(),
): NotifyDecision {
  const needed = neededPlayers(s.format);
  if (!s.thresholdNotified && s.yesNames.length >= needed)
    return { threshold: true, summary: false };
  if (s.pendingYes <= 0) return { threshold: false, summary: false };
  const last = s.lastSummaryAt ? new Date(s.lastSummaryAt).getTime() : 0;
  const due = now.getTime() - last >= SUMMARY_INTERVAL_MIN * 60_000;
  return { threshold: false, summary: due };
}

export function summaryText(yesNames: string[], dayLabel: string): string {
  if (!yesNames.length) return "";
  if (yesNames.length === 1)
    return `${yesNames[0]} c'è ${dayLabel}, vieni anche tu?`;
  if (yesNames.length === 2)
    return `${yesNames[0]} e ${yesNames[1]} ci sono ${dayLabel}, vieni anche tu?`;
  const others = yesNames.length - 2;
  return `${yesNames[0]}, ${yesNames[1]} e ${others === 1 ? "un altro" : `altri ${others}`} ci sono ${dayLabel}, vieni anche tu?`;
}

export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const diff = Math.round((day - today) / 86_400_000);
  const time = d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
  if (diff === 0) return `oggi alle ${time}`;
  if (diff === 1) return `domani alle ${time}`;
  const wd = d.toLocaleDateString("it-IT", {
    weekday: "long",
    timeZone: "Europe/Rome",
  });
  if (diff > 1 && diff < 7) return `${wd} alle ${time}`;
  const date = d.toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: "Europe/Rome",
  });
  return `${wd} ${date} alle ${time}`;
}
