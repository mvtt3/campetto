import { type Place, type Proposal } from "./types";

/** Una controproposta e chi la preferisce: stesso orario e stesso campetto stanno insieme. */
export interface AltGroup {
  key: string;
  startsAt: string;
  place: Place | null;
  playerIds: string[];
}

export function altKey(startsAt: string, place: Place | null): string {
  return `${new Date(startsAt).getTime()}|${place ?? ""}`;
}

/** Le controproposte di una partita, dalla più seguita. Solo da chi ha detto "ci sono". */
export function alternativesOf(p: Proposal): AltGroup[] {
  const groups = new Map<string, AltGroup>();
  const base = altKey(p.startsAt, p.place ?? null);
  for (const r of p.responses) {
    if (r.response !== "si" || (!r.altStartsAt && !r.altPlace)) continue;
    const startsAt = r.altStartsAt ?? p.startsAt;
    const place = r.altPlace ?? p.place ?? null;
    const key = altKey(startsAt, place);
    if (key === base) continue;
    const g = groups.get(key) ?? { key, startsAt, place, playerIds: [] };
    g.playerIds.push(r.playerId);
    groups.set(key, g);
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.playerIds.length - a.playerIds.length ||
      a.startsAt.localeCompare(b.startsAt),
  );
}

export const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Davide", "Davide e Simone", "Davide, Simone e Luca", "Davide, Simone e altri 3". */
export function namesList(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length <= max)
    return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  const rest = names.length - (max - 1);
  return `${names.slice(0, max - 1).join(", ")} e altri ${rest}`;
}

/** Con almeno 4 "ci sono" e nessuno che si tira indietro fino a 12 ore prima, si gioca. */
export const CONFIRM_MIN = 4;
export const CONFIRM_HOURS = 12;
/** Quanto si considera "in corso" una partita confermata, dall'ora d'inizio. */
export const LIVE_HOURS = 2;

export type ProposalPhase = "open" | "confirmed" | "live" | "over";

/**
 * A che punto è una proposta: aperta (si raccolgono i sì), confermata (al completo, oppure
 * almeno 4 a meno di 12 ore dall'inizio), in corso (confermata e già iniziata), finita.
 */
export function proposalPhase(
  p: Proposal,
  now: Date,
  needed: number,
): ProposalPhase {
  const start = new Date(p.startsAt).getTime();
  const t = now.getTime();
  const yes = p.responses.filter((r) => r.response === "si").length;
  const confirmed =
    yes >= needed ||
    (yes >= Math.min(CONFIRM_MIN, needed) &&
      start - t <= CONFIRM_HOURS * 3_600_000);
  if (t >= start + LIVE_HOURS * 3_600_000) return "over";
  if (t >= start) return confirmed ? "live" : "over";
  return confirmed ? "confirmed" : "open";
}

/**
 * La partita confermata appena finita di cui manca ancora il risultato: dalla fine (2 ore
 * dopo l'inizio) fino a 18 ore dopo, finché non viene inserita una partita da quell'ora in poi.
 */
export function awaitingStats(
  proposals: Proposal[],
  matches: { playedAt: string }[],
  now: Date,
  neededOf: (p: Proposal) => number,
): Proposal | null {
  const t = now.getTime();
  const done = proposals
    .filter((p) => {
      if (p.status !== "aperta") return false;
      const start = new Date(p.startsAt).getTime();
      if (t < start + LIVE_HOURS * 3_600_000 || t >= start + 18 * 3_600_000)
        return false;
      const yes = p.responses.filter((r) => r.response === "si").length;
      if (yes < Math.min(CONFIRM_MIN, neededOf(p))) return false;
      return !matches.some(
        (m) => new Date(m.playedAt).getTime() >= start - 3_600_000,
      );
    })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return done[0] ?? null;
}

/** Fin quando si vede una partita saltata per pioggia: tutto quel giorno e la notte fino alle 2. */
export const RAINED_OUT_UNTIL_HOUR = 2;

/** Se una partita annullata per il meteo va ancora mostrata (Home e calendario). */
export function rainedOutVisible(p: Proposal, now: Date): boolean {
  if (p.status !== "annullata" || p.cancelReason !== "meteo") return false;
  const d = new Date(p.startsAt);
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const until = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + 1,
    RAINED_OUT_UNTIL_HOUR,
  );
  return now >= from && now < until;
}

/**
 * La partita di oggi annullata per il meteo: resta in Home e nel calendario fino alle 2 di
 * notte come "stop per pioggia", così chi apre l'app non la cerca in campo.
 */
export function rainedOutToday(proposals: Proposal[], now: Date): Proposal | null {
  return (
    proposals
      .filter((p) => rainedOutVisible(p, now))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0] ?? null
  );
}
