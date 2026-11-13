/**
 * Studio Campetto: lo show di un paio di minuti dopo una giornata di partite, con due
 * presentatori in studio, le grafiche sul maxischermo e i canestri della serata.
 *
 * La puntata è un file JSON (con il suo audio) preparato dopo aver caricato le statistiche:
 * battute con i tempi e l'apertura della bocca, inquadrature, grafiche. Tutto quello che si
 * vede è una funzione del tempo, così il player può fermarsi, tornare indietro o saltare
 * avanti di 10 secondi come un reel.
 */

export type StudioCam = "ampio" | "coppia" | "lui" | "lei" | "schermo";
export type StudioWho = "lui" | "lei";

export type StudioScreen =
  | { kind: "sigla"; title: string; subtitle: string }
  | {
      kind: "risultati";
      title: string;
      games: { a: string[]; b: string[]; sa: number; sb: number }[];
    }
  | {
      kind: "giocatore";
      playerId: string;
      kicker: string;
      tiles: { label: string; value: number; suffix?: string }[];
      tag?: string;
    }
  | {
      kind: "record";
      kicker: string;
      label: string;
      value: number;
      unit: string;
      playerId: string;
      before?: string;
    }
  | {
      kind: "tiro";
      kicker: string;
      title: string;
      rows: { playerId: string; made: number; att: number }[];
      note?: string;
    }
  | {
      kind: "elo";
      kicker: string;
      rows: { playerId: string; delta: number; after: number }[];
    }
  | {
      kind: "montaggio";
      kicker: string;
      clips: { src: string; from: number; dur: number; label: string; t: number }[];
    };

export interface StudioLine {
  who: StudioWho;
  t: number;
  d: number;
  text: string;
  /** Apertura della bocca, 30 cifre (0-9) al secondo. */
  mouth: string;
}

export interface StudioShow {
  id: string;
  /** Il giorno delle partite raccontate (YYYY-MM-DD). */
  day: string;
  hosts: Record<StudioWho, string>;
  audio: string;
  duration: number;
  screens: StudioScreen[];
  shots: { t: number; cam: StudioCam; screen: number }[];
  lines: StudioLine[];
  props: { t: number; who: StudioWho; act: "foglio" }[];
}

/** La puntata più recente: /studio/ultima.json dice quale. */
export const STUDIO_LATEST = "/studio/ultima.json";
export const studioUrl = (id: string) => `/studio/${id}.json`;

/** Lo studio è disegnato su 390×844: le inquadrature sono uno zoom su questo spazio. */
export const STAGE = { w: 390, h: 844 };
/** Il maxischermo dentro lo studio (le grafiche sono disegnate a 330×400 e poi rimpicciolite). */
export const SCREEN = { x: 95, y: 138, w: 200, h: 242, nativeW: 330, nativeH: 400 };

interface Cam {
  s: number;
  x: number;
  y: number;
}
/** Dove punta la telecamera: un punto dello studio che va al centro, e quanto zoom. */
// vy: dove cade il punto nello schermo del telefono. Tutto sta tra la barra in alto (~80)
// e i sottotitoli in basso (~630), così niente finisce sotto le scritte.
const CAMS: Record<StudioCam, { fx: number; fy: number; s: number; vy: number }> = {
  ampio: { fx: 195, fy: 440, s: 0.92, vy: 372 },
  coppia: { fx: 195, fy: 545, s: 1.12, vy: 410 },
  lei: { fx: 112, fy: 520, s: 1.75, vy: 370 },
  lui: { fx: 278, fy: 520, s: 1.75, vy: 370 },
  schermo: {
    fx: SCREEN.x + SCREEN.w / 2,
    fy: SCREEN.y + SCREEN.h / 2,
    s: 1.9,
    vy: 360,
  },
};
const camOf = (c: StudioCam): Cam => {
  const k = CAMS[c];
  return { s: k.s, x: STAGE.w / 2 - k.fx * k.s, y: k.vy - k.fy * k.s };
};

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

