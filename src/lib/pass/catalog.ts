/**
 * Il Pass Campetto: oggetti da indossare, la season e i suoi 30 livelli.
 * Tutto quello che si vede nel camerino, nel pass e nel tiro del giorno nasce da qui.
 */

export type Slot =
  | "skin"
  | "testa"
  | "viso"
  | "gioielli"
  | "busto"
  | "braccio"
  | "gambe"
  | "piedi"
  | "pallone";

export type Rarity = "comune" | "raro" | "epico" | "leggendario";

export const RARITIES: Rarity[] = ["comune", "raro", "epico", "leggendario"];

export const RARITY_LABEL: Record<Rarity, string> = {
  comune: "Comune",
  raro: "Raro",
  epico: "Epico",
  leggendario: "Leggendario",
};

/** I colori delle rarità: gli stessi dei personaggi da sbloccare. */
export const RARITY_COLOR: Record<Rarity, string> = {
  comune: "#8f9bab",
  raro: "#3d8bff",
  epico: "#a259ff",
  leggendario: "#ffb020",
};

/** Il prezzo in Spicchi alla bancarella: un pacchetto compra esattamente un oggetto. */
export const PRICE: Record<Rarity, number> = {
  comune: 200,
  raro: 400,
  epico: 800,
  leggendario: 1000,
};

export const SLOTS: { id: Slot; label: string }[] = [
  { id: "skin", label: "Personaggio" },
  { id: "testa", label: "Testa" },
  { id: "viso", label: "Viso" },
  { id: "gioielli", label: "Gioielli" },
  { id: "busto", label: "Busto" },
  { id: "braccio", label: "Braccio" },
  { id: "gambe", label: "Gambe" },
  { id: "piedi", label: "Scarpe" },
  { id: "pallone", label: "Pallone" },
];

/** Come appare un oggetto in 3D: il disegno lo fa il camerino, qui solo i parametri. */
export type Look =
  | { kind: "skin"; preset: "jack" | "kenji" | "bomber" }
  | { kind: "cap"; color: string; visor: string }
  | { kind: "santa" }
  | { kind: "shades"; lens: string; frame: string }
  | { kind: "goggles"; band: string }
  | { kind: "chain"; pendant: "star" | "ball" }
  | { kind: "earring" }
  | { kind: "hoodie"; color: string; trim: string }
  | { kind: "sweater" }
  | { kind: "armband"; color: string }
  | { kind: "sleeve"; stripes: [string, string] }
  | { kind: "shorts"; color: string; trim: string; pattern?: "renna" }
  | { kind: "shoes"; upper: string; sole: string; laces: string }
  | { kind: "ball"; texture: "classico" | "notte" | "neve" | "oro" };

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  look: Look;
  /** Della season di Natale: si vede col fiocco di neve. */
  natale?: boolean;
  /** Si trova solo nel pass, ai livelli cardine: poi non torna più. */
  esclusivo?: boolean;
  blurb: string;
}

