import type { Level, Slot } from "./types";

/**
 * Il negozio di Campetto Star: vestiti e accessori. Quello che indossi nel gioco si
 * vede anche nell'app (profilo, classifiche, partite), per questo ogni oggetto ha il
 * suo "look": come si disegna sul personaggio.
 */

export type Look =
  | { kind: "cap"; color: string; visor: string }
  | { kind: "headband"; color: string; logo?: string }
  | { kind: "beanie"; color: string; band: string }
  | { kind: "crown"; color: string }
  | { kind: "glasses"; frame: string; lens: string; shape: "round" | "square" | "aviator" | "star" }
  | { kind: "earring"; color: string; gem?: boolean }
  | { kind: "chain"; color: string; thick: boolean; pendant?: string }
  | { kind: "watch"; band: string; face: string }
  | { kind: "jersey"; jersey: string; trim: string }
  | { kind: "shoes"; color: string };

export interface Item {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  /** Il livello di carriera da cui si può comprare. */
  level: Level;
  look: Look;
  /** Una riga sotto al nome nel negozio. */
  line: string;
  /** Non si compra: arriva da un premio (corona, occhiali a stella…). */
  prize?: boolean;
}

const INK = "#1D1A16";
const CREAM = "#FFF8EA";
const GOLD = "#E8A80C";
const SILVER = "#C9D3E0";

