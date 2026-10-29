/**
 * La guida all'app: poche sezioni, una per scheda, con passaggi brevi.
 * Lo stato resta solo sul telefono (localStorage), per giocatore.
 */

export const TOUR_VERSION = 1;

export interface TourStep {
  target: string;
  title: string;
  text: string;
}

export interface TourSection {
  title: string;
  path: string;
  steps: TourStep[];
}

const step = (target: string, title: string, text: string): TourStep => ({ target, title, text });

export type SectionId = "home" | "classifica" | "partite" | "profilo";

export function sections(isAdmin: boolean): Record<SectionId, TourSection> {
  return {
    home: {
      title: "Home",
      path: "/",
      steps: [
        step("home-month", "Il tuo mese", "Vittorie, sconfitte ed ELO, aggiornati dopo ogni partita"),
        step("home-next", "Chi viene a giocare", "Rispondi con un tocco, oppure tocca la scheda per il calendario"),
        step("home-mvp", "L'MVP in carica", "Il migliore del mese: la i ti spiega come si diventa"),
        step("nav", "Cambia scheda", "Tocca qui sotto o scorri a destra e a sinistra, tira giù per aggiornare"),
      ],
    },
    classifica: {
      title: "Classifica",
      path: "/classifiche",
      steps: [
        step("rank-period", "Mese, stagione o sempre", "Le frecce cambiano periodo, il menu sceglie il formato"),
        step("rank-boards", "Scegli la classifica", "MVP, vittorie, punti, assist e le altre statistiche"),
        step("rank-podium", "Il podio", "Conta anche quante volte vieni: chi gioca poco resta fuori classifica"),
      ],
    },
    partite: {
      title: "Partite",
      path: "/partite",
      steps: [
        step("matches-list", "Tutte le partite", "Tocca una partita per vedere risultato e tabellino"),
        ...(isAdmin ? [step("matches-add", "Aggiungi una partita", "Solo tu puoi inserire, modificare o eliminare le partite")] : []),
      ],
    },
    profilo: {
      title: "Profilo",
      path: "/profilo",
      steps: [
        step("profile-card", "La tua figurina", "Più badge prendi, più figurine speciali sblocchi: le scegli dalle impostazioni"),
        step("profile-stats", "I tuoi numeri", "Le medie, la forma e l'andamento mese per mese"),
        step("profile-settings", "La guida resta qui", "Nelle impostazioni la ritrovi, anche per una sola scheda"),
      ],
    },
  };
}

export const SECTION_IDS: SectionId[] = ["home", "classifica", "partite", "profilo"];

export type TourStatus = "new" | "dismissed" | "in_progress" | "completed";

export interface TourState {
  version: number;
  status: TourStatus;
  section: SectionId | null;
  step: number;
}

export const tourKey = (playerId: string) => `campetto:tour:${playerId}`;

export function readTour(key: string): TourState {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    if (v?.version === TOUR_VERSION && ["new", "dismissed", "in_progress", "completed"].includes(v.status))
      return { ...v, section: SECTION_IDS.includes(v.section) ? v.section : null, step: Number.isInteger(v.step) && v.step >= 0 ? v.step : 0 };
  } catch {
    /* memoria non disponibile */
  }
  return { version: TOUR_VERSION, status: "new", section: null, step: 0 };
}

export function saveTour(key: string, s: TourState) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...s, version: TOUR_VERSION }));
  } catch {
    /* la guida resta usabile in questa sessione */
  }
}