export const ITEMS: Item[] = [
  // Personaggi (le "skin"): i tre già pronti in 3D.
  { id: "skin-jack", name: "Jack", slot: "skin", rarity: "comune", look: { kind: "skin", preset: "jack" }, blurb: "Sempre col sorriso, catena d'oro di serie." },
  { id: "skin-kenji", name: "Kenji", slot: "skin", rarity: "comune", look: { kind: "skin", preset: "kenji" }, blurb: "Occhiali tondi e tiro pulito." },
  { id: "skin-bomber", name: "Bomber", slot: "skin", rarity: "raro", look: { kind: "skin", preset: "bomber" }, blurb: "Afro, fascia e mano calda." },
  // Testa
  { id: "cap-volt", name: "Cappellino Volt", slot: "testa", rarity: "comune", look: { kind: "cap", color: "#ffc531", visor: "#1d1a16" }, blurb: "Visiera dritta, colore del campetto." },
  { id: "santa", name: "Berretto di Natale", slot: "testa", rarity: "epico", natale: true, esclusivo: true, look: { kind: "santa" }, blurb: "Pompon che balla a ogni palleggio." },
  // Viso
  { id: "shades", name: "Occhiali da sole", slot: "viso", rarity: "raro", look: { kind: "shades", lens: "#14181f", frame: "#1d1a16" }, blurb: "Per le partite delle due del pomeriggio." },
  { id: "goggles", name: "Maschera da neve", slot: "viso", rarity: "epico", natale: true, look: { kind: "goggles", band: "#e5412d" }, blurb: "Lente a specchio, elastico rosso." },
  // Gioielli
  { id: "chain-star", name: "Catena con stella", slot: "gioielli", rarity: "raro", look: { kind: "chain", pendant: "star" }, blurb: "Oro vero, almeno sullo schermo." },
  { id: "earring", name: "Brillante", slot: "gioielli", rarity: "epico", look: { kind: "earring" }, blurb: "Un punto luce all'orecchio." },
  // Busto
  { id: "hoodie", name: "Felpa del riscaldamento", slot: "busto", rarity: "raro", look: { kind: "hoodie", color: "#2f3542", trim: "#ffc531" }, blurb: "Cappuccio, tasca e lacci gialli." },
  { id: "sweater", name: "Maglione di Natale", slot: "busto", rarity: "leggendario", natale: true, esclusivo: true, look: { kind: "sweater" }, blurb: "Renne, fiocchi e zig-zag: il premio del livello 30." },
  // Braccio
  { id: "armband", name: "Fascia da tiro", slot: "braccio", rarity: "comune", look: { kind: "armband", color: "#1d1a16" }, blurb: "Sul bicipite, come i tiratori veri." },
  { id: "candy-sleeve", name: "Manicotto Bastoncino", slot: "braccio", rarity: "epico", natale: true, esclusivo: true, look: { kind: "sleeve", stripes: ["#e5412d", "#fff8ea"] }, blurb: "A righe come lo zucchero filato di Natale." },
  // Gambe
  { id: "shorts-black", name: "Pantaloncini Notte", slot: "gambe", rarity: "comune", look: { kind: "shorts", color: "#1d1a16", trim: "#ffc531" }, blurb: "Neri con la banda gialla." },
  { id: "shorts-renna", name: "Pantaloncini Renna", slot: "gambe", rarity: "epico", natale: true, esclusivo: true, look: { kind: "shorts", color: "#7a4a2a", trim: "#fff8ea", pattern: "renna" }, blurb: "Marroni, bordo di neve." },
  // Scarpe
  { id: "shoes-volt", name: "Scarpe Volt", slot: "piedi", rarity: "raro", look: { kind: "shoes", upper: "#ffc531", sole: "#1d1a16", laces: "#1d1a16" }, blurb: "Gialle, suola nera: si vedono da metà campo." },
  { id: "shoes-holly", name: "Scarpe Agrifoglio", slot: "piedi", rarity: "epico", natale: true, esclusivo: true, look: { kind: "shoes", upper: "#1f7a4a", sole: "#fff8ea", laces: "#e5412d" }, blurb: "Verdi, lacci rossi, suola di neve." },
  // Palloni
  { id: "ball-notte", name: "Pallone Notte", slot: "pallone", rarity: "epico", look: { kind: "ball", texture: "notte" }, blurb: "Cuciture che si accendono al buio." },
  { id: "ball-neve", name: "Pallone Neve", slot: "pallone", rarity: "epico", natale: true, esclusivo: true, look: { kind: "ball", texture: "neve" }, blurb: "Ghiaccio e brina, della season di Natale." },
  { id: "ball-oro", name: "Pallone d'Oro", slot: "pallone", rarity: "leggendario", look: { kind: "ball", texture: "oro" }, blurb: "Il più raro del campetto." },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

/** Quello che hai di serie: il personaggio che usi già e niente addosso. */
export const STARTER = ["skin-jack", "skin-kenji"];

/* ------------------------------------------------------------------ */
/* La season                                                            */
/* ------------------------------------------------------------------ */

export interface Season {
  id: string;
  name: string;
  theme: "natale";
  /** Inclusa. */
  start: string;
  /** Esclusa: dal giorno dopo inizia la pausa con i teaser. */
  end: string;
}

/**
 * La season di prova: gira sulle partite vere di novembre con il tema di Natale, così
 * si vede subito com'è con i propri numeri. Quella vera partirà il 1° dicembre.
 */
export const SEASON: Season = {
  id: "prova-natale",
  name: "Natale",
  theme: "natale",
  start: "2026-11-01T00:00:00+01:00",
  end: "2026-11-29T00:00:00+01:00",
};

export const POINTS_PER_MATCH = 15;
export const POINTS_PER_LEVEL = 40;
export const SPICCHI_PER_MATCH = 5;
/** Dopo il livello 30, ogni 40 punti diventano Spicchi. */
export const SPICCHI_PER_EXTRA_LEVEL = 25;
export const MAX_BOOSTS = 3;
export const LEVELS = 30;
export const CARDINE = [5, 10, 15, 20, 25, 30];

/* ------------------------------------------------------------------ */
/* Le sfide                                                             */
/* ------------------------------------------------------------------ */

/** Quello che serve per giudicare una partita: il tabellino del giocatore e il risultato. */
export interface MatchCtx {
  /** Il tabellino c'è (partita con le statistiche). */
  stats: boolean;
  pts: number;
  ast: number;
  reb: number;
  oreb: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  won: boolean;
  margin: number;
  /** Punti della squadra (per "metà dei punti della squadra"). */
  teamPts: number;
}

export interface Challenge {
  label: string;
  /** Serve il tabellino (altrimenti basta il risultato). */
  needsStats: boolean;
  test: (c: MatchCtx) => boolean;
}

const S = (label: string, test: (c: MatchCtx) => boolean): Challenge => ({ label, needsStats: true, test });
const R = (label: string, test: (c: MatchCtx) => boolean): Challenge => ({ label, needsStats: false, test });

export type Reward =
  | { kind: "item"; id: string }
  | { kind: "spicchi"; amount: number }
  | { kind: "boost" };

export interface Level {
  n: number;
  /** Due strade: basta una delle due in una partita. La prima per chi tira, la seconda per chi lotta sotto. */
  sfide: [Challenge, Challenge];
  reward: Reward;
}

/**
 * Trenta livelli, sei gradini di difficoltà. Ogni sfida si fa in UNA partita, e ogni
 * livello offre due strade così il centro non è penalizzato rispetto al play.
 * Le soglie sono un primo giro: si tarano sulle statistiche vere del gruppo.
 */
const RAW: [Challenge, Challenge, Reward][] = [
  // 1-5: si fanno quasi sempre
  [S("Segna almeno 2 punti", (c) => c.pts >= 2), S("Prendi 3 rimbalzi", (c) => c.reb >= 3), { kind: "spicchi", amount: 50 }],
  [S("Fai 1 assist", (c) => c.ast >= 1), S("1 rubata o 1 stoppata", (c) => c.stl + c.blk >= 1), { kind: "item", id: "cap-volt" }],
  [S("Segna 4 punti", (c) => c.pts >= 4), S("Prendi 5 rimbalzi", (c) => c.reb >= 5), { kind: "spicchi", amount: 20 }],
  [R("Vinci una partita", (c) => c.won), S("Segna 2 canestri", (c) => c.fgm >= 2), { kind: "boost" }],
  [S("Fai 2 assist", (c) => c.ast >= 2), S("Prendi 2 rimbalzi offensivi", (c) => c.oreb >= 2), { kind: "item", id: "santa" }],
  // 6-10
  [S("Segna 6 punti", (c) => c.pts >= 6), S("Prendi 7 rimbalzi", (c) => c.reb >= 7), { kind: "spicchi", amount: 50 }],
  [S("Metti una tripla", (c) => c.fg3m >= 1), S("Fai una stoppata", (c) => c.blk >= 1), { kind: "item", id: "armband" }],
  [R("Vinci con almeno 5 punti di scarto", (c) => c.won && c.margin >= 5), S("Zero palle perse con almeno 5 tiri", (c) => c.tov === 0 && c.fga >= 5), { kind: "spicchi", amount: 20 }],
  [S("Fai 2 rubate", (c) => c.stl >= 2), S("Prendi 3 rimbalzi offensivi", (c) => c.oreb >= 3), { kind: "item", id: "shades" }],
  [S("Segna 8 punti", (c) => c.pts >= 8), S("Prendi 9 rimbalzi", (c) => c.reb >= 9), { kind: "item", id: "ball-neve" }],
  // 11-15
  [S("Tira col 50% (almeno 6 tiri)", (c) => c.fga >= 6 && c.fgm * 2 >= c.fga), S("Fai 1 assist e 6 rimbalzi", (c) => c.ast >= 1 && c.reb >= 6), { kind: "spicchi", amount: 50 }],
  [S("Fai 3 assist", (c) => c.ast >= 3), S("Prendi 4 rimbalzi offensivi", (c) => c.oreb >= 4), { kind: "boost" }],
  [S("Segna 10 punti", (c) => c.pts >= 10), S("Prendi 11 rimbalzi", (c) => c.reb >= 11), { kind: "item", id: "chain-star" }],
  [S("Tripla e assist nella stessa partita", (c) => c.fg3m >= 1 && c.ast >= 1), S("Stoppata e rubata nella stessa partita", (c) => c.blk >= 1 && c.stl >= 1), { kind: "spicchi", amount: 20 }],
  [R("Vinci con almeno 8 punti di scarto", (c) => c.won && c.margin >= 8), S("Vinci con almeno 8 rimbalzi", (c) => c.won && c.reb >= 8), { kind: "item", id: "shoes-holly" }],
  // 16-20
  [S("Segna 12 punti", (c) => c.pts >= 12), S("Prendi 13 rimbalzi", (c) => c.reb >= 13), { kind: "spicchi", amount: 50 }],
  [S("Metti 2 triple", (c) => c.fg3m >= 2), S("Fai 2 stoppate", (c) => c.blk >= 2), { kind: "item", id: "hoodie" }],
  [S("Zero errori con almeno 4 tiri", (c) => c.fga >= 4 && c.fgm === c.fga), S("Doppia cifra di rimbalzi senza palle perse", (c) => c.reb >= 10 && c.tov === 0), { kind: "spicchi", amount: 20 }],
  [S("Fai 3 assist e vinci", (c) => c.ast >= 3 && c.won), S("3 rimbalzi offensivi e vinci", (c) => c.oreb >= 3 && c.won), { kind: "item", id: "earring" }],
  [S("Segna metà dei punti della squadra (almeno 8)", (c) => c.pts >= 8 && c.pts * 2 >= c.teamPts), S("Prendi 15 rimbalzi", (c) => c.reb >= 15), { kind: "item", id: "candy-sleeve" }],
  // 21-25
  [S("Segna 14 punti", (c) => c.pts >= 14), S("Doppia doppia di punti e rimbalzi", (c) => c.pts >= 10 && c.reb >= 10), { kind: "spicchi", amount: 50 }],
  [S("Tira col 60% (almeno 8 tiri)", (c) => c.fga >= 8 && c.fgm * 5 >= c.fga * 3), S("3 rubate o 3 stoppate", (c) => c.stl >= 3 || c.blk >= 3), { kind: "boost" }],
  [S("Fai 4 assist", (c) => c.ast >= 4), S("Prendi 5 rimbalzi offensivi", (c) => c.oreb >= 5), { kind: "item", id: "shoes-volt" }],
  [S("100% da 3 con almeno 2 tiri", (c) => c.fg3a >= 2 && c.fg3m === c.fg3a), S("Zero errori con almeno 5 tiri da sotto", (c) => c.fga >= 5 && c.fgm === c.fga), { kind: "spicchi", amount: 20 }],
  [R("Vinci con almeno 12 punti di scarto", (c) => c.won && c.margin >= 12), S("Vinci con 12 rimbalzi", (c) => c.won && c.reb >= 12), { kind: "item", id: "shorts-renna" }],
  // 26-30
  [S("Segna 16 punti", (c) => c.pts >= 16), S("Prendi 17 rimbalzi", (c) => c.reb >= 17), { kind: "spicchi", amount: 50 }],
  [S("Zero errori con almeno 6 tiri", (c) => c.fga >= 6 && c.fgm === c.fga), S("Doppia doppia e vittoria", (c) => c.won && c.pts >= 10 && c.reb >= 10), { kind: "item", id: "shorts-black" }],
  [S("Metti 3 triple", (c) => c.fg3m >= 3), S("Fai 3 stoppate", (c) => c.blk >= 3), { kind: "spicchi", amount: 20 }],
  [S("Fai 5 assist", (c) => c.ast >= 5), S("Doppia doppia con un assist", (c) => c.pts >= 10 && c.reb >= 10 && c.ast >= 1), { kind: "spicchi", amount: 50 }],
  [S("Segna 18 punti", (c) => c.pts >= 18), S("Prendi 20 rimbalzi", (c) => c.reb >= 20), { kind: "item", id: "sweater" }],
];

export const PASS_LEVELS: Level[] = RAW.map(([a, b, reward], i) => ({ n: i + 1, sfide: [a, b], reward }));

/** Le probabilità del tiro del giorno, per numero di canestri su 5: si leggono nel gioco. */
export const SHOT_ODDS: Record<number, Record<Rarity, number>> = {
  0: { comune: 85, raro: 13, epico: 2, leggendario: 0 },
  1: { comune: 78, raro: 18, epico: 4, leggendario: 0 },
  2: { comune: 68, raro: 24, epico: 7, leggendario: 1 },
  3: { comune: 55, raro: 30, epico: 12, leggendario: 3 },
  4: { comune: 40, raro: 35, epico: 19, leggendario: 6 },
  5: { comune: 25, raro: 35, epico: 28, leggendario: 12 },
};

/** Lo scambio del quarto boost: un oggetto a sorpresa con queste probabilità. */
export const SWAP_ODDS: Record<Rarity, number> = { comune: 55, raro: 30, epico: 12, leggendario: 3 };

/** Un doppione torna indietro come metà del suo prezzo. */
export const duplicateRefund = (r: Rarity) => PRICE[r] / 2;
