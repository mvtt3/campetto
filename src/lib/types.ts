import { isOffensive } from "./nickname-filter";

export type Format = "1v1" | "2v2" | "3v3" | "4v4";
export const FORMATS: Format[] = ["1v1", "2v2", "3v3", "4v4"];
export const TEAM_SIZE: Record<Format, number> = {
  "1v1": 1,
  "2v2": 2,
  "3v3": 3,
  "4v4": 4,
};

/** Quanti cambi può avere una squadra: si gioca nel formato, ma chi è in più entra a rotazione. */
export const MAX_SUBS = 2;

/** Quanti giocatori al massimo per squadra, cambi compresi (nell'1 contro 1 niente cambi). */
export function maxPerTeam(f: Format): number {
  return TEAM_SIZE[f] + (f === "1v1" ? 0 : MAX_SUBS);
}

/**
 * Chi è un cambio: nell'ordine in cui sono stati messi in squadra, quelli oltre
 * il formato (nel 2 contro 2 il terzo della squadra).
 */
export function withSubs<T extends { team: Team }>(
  format: Format,
  lines: T[],
): (T & { sub: boolean })[] {
  const seen = { A: 0, B: 0 };
  return lines.map((l) => ({ ...l, sub: ++seen[l.team] > TEAM_SIZE[format] }));
}

export type Team = "A" | "B";
export type StatsSource =
  "solo_risultato" | "tabellino" | "video" | "importata";

export type NotifyKind =
  | "proposte"
  | "riepiloghi"
  | "completa"
  | "annullate"
  | "promemoria"
  | "partite"
  | "mvp"
  | "badge"
  | "record"
  | "ritorno"
  | "primati"
  | "notizie"
  | "adesioni"
  | "commenti";
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
  ritorno: true,
  primati: true,
  notizie: true,
  adesioni: true,
  commenti: true,
  notte: true,
};

/** Le notifiche che si possono scegliere, raggruppate come nelle impostazioni. */
export const NOTIFY_GROUPS: {
  title: string;
  items: { kind: NotifyKind; label: string; hint: string }[];
}[] = [
  {
    title: "Organizzare",
    items: [
      {
        kind: "proposte",
        label: "Nuove proposte",
        hint: "Quando qualcuno propone di giocare",
      },
      {
        kind: "riepiloghi",
        label: "Chi viene",
        hint: "Chi ha detto che c'è, raggruppati per non disturbarti",
      },
      {
        kind: "completa",
        label: "Squadre al completo",
        hint: "Quando si arriva al numero giusto per giocare",
      },
      {
        kind: "promemoria",
        label: "Promemoria",
        hint: "Un'ora prima della partita, se hai detto che ci sei",
      },
      {
        kind: "adesioni",
        label: "Chi si unisce",
        hint: "Chi dice che c'è a una partita tua o a cui vai anche tu, e chi propone un altro orario",
      },
      {
        kind: "annullate",
        label: "Partite spostate o annullate",
        hint: "Se cambia o salta una partita a cui avevi risposto",
      },
      {
        kind: "ritorno",
        label: "Torna a giocare",
        hint: "Se non apri l'app da 6 giorni, al massimo una volta a settimana",
      },
    ],
  },
  {
    title: "Risultati e premi",
    items: [
      {
        kind: "partite",
        label: "Partite registrate",
        hint: "Il risultato delle partite in cui hai giocato",
      },
      {
        kind: "mvp",
        label: "MVP del mese",
        hint: "Quando cambia chi porta la corona",
      },
      {
        kind: "badge",
        label: "Badge e figurine",
        hint: "Quando sblocchi un badge o una figurina nuova",
      },
      {
        kind: "record",
        label: "Record del gruppo",
        hint: "Quando qualcuno batte un record",
      },
      {
        kind: "primati",
        label: "Migliori del mese",
        hint: "Quando sei il migliore del mese in punti, rimbalzi, assist e non solo",
      },
      {
        kind: "notizie",
        label: "Notizie",
        hint: "Quando nelle notizie arriva un annuncio nuovo",
      },
      {
        kind: "commenti",
        label: "Risposte ai commenti",
        hint: "Quando qualcuno risponde a un tuo commento sugli highlights",
      },
    ],
  },
];

export interface Player {
  id: string;
  firstName: string;
  lastName: string | null;
  nickname: string | null;
  /** Quando ha cambiato nome l'ultima volta (dopo il primo): da lì 14 giorni prima del prossimo. */
  nicknameChangedAt?: string | null;
  roles: string[];
  jerseyNumber: number | null;
  cardColor: string | null;
  avatarUrl: string | null;
  /** Il personaggio a figura intera scelto (id di una figurina), null = quello di base. */
  character: string | null;
  userId: string | null;
  isAdmin: boolean;
  showcase: string[];
  notifyPrefs: NotifyPrefs;
  archived: boolean;
  createdAt: string;
  /** Ospite di una partita (uno trovato al campetto): gioca, ma non conta per il gruppo. */
  guest?: boolean;
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
/**
 * fgrm/fgra: i tiri da 2 presi da sotto (segnati/tentati); quelli dalla media sono il resto
 * dei tiri da 2. null quando non si sa da dove (partite vecchie, importate o dal video).
 */
export type Box = Record<BoxKey, number> & {
  fgrm?: number | null;
  fgra?: number | null;
};

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
  /** Entrato a rotazione: la squadra gioca nel formato, lui fa il cambio. */
  sub?: boolean;
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
  /**
   * Gli ospiti della partita: si vedono nel tabellino, ma restano fuori da statistiche,
   * classifiche, MVP, record e badge (in `players` ci sono solo quelli del gruppo).
   */
  guests?: MatchPlayer[];
}

export type ResponseKind = "si" | "forse" | "no";

