/**
 * Risultati in ritardo: quando i punteggi di una giornata non si riescono a caricare in tempo, qui
 * si scrive la giornata e l'ora a cui arrivano. Il calendario, al posto di "calcolo in corso",
 * mostra il ritardo con l'ora promessa; e la scheda resta finché i risultati non ci sono.
 */
export interface StatsDelay {
  /** La giornata (aaaa-mm-gg, ora italiana) della partita. */
  day: string;
  /** Quando arrivano i risultati (ISO, con fuso). */
  eta: string;
}

export const STATS_DELAYS: StatsDelay[] = [
  // Lunedì 16 novembre: risultati attesi martedì 17 alle 21.
  { day: "2026-11-16", eta: "2026-11-17T21:00:00+01:00" },
];

/** Dopo l'ora promessa la scheda resta ancora un po' ("in arrivo"), poi si toglie da sola. */
export const DELAY_GRACE_HOURS = 12;

const romeDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(iso));

export function statsDelayFor(startsAt: string, delays: StatsDelay[] = STATS_DELAYS): StatsDelay | null {
  const day = romeDay(startsAt);
  return delays.find((d) => d.day === day) ?? null;
}

/** Fino a quando la scheda di una partita in ritardo può restare (ms), o null se non è in ritardo. */
export function delayVisibleUntil(startsAt: string, delays: StatsDelay[] = STATS_DELAYS): number | null {
  const d = statsDelayFor(startsAt, delays);
  return d ? new Date(d.eta).getTime() + DELAY_GRACE_HOURS * 3_600_000 : null;
}
