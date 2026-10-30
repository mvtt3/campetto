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

const step = (target: string, title: string, text: string): TourStep => ({
  target,
  title,
  text,
});

export type SectionId = "home" | "classifica" | "partite" | "profilo";

export function sections(
  isAdmin: boolean,
  /** Ci sono gli highlights dell'ultima serata: un passo in più in Partite. */
  highlights = false,
): Record<SectionId, TourSection> {
  return {
    home: {
      title: "Home",
      path: "/",
      steps: [
        step(
          "home-month",
          "Il tuo mese",
          "Vinte, perse e il tuo ELO: si aggiornano dopo ogni partita",
        ),
        step(
          "home-next",
          "Chi viene a giocare",
          "Dì se ci sei con un tocco. Tocca la scheda per aprire il calendario",
        ),
        step(
          "home-mvp",
          "L'MVP in carica",
          "Il migliore del mese. Tocca la i per sapere come si diventa",
        ),
        step(
          "home-news",
          "Le notizie",
          "Record, serate e annunci del gruppo. Il pallino rosso ti dice quando c'è qualcosa di nuovo",
        ),
        step(
          "nav",
          "Le schede",
          "Tocca un'icona per cambiare schermata. Tira giù per aggiornare",
        ),
      ],
    },
    classifica: {
      title: "Classifica",
      path: "/classifiche",
      steps: [
        step(
          "rank-period",
          "Mese, stagione o sempre",
          "Con le frecce scegli il periodo, dal menu il formato: 1 contro 1, 2 contro 2 e così via",
        ),
        step(
          "rank-boards",
          "Scegli la classifica",
          "MVP, vittorie, punti e tutte le altre. In Squadre vedi chi vince di più giocando insieme",
        ),
        step(
          "rank-podium",
          "Il podio",
          "I primi tre restano in vista, gli altri scorrono sotto. Chi ha giocato poco compare fuori classifica",
        ),
      ],
    },
    partite: {
      title: "Partite",
      path: "/partite",
      steps: [
        step(
          "matches-list",
          "Tutte le partite",
          "Tocca una partita per vedere risultato, MVP e tabellino",
        ),
        ...(highlights
          ? [
              step(
                "matches-highlights",
                "Gli highlights",
                "Tutti i canestri della serata in un video. Scorri in su per la partita dopo, due tocchi per dare il pallone",
              ),
            ]
          : []),
        ...(isAdmin
          ? [
              step(
                "matches-add",
                "Aggiungi una partita",
                "Solo tu puoi inserire, modificare o eliminare le partite",
              ),
            ]
          : []),
      ],
    },
    profilo: {
      title: "Profilo",
      path: "/profilo",
      steps: [
        step(
          "profile-card",
          "Il tuo personaggio",
          "È il tuo personaggio. Toccalo per la collezione: con i badge ne sblocchi di rari, epici e mitici",
        ),
        step(
          "profile-stats",
          "I tuoi numeri",
          "Le tue medie, le ultime partite e come vai mese dopo mese",
        ),
        step(
          "profile-tabs",
          "Statistiche e mappa di tiro",
          "In Statistiche apri le statistiche avanzate: tocca una zona del campo per vedere come tiri da sotto, dalla media e da tre",
        ),
        step(
          "profile-settings",
          "La guida resta qui",
          "Se ti serve di nuovo, la trovi nelle impostazioni",
        ),
      ],
    },
  };
}

export const SECTION_IDS: SectionId[] = [
  "home",
  "classifica",
  "partite",
  "profilo",
];

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
    if (
      v?.version === TOUR_VERSION &&
      ["new", "dismissed", "in_progress", "completed"].includes(v.status)
    )
      return {
        ...v,
        section: SECTION_IDS.includes(v.section) ? v.section : null,
        step: Number.isInteger(v.step) && v.step >= 0 ? v.step : 0,
      };
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
