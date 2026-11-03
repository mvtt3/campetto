/**
 * Campetto Star: il gioco dentro l'app. Qui solo i tipi: lo stato del salvataggio,
 * le partite, i messaggi del telefono. Tutto il salvataggio è un unico oggetto JSON
 * (si tiene nel telefono e nel database, e si riprende da dove eri).
 */

export type Level = "campetto" | "b" | "a";
export type Difficulty = "facile" | "normale" | "difficile";
export type Skill = "tiro" | "passaggio" | "difesa" | "fisico";
export type Slot = "testa" | "occhi" | "orecchie" | "collo" | "polso" | "maglia" | "scarpe";

/** Cosa indossa il personaggio: per ogni parte, l'id di un oggetto del catalogo. */
export type Outfit = Partial<Record<Slot, string>>;

export interface Contract {
  team: string;
  level: Level;
  /** Euro lordi a settimana. */
  salary: number;
  /** Lo sponsor personale, in euro a settimana (dalla Serie B). */
  sponsor?: number;
}

export interface Offer extends Contract {
  id: string;
  /** Una riga dell'agente o della squadra. */
  note: string;
  promotion: boolean;
}

export interface BankTx {
  day: number;
  label: string;
  amount: number;
}

export type Tone = "dolce" | "sbruffone" | "sincero" | "freddo";

export interface ChatMsg {
  from: "them" | "me";
  text: string;
  day: number;
}

export type Role = "mamma" | "ragazza" | "coach" | "amico" | "socio" | "agente" | "ex" | "nuova";

export interface Contact {
  id: string;
  name: string;
  role: Role;
  /** Rapporto da -100 a 100. */
  rel: number;
  /** Come ti hanno trattato e come li hai trattati: sposta il carattere. */
  tones: Partial<Record<Tone, number>>;
  thread: ChatMsg[];
  unread: number;
  /** Il messaggio che aspetta una tua risposta (id dell'evento), e da quale giorno. */
  pending: { event: string; since: number; data?: Record<string, string | number> } | null;
}

export interface SeasonMatch {
  /** Giorno della settimana di gioco in cui si gioca. */
  day: number;
  opponent: string;
  home: boolean;
  /** Dopo la partita. */
  result?: {
    us: number;
    them: number;
    rating: number;
    pts: number;
    ast: number;
    reb: number;
    stl: number;
    blk: number;
    simulated: boolean;
    benched: boolean;
  };
}

export interface GameState {
  v: 1;
  createdAt: string;
  updatedAt: string;
  /** Giorno di gioco, da 1. */
  day: number;
  contract: Contract;
  season: { n: number; matches: SeasonMatch[] };
  /** A fine stagione: le offerte da scegliere (l'app Contratti). */
  offers: Offer[];
  money: number;
  energy: number;
  happiness: number;
  fame: number;
  skills: Record<Skill, number>;
  /** Punti esperienza verso il prossimo +1, per abilità. */
  xp: Record<Skill, number>;
  owned: string[];
  outfit: Outfit;
  contacts: Contact[];
  bank: BankTx[];
  /** Cosa hai fatto ieri (per le reazioni: serata prima della partita…). */
  yesterday: string | null;
  /** Hai detto sì a una serata dopo aver scelto cosa fare oggi: domani conta come "serata". */
  tonight: string | null;
  /** Giorno in cui si è rimasti senza ragazza (per la prossima). */
  singleSince: number | null;
  /** Le notifiche del telefono ancora da vedere (banca, contratti). */
  badges: { banca: number; contratti: number };
  /** Gettoni delle sfide: quanti e da quando si ricaricano. */
  tokens: number;
  tokensAt: string;
  /** Partite vere già premiate (per i gettoni e i bonus dalla vita vera). */
  realSeen: string[];
  daily: { last: string | null; streak: number };
  /** step: 0 benvenuto, 1 tiro di prova, 2 messaggio di mamma, 3 scarpe, 4 finito. */
  tutorial: { step: number; seen: string[] };
  /** Personal trainer, agente: le cose prese una volta. */
  perks: { trainer: boolean; agent: boolean };
  /** Eventi già successi una volta sola. */
  once: string[];
  /** L'ultimo giorno in cui è arrivato ogni messaggio (per non ripeterli troppo spesso). */
  sent: Record<string, number>;
  /** Statistiche di carriera. */
  career: {
    games: number;
    wins: number;
    pts: number;
    ast: number;
    reb: number;
    stl: number;
    blk: number;
    best: number;
  };
}

/** Un momento chiave della partita. */
export type Moment =
  | {
      kind: "attacco";
      /** Da dove: sotto, media o tripla. */
      shot: "sotto" | "media" | "tripla";
      /** Marcato stretto o libero. */
      open: boolean;
      /** Il minuto o il punto della partita, per la cronaca. */
      clock: string;
    }
  | { kind: "difesa"; action: "rubata" | "stoppata"; clock: string };

export type ShotOutcome = "verde" | "buono" | "fuori";

export const MINIGAMES = ["triple", "liberi", "schiacciate"] as const;
export type MiniGame = (typeof MINIGAMES)[number];

export interface BoardRow {
  game: MiniGame;
  playerId: string;
  best: number;
  at: string;
}

export interface GameAward {
  day: string;
  game: MiniGame;
  score: number;
}
