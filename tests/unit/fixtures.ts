import { emptyBox, DEFAULT_NOTIFY_PREFS, type Box, type Format, type Match, type MatchEvent, type Player, type Team } from "@/lib/types";

let counter = 0;
export const uid = (p = "id") => `${p}-${++counter}`;

export function player(id: string, firstName: string, lastName: string | null = null): Player {
  return {
    id,
    firstName,
    lastName,
    nickname: null,
    roles: [],
    jerseyNumber: null,
    cardColor: null,
    avatarUrl: null,
    userId: null,
    isAdmin: false,
    showcase: [],
    notifyPrefs: DEFAULT_NOTIFY_PREFS,
    archived: false,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

export function box(partial: Partial<Box>): Box {
  return { ...emptyBox(), ...partial };
}

export interface LineSpec {
  id: string;
  team: Team;
  box?: Partial<Box>;
}

export function match(opts: {
  id?: string;
  date: string;
  format?: Format;
  a: number;
  b: number;
  lines: LineSpec[];
  events?: Omit<MatchEvent, "id" | "matchId" | "seq">[];
}): Match {
  const id = opts.id ?? uid("m");
  return {
    id,
    playedAt: opts.date,
    format: opts.format ?? "2v2",
    targetPoints: 21,
    scoreA: opts.a,
    scoreB: opts.b,
    statsSource: opts.lines.some((l) => l.box) ? "tabellino" : "solo_risultato",
    confirmedBy: null,
    confirmedAt: null,
    createdBy: null,
    notes: null,
    createdAt: opts.date,
    players: opts.lines.map((l) => ({
      matchId: id,
      playerId: l.id,
      team: l.team,
      hasStats: Boolean(l.box),
      box: box(l.box ?? {}),
    })),
    events: (opts.events ?? []).map((e, i) => ({ ...e, id: uid("e"), matchId: id, seq: i })),
  };
}

/** 1v1 between x (team A) and y (team B). */
export function duel(date: string, x: string, y: string, a: number, b: number, boxes?: [Partial<Box>, Partial<Box>]): Match {
  return match({
    date,
    format: "1v1",
    a,
    b,
    lines: [
      { id: x, team: "A", box: boxes?.[0] },
      { id: y, team: "B", box: boxes?.[1] },
    ],
  });
}
