/**
 * "Torna a giocare": la notifica settimanale di Spicchio per chi non apre l'app da
 * qualche giorno. Ogni volta una frase diversa (si gira in ordine, partendo da un
 * punto diverso per ognuno, così nel gruppo non arriva a tutti la stessa).
 */

export interface Nudge {
  title: string;
  body: string;
  url: string;
}

type Line = (name: string, days: number) => Nudge;

export const NUDGES: Line[] = [
  (n) => ({ title: "Il canestro chiede di te", body: `${n}, è un po' che non ti vedo al campetto: un tiro oggi?`, url: "/organizza" }),
  (_, d) => ({ title: "Mani fredde?", body: `Sono ${d} giorni senza un tiro: ti aspetto sotto il canestro`, url: "/" }),
  () => ({ title: "Pallone gonfio, campo libero", body: "Manchi solo tu: guarda chi c'è e proponi una partita", url: "/organizza" }),
  () => ({ title: "Si scalda il tiro da tre?", body: "Due tiri liberi e la settimana gira meglio: ci vediamo al campetto", url: "/organizza" }),
  (n) => ({ title: "Il ferro sente la tua mancanza", body: `Torna a farlo suonare, ${n}`, url: "/" }),
  () => ({ title: "La classifica si muove", body: "Mentre sei via gli altri salgono: torna a riprenderti il tuo posto", url: "/classifiche" }),
  (n) => ({ title: "Ti tengo il posto in squadra", body: `Dimmi quando ci sei, ${n}: ci metto un attimo a fare le squadre`, url: "/organizza" }),
  () => ({ title: "Oggi si gioca?", body: "Apri il calendario e guarda chi ha già detto ci sono", url: "/organizza" }),
  (n) => ({ title: `${n}, scarpe allacciate?`, body: "Il pallone è pronto, manchi solo tu", url: "/" }),
  () => ({ title: "Un'oretta di campetto", body: "È il modo migliore per staccare: chiamo gli altri?", url: "/organizza" }),
  () => ({ title: "Allenamento in vista", body: "Il tuo ELO non sale da solo: torna in campo", url: "/" }),
  (n) => ({ title: "Ciuff, ciuff", body: `Ho nostalgia dei tuoi canestri, ${n}`, url: "/" }),
];

/** Un numero stabile da un testo: da dove parte il giro delle frasi per ognuno. */
function seedOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** La frase per l'n-esimo promemoria di un giocatore (n parte da 1). */
export function nudgeFor(playerId: string, n: number, name: string, days: number): Nudge {
  const i = (seedOf(playerId) + Math.max(0, n - 1)) % NUDGES.length;
  return NUDGES[i](name.trim() || "Campione", Math.max(6, Math.round(days)));
}
