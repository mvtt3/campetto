import type { Place } from "../types";
import { atPlace, dayLabel } from "./grouping";

/**
 * "Partita confermata": lo stesso titolo dell'etichetta verde nel calendario, sia quando la
 * partita si riempie sia 12 ore prima con almeno 4 "ci sono". Prima il fatto (quando, dove,
 * quanti), poi l'unica cosa da fare: avvisare se non si può più.
 */
export function confirmedPush(
  m: { startsAt: string; place: Place | null; yes: number },
  now?: Date,
): { title: string; body: string } {
  const when = dayLabel(m.startsAt, now);
  return {
    title: "✅ Partita confermata",
    body: `${when[0].toUpperCase()}${when.slice(1)}${atPlace(m.place)}: siete in ${m.yes}, si gioca. Se non puoi più venire, dillo nell'app`,
  };
}

/** A chi non ha ancora risposto: la partita c'è, con i bottoni per entrare. */
export function confirmedInvite(
  m: { startsAt: string; place: Place | null; yes: number },
  now?: Date,
): { title: string; body: string } {
  return {
    title: "✅ Partita confermata",
    body: `${dayLabel(m.startsAt, now)}${atPlace(m.place)}: siete già in ${m.yes}. Vuoi esserci anche tu?`.replace(/^./, (c) => c.toUpperCase()),
  };
}

/** Il calendario su quel giorno, con la partita evidenziata. */
export function proposalUrl(id: string, startsAt: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(startsAt));
  return `/organizza?giorno=${day}&p=${id}`;
}
