import { placeLabel, type Place, type Proposal } from "./types";

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

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** "Alle 19:00 al Niche", "Alle 19:00" o "Al Decathlon": solo quello che cambia. */
export function altLabel(p: Proposal, g: Pick<AltGroup, "startsAt" | "place">) {
  const timeChanged =
    new Date(g.startsAt).getTime() !== new Date(p.startsAt).getTime();
  const placeChanged = (g.place ?? null) !== (p.place ?? null) && !!g.place;
  if (timeChanged && placeChanged)
    return `Alle ${hhmm(g.startsAt)} al ${placeLabel(g.place)}`;
  if (timeChanged) return `Alle ${hhmm(g.startsAt)}`;
  return `Al ${placeLabel(g.place)}`;
}

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
