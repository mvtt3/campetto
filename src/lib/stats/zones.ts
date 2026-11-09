import type { Match } from "../types";
import { normalizeBox } from "./player";

export type ZoneKey = "sotto" | "media" | "tre";

export interface ZoneLine {
  made: number;
  att: number;
}

export interface ShotZones {
  sotto: ZoneLine;
  media: ZoneLine;
  tre: ZoneLine;
  /** Tiri da 2 di partite in cui non si sa da dove (non entrano in sotto/media). */
  unknown2: number;
}

const zero = (): ZoneLine => ({ made: 0, att: 0 });

/** I tiri di un giocatore divisi per zona del campo, sulle partite con il tabellino. */
export function shotZones(playerId: string, matches: Match[]): ShotZones {
  const z: ShotZones = {
    sotto: zero(),
    media: zero(),
    tre: zero(),
    unknown2: 0,
  };
  for (const m of matches) {
    const line = m.players.find((p) => p.playerId === playerId && p.hasStats);
    if (!line) continue;
    const b = normalizeBox(line.box);
    z.tre.made += b.fg3m;
    z.tre.att += b.fg3a;
    if (b.fgra === null || b.fgra === undefined) {
      z.unknown2 += b.fg2a;
      continue;
    }
    const rimM = Math.min(b.fgrm ?? 0, b.fg2m);
    const rimA = Math.min(b.fgra, b.fg2a);
    z.sotto.made += rimM;
    z.sotto.att += rimA;
    z.media.made += b.fg2m - rimM;
    z.media.att += b.fg2a - rimA;
  }
  return z;
}

/** La media del gruppo per zona: tutti i tiri di tutti, nel periodo. */
export function groupZones(matches: Match[]): Record<ZoneKey, ZoneLine> {
  const g = { sotto: zero(), media: zero(), tre: zero() };
  const ids = new Set(matches.flatMap((m) => m.players.map((p) => p.playerId)));
  for (const id of ids) {
    const z = shotZones(id, matches);
    for (const k of ["sotto", "media", "tre"] as const) {
      g[k].made += z[k].made;
      g[k].att += z[k].att;
    }
  }
  return g;
}

/** Sotto questi tiri una zona non ha ancora un livello: troppo pochi per dire qualcosa. */
export const ZONE_MIN_ATT = 3;

/**
 * Il livello di una zona, come i badge: bronzo, argento, oro, Hall of Fame (dal 90%).
 * 0 = pochi tiri per giudicare.
 */
export function zoneTier(z: ZoneLine): 0 | 1 | 2 | 3 | 4 {
  if (z.att < ZONE_MIN_ATT) return 0;
  const p = z.made / z.att;
  if (p >= 0.9) return 4;
  if (p >= 0.6) return 3;
  if (p >= 0.4) return 2;
  return 1;
}

/** Il colore della percentuale: rosso sotto il 20%, giallo sotto il 50%, verde dal 50%. */
export function pctTone(p: number | null): "bad" | "mid" | "good" | "none" {
  if (p === null) return "none";
  if (p < 0.2) return "bad";
  if (p < 0.5) return "mid";
  return "good";
}

export interface AssistSplit {
  /** Canestri segnati su assist / da solo, nelle partite con la cronaca. */
  assisted: number;
  alone: number;
  /** Chi gli passa più palloni buoni: id e quante volte. */
  bestPasser: { id: string; n: number } | null;
  /** A chi passa di più. */
  bestTarget: { id: string; n: number } | null;
}

/** Dalla cronaca azione per azione: canestri assistiti o da solo, e le coppie che si cercano. */
export function assistSplit(
  playerId: string,
  matches: Match[],
): AssistSplit | null {
  let assisted = 0;
  let alone = 0;
  let seen = false;
  const from = new Map<string, number>();
  const to = new Map<string, number>();
  for (const m of matches) {
    const ev = m.events ?? [];
    if (!ev.length || !m.players.some((p) => p.playerId === playerId)) continue;
    seen = true;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.kind === "ast" && e.targetPlayerId === playerId)
        from.set(e.playerId, (from.get(e.playerId) ?? 0) + 1);
      if (e.kind === "ast" && e.playerId === playerId && e.targetPlayerId)
        to.set(e.targetPlayerId, (to.get(e.targetPlayerId) ?? 0) + 1);
      if ((e.kind === "2pt" || e.kind === "3pt") && e.playerId === playerId) {
        const next = ev[i + 1];
        if (next && next.kind === "ast" && next.targetPlayerId === playerId)
          assisted++;
        else alone++;
      }
    }
  }
  if (!seen) return null;
  const top = (m: Map<string, number>) => {
    let best: { id: string; n: number } | null = null;
    for (const [id, n] of m) if (!best || n > best.n) best = { id, n };
    return best;
  };
  return { assisted, alone, bestPasser: top(from), bestTarget: top(to) };
}