/** L'inquadratura al tempo t: un movimento morbido tra la precedente e quella attuale. */
export function cameraAt(show: Pick<StudioShow, "shots">, t: number): Cam {
  const shots = show.shots;
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (shots[k].t <= t) i = k;
  const cur = camOf(shots[i].cam);
  const prev = i > 0 ? camOf(shots[i - 1].cam) : cur;
  // Verso il maxischermo e indietro ci si muove un po' più piano, come una gru.
  const toScreen = shots[i].cam === "schermo" || shots[i - 1]?.cam === "schermo";
  const dur = toScreen ? 0.9 : 0.6;
  const u = ease(Math.min(1, Math.max(0, (t - shots[i].t) / dur)));
  // Una spinta lentissima in avanti mentre l'inquadratura resta ferma: niente fotogrammi immobili.
  const push = 1 + 0.025 * Math.min(1, Math.max(0, (t - shots[i].t - dur) / 8));
  const s = (prev.s + (cur.s - prev.s) * u) * push;
  const x = prev.x + (cur.x - prev.x) * u;
  const y = prev.y + (cur.y - prev.y) * u;
  // Con la spinta il centro resta fermo.
  const cx = STAGE.w / 2;
  const cy = CAMS[shots[i].cam].vy;
  return { s, x: cx - (cx - x) * push, y: cy - (cy - y) * push };
}

/** Quale grafica c'è sul maxischermo al tempo t, e da quando c'è. */
export function screenAt(show: Pick<StudioShow, "shots">, t: number): { index: number; since: number } {
  let index = show.shots[0]?.screen ?? 0;
  for (const s of show.shots) if (s.t <= t) index = s.screen;
  const first = show.shots.find((s) => s.screen === index);
  return { index, since: first?.t ?? 0 };
}

/** La battuta in corso (o null nelle pause). */
export function lineAt(show: Pick<StudioShow, "lines">, t: number): StudioLine | null {
  for (const l of show.lines) if (t >= l.t && t < l.t + l.d) return l;
  return null;
}

/** L'ultima battuta iniziata, anche se è finita da poco (i sottotitoli restano un attimo). */
export function captionAt(show: Pick<StudioShow, "lines">, t: number): StudioLine | null {
  let last: StudioLine | null = null;
  for (const l of show.lines) if (l.t <= t) last = l;
  return last && t < last.t + last.d + 0.6 ? last : null;
}

/** Quanto è aperta la bocca di chi parla (0-1), dalla voce vera. */
export function mouthAt(line: StudioLine | null, who: StudioWho, t: number): number {
  if (!line || line.who !== who) return 0;
  const f = Math.floor((t - line.t) * 30);
  const c = line.mouth.charCodeAt(Math.max(0, Math.min(line.mouth.length - 1, f))) - 48;
  return Math.max(0, Math.min(1, c / 9));
}

/** Gli occhi si chiudono ogni tanto, in momenti diversi per i due (deterministico). */
export function blinkAt(who: StudioWho, t: number): number {
  const period = who === "lui" ? 3.9 : 4.6;
  const phase = (t + (who === "lui" ? 0.7 : 2.1)) % period;
  return phase < 0.13 ? Math.abs(phase - 0.065) / 0.065 : 1;
}

/** Il braccio che alza il foglio degli appunti: sale, resta un attimo, torna giù. */
export function armAt(show: Pick<StudioShow, "props">, who: StudioWho, t: number): number {
  for (const p of show.props) {
    if (p.who !== who) continue;
    const u = t - p.t;
    if (u < 0 || u > 2.6) continue;
    if (u < 0.5) return ease(u / 0.5);
    if (u < 2.0) return 1;
    return 1 - ease((u - 2.0) / 0.6);
  }
  return 0;
}

/** Dove guarda: chi parla guarda in camera, chi ascolta guarda chi parla. */
export function lookAt(line: StudioLine | null, who: StudioWho, t: number): number {
  const toOther = who === "lei" ? 1 : -1;
  if (!line) return toOther * 0.35;
  if (line.who === who) {
    // All'inizio della battuta un'occhiata al collega, poi in camera.
    const u = t - line.t;
    return u < 0.6 ? toOther * 0.6 * (1 - u / 0.6) : 0;
  }
  return toOther;
}

/** Le parti della puntata per la barra in alto (una per grafica). */
export function chapters(show: StudioShow): { t: number; end: number }[] {
  const starts: number[] = [];
  let last = -1;
  for (const s of show.shots)
    if (s.screen !== last) {
      starts.push(s.t);
      last = s.screen;
    }
  return starts.map((t, i) => ({ t, end: starts[i + 1] ?? show.duration }));
}
