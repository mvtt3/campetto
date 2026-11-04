import type { Place } from "../types";
import { atPlace, dayLabel } from "./grouping";

/**
 * Le notifiche di una partita che salta. Come le app di prenotazione campi: prima il fatto
 * (che partita, quando, dove), poi una sola cosa da fare. Arrivano solo a chi aveva detto
 * "Ci sono": chi aveva detto "Forse" o "No" non aveva niente in programma.
 */
export interface CancelPush {
  title: string;
  body: string;
  url: string;
}

interface Match {
  startsAt: string;
  place: Place | null;
}

const when = (m: Match, now?: Date) =>
  `${dayLabel(m.startsAt, now)}${atPlace(m.place)}`;

const dayParam = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(iso));

/** Annullata a mano: per la pioggia o per altro. */
export function cancelledPush(
  m: Match,
  reason: "meteo" | null,
  by: string,
  now?: Date,
): CancelPush {
  if (reason === "meteo")
    return {
      title: "🌧️ Partita annullata per pioggia",
      body: `La partita di ${when(m, now)} salta per il meteo. Appena ne propongono un'altra ti avviso`,
      url: `/organizza?giorno=${dayParam(m.startsAt)}`,
    };
  return {
    title: "Partita annullata",
    body: `${by} ha annullato la partita di ${when(m, now)}. Appena ne propongono un'altra ti avviso`,
    url: "/organizza",
  };
}

/**
 * Annullata da sola, 12 ore prima, perché non si è arrivati al minimo di "Ci sono".
 * A chi l'ha proposta: com'è andata e come rimediare. Agli altri: che non devono più venire.
 */
export function autoCancelledPush(
  m: Match & { yes: number; min: number },
  proposer: boolean,
  now?: Date,
): CancelPush {
  const title = "Partita annullata: mancano giocatori";
  if (proposer)
    return {
      title,
      body: `La tua partita di ${when(m, now)} si è fermata a ${m.yes} "ci sono" su ${m.min}. Riproponila per un altro giorno: ci vuole un attimo`,
      url: "/organizza?nuova=1",
    };
  return {
    title,
    body: `Per ${when(m, now)} eravate in ${m.yes}, ne servivano ${m.min}. Appena ne propongono un'altra ti avviso`,
    url: "/organizza",
  };
}
