import type { PlayerStats } from "./player";

/**
 * Attributi e OVR, come in NBA 2K ma sulle proprie prestazioni: ogni voce ha una scala fissa
 * (60 il minimo, 99 da fenomeno), non dipende dagli altri del gruppo.
 *
 * Con pochi tiri o poche partite il valore viene tirato verso una media prudente
 * (un 4/4 da tre non vale come il 40% su 100 tiri) e pesa sempre di più man mano che i numeri crescono.
 */

/** [valore, voto]: tra due soglie il voto cresce in modo continuo. */
type Scale = readonly (readonly [number, number])[];

export const RATING_MIN = 60;
export const RATING_MAX = 99;

export const SCALES = {
  /** % da tre (prudente: come se ci fossero 30 tiri in più al 25%). */
  three: [[0, 60], [10, 70], [20, 76], [28, 82], [33, 86], [38, 90], [43, 93], [48, 96], [55, 99]],
  /** % da due (prudente: 30 tiri in più al 40%). */
  two: [[15, 60], [25, 70], [33, 76], [40, 82], [45, 86], [50, 91], [55, 94], [60, 97], [68, 99]],
  /** Punti a partita. */
  points: [[0, 60], [2, 70], [4, 76], [6, 81], [8, 86], [10, 90], [12, 93], [15, 96], [18, 99]],
  /** Rimbalzi a partita. */
  rebounds: [[0.5, 60], [2, 70], [3.5, 76], [5, 81], [6.5, 86], [8, 90], [9.5, 93], [11, 96], [13, 99]],
  /** Assist a partita. */
  assists: [[0, 60], [0.3, 70], [0.8, 76], [1.3, 81], [1.8, 86], [2.5, 90], [3.2, 93], [4, 96], [5, 99]],
  /** Rubate + stoppate a partita. */
  defense: [[0, 60], [0.2, 70], [0.5, 76], [0.8, 81], [1.1, 86], [1.5, 90], [2, 93], [2.6, 96], [3.3, 99]],
  /** % di vittorie. */
  wins: [[0, 60], [25, 70], [40, 76], [50, 81], [60, 86], [70, 90], [80, 94], [90, 97], [100, 99]],
  /** Produzione a partita: punti + rimbalzi + assist + rubate + stoppate − tiri sbagliati − palle perse. */
  production: [[-5, 60], [0, 70], [3, 76], [6, 81], [9, 86], [12, 90], [15, 93], [19, 96], [24, 99]],
} as const satisfies Record<string, Scale>;

export function onScale(value: number, scale: Scale): number {
  if (value <= scale[0][0]) return scale[0][1];
  for (let i = 1; i < scale.length; i++) {
    const [x1, y1] = scale[i];
    if (value <= x1) {
      const [x0, y0] = scale[i - 1];
      return Math.round(y0 + ((value - x0) / (x1 - x0)) * (y1 - y0));
    }
  }
  return scale[scale.length - 1][1];
}

/** Percentuale prudente: i tiri veri più `weight` tiri immaginari a `base`. */
export function steadyPct(made: number, att: number, base: number, weight: number): number {
  return (100 * (made + base * weight)) / (att + weight);
}

/** Media a partita prudente: come se ci fossero `weight` partite in più a `base`. */
export function steadyAvg(total: number, games: number, base: number, weight = 3): number {
  return (total + base * weight) / (games + weight);
}

/** Servono almeno 3 partite col tabellino (e 5 tiri da tre per il tiro da tre). */
const MIN_GAMES = 3;
const MIN_THREES = 5;

export interface Attribute {
  label: string;
  value: number | null;
}

export function playerAttributes(s: PlayerStats): Attribute[] {
  const t = s.totals;
  const g = s.statGames;
  const boxed = g >= MIN_GAMES;
  return [
    { label: "Realizzazione", value: boxed ? onScale(steadyAvg(t.pts, g, 5), SCALES.points) : null },
    {
      label: "Tiro da tre",
      value: t.fg3a >= MIN_THREES ? onScale(steadyPct(t.fg3m, t.fg3a, 0.25, 30), SCALES.three) : null,
    },
    {
      label: "Tiro da due",
      value: boxed && t.fg2a > 0 ? onScale(steadyPct(t.fg2m, t.fg2a, 0.4, 30), SCALES.two) : null,
    },
    { label: "Rimbalzi", value: boxed ? onScale(steadyAvg(t.oreb + t.dreb, g, 4), SCALES.rebounds) : null },
    { label: "Passaggio", value: boxed ? onScale(steadyAvg(t.ast, g, 1), SCALES.assists) : null },
    { label: "Difesa", value: boxed ? onScale(steadyAvg(t.stl + t.blk, g, 0.7), SCALES.defense) : null },
    {
      label: "Vincente",
      value: s.games >= MIN_GAMES ? onScale(steadyPct(s.wins, s.games, 0.5, 6), SCALES.wins) : null,
    },
  ];
}

/** La produzione a partita, sulla sua scala (null senza abbastanza tabellini). */
export function productionRating(s: PlayerStats): number | null {
  return s.statGames >= MIN_GAMES ? onScale(steadyAvg(s.eff, s.statGames, 4), SCALES.production) : null;
}

/**
 * L'OVR: per il 70% la media degli attributi, dove le tre voci migliori contano il doppio
 * (come in 2K, chi è fortissimo in qualcosa non viene trascinato giù dalla voce più debole),
 * per il 30% la produzione a partita.
 */
export function overall(attributes: Attribute[], production: number | null): number | null {
  const values = attributes.flatMap((a) => (a.value === null ? [] : [a.value])).sort((a, b) => b - a);
  if (!values.length) return null;
  let sum = 0;
  let weight = 0;
  values.forEach((v, i) => {
    const w = i < 3 ? 2 : 1;
    sum += v * w;
    weight += w;
  });
  const attr = sum / weight;
  return Math.round(production === null ? attr : 0.7 * attr + 0.3 * production);
}
