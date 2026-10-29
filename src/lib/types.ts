export type Format = "1v1" | "2v2" | "3v3" | "4v4";
export const FORMATS: Format[] = ["1v1", "2v2", "3v3", "4v4"];
export const TEAM_SIZE: Record<Format, number> = { "1v1": 1, "2v2": 2, "3v3": 3, "4v4": 4 };

export type Team = "A" | "B";
export type StatsSource = "solo_risultato" | "tabellino" | "video" | "importata";

export type NotifyKind =
  | "proposte"
  | "riepiloghi"
  | "completa"
  | "annullate"
  | "promemoria"
  | "partite"
  | "mvp"
  | "badge"
  | "record";
/** Un interruttore per ogni tipo di notifica, più il silenzio di notte (23–8). */
export type NotifyPrefs = Record<NotifyKind, boolean> & { notte: boolean };
export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = {
  proposte: true,
  riepiloghi: true,
  completa: true,
  annullate: true,
  promemoria: true,
  partite: true,
  mvp: true,
  badge: true,
  record: true,
  notte: true,
};

/** Le notifiche che si possono scegliere, raggruppate come nelle impostazioni. */
export const NOTIFY_GROUPS: { title: string; items: { kind: NotifyKind; label: string; hint: string }[] }[] = [
  {
    title: "Organizzare",
    items: [
      { kind: "proposte", label: "Nuove proposte", hint: "Quando qualcuno propone di giocare" },
      { kind: "riepiloghi", label: "Chi viene", hint: "Chi ha detto ci sono, a gruppi per non disturbarti" },
      { kind: "completa", label: "Squadre al completo", hint: "Quando si arriva al numero giusto per giocare" },
      { kind: "promemoria", label: "Promemoria", hint: "Un'ora prima della partita a cui hai detto ci sono" },
      { kind: "annullate", label: "Partite annullate", hint: "Se salta una partita a cui avevi risposto" },
    ],
  },
  {
    title: "Risultati e premi",
    items: [
      { kind: "partite", label: "Partite registrate", hint: "Il risultato delle partite in cui hai giocato" },
      { kind: "mvp", label: "MVP del mese", hint: "Quando cambia chi porta la corona" },
      { kind: "badge", label: "Badge e figurine", hint: "Quando sblocchi un badge o una figurina nuova" },
      { kind: "record", label: "Record del gruppo", hint: "Quando qualcuno batte un record" },
    ],
  },
];

export interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  roles: string[];
  jerseyNumber: number | null;
  cardColor: string | null;
  avatarUrl: string | null;
  userId: string | null;
  isAdmin: boolean;
  showcase: string[];
  notifyPrefs: NotifyPrefs;
  archived: boolean;
  createdAt: string;
}

export const BOX_KEYS = [
  "pts",
  "fg2m",
  "fg2a",
  "fg3m",
  "fg3a",
  "oreb",
  "dreb",
  "ast",
  "stl",
  "blk",
  "tov",
  "fouls",
] as const;
export type BoxKey = (typeof BOX_KEYS)[number];
export type Box = Record<BoxKey, number>;

export const emptyBox = (): Box => ({
  pts: 0,
  fg2m: 0,
  fg2a: 0,
  fg3m: 0,
  fg3a: 0,
  oreb: 0,
  dreb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  fouls: 0,
});

export interface MatchPlayer {
  matchId: string;
  playerId: string;
  team: Team;
  hasStats: boolean;
  box: Box;
}

export type EventKind =
  | "2pt"
  | "3pt"
  | "miss2"
  | "miss3"
  | "oreb"
  | "dreb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "foul";

export interface MatchEvent {
  id: string;
  matchId: string;
  playerId: string;
  kind: EventKind;
  /** For an assist: the player who scored. */
  targetPlayerId: string | null;
  videoTs: number | null;
  seq: number;
}

export interface Match {
  id: string;
  playedAt: string;
  format: Format;
  targetPoints: number;
  scoreA: number;
  scoreB: number;
  statsSource: StatsSource;
  confirmedBy: string | null;
  confirmedAt: string | null;
  createdBy: string | null;
  notes: string | null;
  createdAt: string;
  players: MatchPlayer[];
  events: MatchEvent[];
}

export type ResponseKind = "si" | "forse" | "no";

export interface Proposal {
  id: string;
  startsAt: string;
  format: Format | null;
  note: string | null;
  createdBy: string;
  status: "aperta" | "annullata";
  createdAt: string;
  responses: { playerId: string; response: ResponseKind; updatedAt: string }[];
}

export interface Dataset {
  players: Player[];
  matches: Match[];
  proposals: Proposal[];
}

export function playerName(p: Pick<Player, "firstName" | "lastName"> | undefined | null): string {
  if (!p) return "—";
  return p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
}

export function shortName(
  p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null,
  all?: Pick<Player, "firstName" | "lastName">[],
): string {
  if (!p) return "—";
  if (p.nickname) return p.nickname;
  const sameFirst = all?.filter((o) => o.firstName === p.firstName).length ?? 1;
  if (sameFirst > 1 && p.lastName) return `${p.firstName} ${p.lastName[0]}.`;
  return p.firstName;
}

/** Il nome che il giocatore ha scelto per l'app; in mancanza, quello vero. */
export function displayName(p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null): string {
  if (!p) return "—";
  return p.nickname?.trim() || playerName(p);
}

/** Per l'amministratore: nome nell'app e, accanto, quello vero. */
export function adminName(p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null): string {
  if (!p) return "—";
  const real = playerName(p);
  return p.nickname && p.nickname.trim().toLowerCase() !== real.toLowerCase() ? `${p.nickname} (${real})` : real;
}

export const NAME_MIN = 2;
export const NAME_MAX = 16;

/** Controlla il nome scelto: lunghezza e nessun doppione nel gruppo. Restituisce l'errore o null. */
export function nameError(name: string, players: Pick<Player, "id" | "nickname">[], meId: string): string | null {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < NAME_MIN) return `Mi servono almeno ${NAME_MIN} lettere`;
  if (n.length > NAME_MAX) return `Massimo ${NAME_MAX} caratteri`;
  if (players.some((p) => p.id !== meId && p.nickname?.trim().toLowerCase() === n.toLowerCase())) return "Questo nome ce l'ha già qualcuno: provane un altro";
  return null;
}

export function initials(p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null): string {
  if (!p) return "?";
  const nick = p.nickname?.trim();
  if (nick) {
    const parts = nick.split(/\s+/);
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : nick.slice(0, 2)).toUpperCase();
  }
  return (p.firstName[0] + (p.lastName?.[0] ?? p.firstName[1] ?? "")).toUpperCase();
}

export function winnerOf(m: Pick<Match, "scoreA" | "scoreB">): Team | null {
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "A" : "B";
}