export const ITEMS: Item[] = [
  // Scarpe: il primo acquisto di tutti.
  { id: "scarpe-campetto", name: "Scarpe da campetto", slot: "scarpe", price: 80, level: "campetto", look: { kind: "shoes", color: CREAM }, line: "Bianche, finché durano" },
  { id: "scarpe-blu", name: "Scarpe blu elettrico", slot: "scarpe", price: 160, level: "campetto", look: { kind: "shoes", color: "#2D5BE3" }, line: "Si notano da metà campo" },
  { id: "scarpe-volt", name: "Scarpe evidenziatore", slot: "scarpe", price: 420, level: "campetto", look: { kind: "shoes", color: "#C6F432" }, line: "Gialle fluo, per chi non passa inosservato" },
  { id: "scarpe-nere", name: "Scarpe nere da Serie B", slot: "scarpe", price: 1200, level: "b", look: { kind: "shoes", color: "#2B2724" }, line: "Serie, come chi le porta" },
  { id: "scarpe-rosa", name: "Scarpe rosa shocking", slot: "scarpe", price: 2600, level: "b", look: { kind: "shoes", color: "#E2557A" }, line: "Per chi segna e se ne vanta" },
  { id: "scarpe-oro", name: "Scarpe d'oro", slot: "scarpe", price: 25000, level: "a", look: { kind: "shoes", color: GOLD }, line: "Brillano anche in panchina" },

  // Canotte: cambiano il colore della divisa.
  { id: "canotta-bianca", name: "Canotta bianca", slot: "maglia", price: 30, level: "campetto", look: { kind: "jersey", jersey: CREAM, trim: "#E5412D" }, line: "La classica del campetto" },
  { id: "canotta-nera", name: "Canotta nera", slot: "maglia", price: 60, level: "campetto", look: { kind: "jersey", jersey: "#2B2724", trim: "#FFC531" }, line: "Snellisce, dicono" },
  { id: "canotta-arancio", name: "Canotta arancione", slot: "maglia", price: 60, level: "campetto", look: { kind: "jersey", jersey: "#F26A1B", trim: INK }, line: "Del colore del pallone" },
  { id: "canotta-verde", name: "Canotta verde prato", slot: "maglia", price: 120, level: "campetto", look: { kind: "jersey", jersey: "#2E9E5B", trim: CREAM }, line: "Per chi gioca anche sull'erba" },
  { id: "canotta-viola", name: "Canotta viola reale", slot: "maglia", price: 900, level: "b", look: { kind: "jersey", jersey: "#7C4DCC", trim: "#FFC531" }, line: "Colori da squadra di Los Angeles Laghetti" },
  { id: "canotta-celeste", name: "Canotta celeste", slot: "maglia", price: 900, level: "b", look: { kind: "jersey", jersey: "#9FD3F5", trim: "#1D3B66" }, line: "Fresca anche ad agosto" },
  { id: "canotta-oro", name: "Canotta d'oro", slot: "maglia", price: 18000, level: "a", look: { kind: "jersey", jersey: "#F2B705", trim: INK }, line: "Si vede dallo spazio" },

  // Testa.
  { id: "fascia", name: "Fascetta", slot: "testa", price: 15, level: "campetto", look: { kind: "headband", color: CREAM, logo: "#E5412D" }, line: "Il sudore non passa" },
  { id: "cappellino", name: "Cappellino", slot: "testa", price: 25, level: "campetto", look: { kind: "cap", color: "#2D5BE3", visor: "#1D3B66" }, line: "Visiera avanti, come i bravi ragazzi" },
  { id: "berretto", name: "Berretto di lana", slot: "testa", price: 40, level: "campetto", look: { kind: "beanie", color: "#E5412D", band: "#B3261E" }, line: "Per le partite di gennaio" },
  { id: "fascia-nera", name: "Fascetta nera", slot: "testa", price: 350, level: "b", look: { kind: "headband", color: INK, logo: GOLD }, line: "Da veterano" },
  { id: "cappellino-oro", name: "Cappellino d'oro", slot: "testa", price: 6000, level: "a", look: { kind: "cap", color: GOLD, visor: "#B98600" }, line: "Visiera placcata" },
  { id: "corona", name: "Corona del campetto", slot: "testa", price: 0, level: "campetto", look: { kind: "crown", color: GOLD }, line: "Primo in tutte e tre le sfide nello stesso giorno", prize: true },

  // Occhi.
  { id: "occhiali", name: "Occhiali da sole", slot: "occhi", price: 60, level: "campetto", look: { kind: "glasses", frame: INK, lens: "#2B2724", shape: "square" }, line: "Anche di sera, ovviamente" },
  { id: "occhiali-tondi", name: "Occhiali tondi", slot: "occhi", price: 120, level: "campetto", look: { kind: "glasses", frame: GOLD, lens: "#7C4DCC", shape: "round" }, line: "Lenti viola, aria da artista" },
  { id: "occhiali-firmati", name: "Occhiali firmati", slot: "occhi", price: 400, level: "b", look: { kind: "glasses", frame: GOLD, lens: "#1D3B66", shape: "aviator" }, line: "Montatura d'oro, prezzo pure" },
  { id: "occhiali-stella", name: "Occhiali a stella", slot: "occhi", price: 0, level: "campetto", look: { kind: "glasses", frame: INK, lens: "#FFC531", shape: "star" }, line: "Premio della settimana: 7 giorni di fila", prize: true },

  // Orecchie.
  { id: "orecchino", name: "Orecchino", slot: "orecchie", price: 90, level: "campetto", look: { kind: "earring", color: SILVER }, line: "Un puntino d'argento" },
  { id: "orecchino-oro", name: "Orecchino d'oro", slot: "orecchie", price: 450, level: "b", look: { kind: "earring", color: GOLD }, line: "Fa tanto Serie B" },
  { id: "orecchino-diamante", name: "Orecchino col diamante", slot: "orecchie", price: 2000, level: "b", look: { kind: "earring", color: "#BFF0FF", gem: true }, line: "Brilla ad ogni tiro libero" },

  // Collo.
  { id: "catenina", name: "Catenina", slot: "collo", price: 150, level: "campetto", look: { kind: "chain", color: SILVER, thick: false }, line: "Sottile, d'argento" },
  { id: "catena-argento", name: "Catena col pallone", slot: "collo", price: 1500, level: "b", look: { kind: "chain", color: SILVER, thick: true, pendant: "#F26A1B" }, line: "Il ciondolo è un pallone" },
  { id: "catena-oro", name: "Catena d'oro", slot: "collo", price: 40000, level: "a", look: { kind: "chain", color: GOLD, thick: true, pendant: GOLD }, line: "Pesa quanto un pallone" },

  // Polso.
  { id: "orologio", name: "Orologio di plastica", slot: "polso", price: 20, level: "campetto", look: { kind: "watch", band: INK, face: CREAM }, line: "Fa anche il cronometro" },
  { id: "orologio-sport", name: "Orologio sportivo", slot: "polso", price: 300, level: "campetto", look: { kind: "watch", band: "#E5412D", face: INK }, line: "Conta i passi, anche quelli di troppo" },
  { id: "rolecs", name: "Rolecs", slot: "polso", price: 15000, level: "a", look: { kind: "watch", band: GOLD, face: "#1D3B66" }, line: "Non è falso, è un'altra marca" },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export const SLOT_NAMES: Record<Slot, string> = {
  scarpe: "Scarpe",
  maglia: "Canotte",
  testa: "Testa",
  occhi: "Occhiali",
  orecchie: "Orecchini",
  collo: "Collane",
  polso: "Orologi",
};

export const SLOTS: Slot[] = ["scarpe", "maglia", "testa", "occhi", "orecchie", "collo", "polso"];

/** Le cose del negozio che non si indossano: si consumano subito. */
export interface Consumable {
  id: string;
  name: string;
  line: string;
  /** Prezzo al livello Campetto: sale col livello. */
  price: number;
  energy?: number;
  happiness?: number;
  perk?: "trainer" | "agent";
}

export const CONSUMABLES: Consumable[] = [
  { id: "energetica", name: "Bevanda energetica", line: "+30 energia, subito", price: 4, energy: 30 },
  { id: "massaggio", name: "Massaggio", line: "Energia piena e buonumore", price: 60, energy: 100, happiness: 5 },
  { id: "pizza", name: "Pizza con gli amici", line: "+10 felicità", price: 15, happiness: 10 },
  { id: "trainer", name: "Personal trainer", line: "Gli allenamenti valgono il doppio, per sempre", price: 600, perk: "trainer" },
  { id: "agente", name: "Agente", line: "Contratti più ricchi a fine stagione", price: 1500, perk: "agent" },
];