/** I due campetti dove si gioca: conta solo per organizzarsi, non per le statistiche. */
export type Place = "niche" | "decathlon";
export const PLACES: { value: Place; label: string; hint: string }[] = [
  { value: "niche", label: "Niche", hint: "Nichelino" },
  { value: "decathlon", label: "Decathlon", hint: "Il campetto del Decathlon" },
];
export const placeLabel = (p: Place | null | undefined): string =>
  PLACES.find((x) => x.value === p)?.label ?? "";

export interface ProposalResponse {
  playerId: string;
  response: ResponseKind;
  updatedAt: string;
  /** Controproposta di chi ha detto sì: stesso giorno, un altro orario e/o un altro campetto. */
  altStartsAt?: string | null;
  altPlace?: Place | null;
}

export interface Proposal {
  id: string;
  startsAt: string;
  format: Format | null;
  note: string | null;
  place?: Place | null;
  createdBy: string;
  status: "aperta" | "annullata";
  createdAt: string;
  responses: ProposalResponse[];
}

export interface Dataset {
  players: Player[];
  /** Gli ospiti delle partite: servono solo per i nomi nel tabellino. */
  guests?: Player[];
  matches: Match[];
  proposals: Proposal[];
  /** Le notizie scritte a mano (annunci); quelle dalle partite si calcolano nell'app. */
  news?: NewsPost[];
  /** I video coi canestri delle partite (per ora li vede solo l'amministratore). */
  highlights?: Highlight[];
}

/** Un canestro dentro il montaggio: da che secondo parte e com'è. */
export interface HighlightClip {
  t: number;
  punti: 2 | 3;
  come: string;
  descrizione: string;
}

/** Il video coi canestri di una partita. Like e commenti arrivano a parte, solo quando si guarda. */
export interface Highlight {
  id: string;
  matchId: string;
  videoUrl: string;
  posterUrl: string | null;
  duration: number;
  description: string | null;
  clips: HighlightClip[];
  createdAt: string;
}

export interface HighlightComment {
  id: string;
  highlightId: string;
  playerId: string;
  body: string;
  createdAt: string;
  /** Il commento a cui risponde (come su WhatsApp), se c'è. */
  replyTo?: string | null;
}

/** Like e commenti degli highlights: si caricano all'apertura e si aggiornano in diretta. */
export interface HighlightSocial {
  likes: { highlightId: string; playerId: string }[];
  comments: HighlightComment[];
}

export const COMMENT_MAX = 280;

export interface NewsPost {
  id: string;
  title: string;
  body: string;
  kind: "annuncio" | "stagione" | "novita";
  createdAt: string;
}

/** Il profilo di un giocatore: una pagina sola per tutti, già pronta sul telefono. */
export function playerHref(id: string, preview = false): string {
  return `/giocatore?id=${encodeURIComponent(id)}${preview ? "&anteprima=1" : ""}`;
}

export function playerName(
  p: Pick<Player, "firstName" | "lastName"> | undefined | null,
): string {
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
export function displayName(
  p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null,
): string {
  if (!p) return "—";
  return p.nickname?.trim() || playerName(p);
}

/** Per l'amministratore: nome nell'app e, accanto, quello vero. */
export function adminName(
  p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null,
): string {
  if (!p) return "—";
  const real = playerName(p);
  return p.nickname && p.nickname.trim().toLowerCase() !== real.toLowerCase()
    ? `${p.nickname} (${real})`
    : real;
}

/** Ogni quanto si può cambiare il nome nell'app (il primo, all'accesso, è libero). */
export const NAME_COOLDOWN_DAYS = 14;

/** Da quando si può cambiare di nuovo il nome; null se si può già. */
export function nameUnlockDate(
  p: Pick<Player, "nicknameChangedAt">,
  now = new Date(),
): Date | null {
  if (!p.nicknameChangedAt) return null;
  const at = new Date(
    new Date(p.nicknameChangedAt).getTime() + NAME_COOLDOWN_DAYS * 86_400_000,
  );
  return at > now ? at : null;
}

export const NAME_MIN = 2;
export const NAME_MAX = 16;

/** Controlla il nome scelto: lunghezza e nessun doppione nel gruppo. Restituisce l'errore o null. */
export function nameError(
  name: string,
  players: Pick<Player, "id" | "nickname">[],
  meId: string,
): string | null {
  const n = name.trim().replace(/\s+/g, " ");
  if (n.length < NAME_MIN) return `Mi servono almeno ${NAME_MIN} lettere`;
  if (n.length > NAME_MAX) return `Massimo ${NAME_MAX} caratteri`;
  if (isOffensive(n)) return OFFENSIVE_NAME;
  if (
    players.some(
      (p) =>
        p.id !== meId && p.nickname?.trim().toLowerCase() === n.toLowerCase(),
    )
  )
    return "Questo nome ce l'ha già qualcuno: provane un altro";
  return null;
}

/** Il messaggio per un soprannome che può offendere: gentile, senza ripetere la parola. */
export const OFFENSIVE_NAME =
  "Questo nome non lo posso usare: potrebbe offendere qualcuno";

export function initials(
  p: Pick<Player, "firstName" | "lastName" | "nickname"> | undefined | null,
): string {
  if (!p) return "?";
  const nick = p.nickname?.trim();
  if (nick) {
    const parts = nick.split(/\s+/);
    return (
      parts.length > 1 ? parts[0][0] + parts[1][0] : nick.slice(0, 2)
    ).toUpperCase();
  }
  return (
    p.firstName[0] + (p.lastName?.[0] ?? p.firstName[1] ?? "")
  ).toUpperCase();
}

export function winnerOf(m: Pick<Match, "scoreA" | "scoreB">): Team | null {
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "A" : "B";
}
