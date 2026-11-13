/**
 * Studio Campetto: lo show di un paio di minuti dopo una giornata di partite, con due
 * presentatori in studio, le grafiche sul maxischermo e i canestri della serata.
 *
 * La puntata è un file JSON (con il suo audio) preparato dopo aver caricato le statistiche:
 * battute con i tempi e l'apertura della bocca, inquadrature, grafiche. Tutto quello che si
 * vede è una funzione del tempo, così il player può fermarsi, tornare indietro o saltare
 * avanti di 10 secondi come un reel.
 */

export type StudioCam = "ampio" | "coppia" | "trio" | "lui" | "lei" | "ospite" | "schermo" | "replay" | "fine";
/** I due conduttori. */
export type StudioHost = "lui" | "lei";
/** Chi parla: i conduttori o l'ospite della puntata. */
export type StudioWho = StudioHost | "ospite";

type Id = string;
/** Un riquadro con un numero: valore, etichetta, eventuale nota sotto. */
export interface StudioTile {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  note?: string;
}

export type StudioScreen =
  | { kind: "sigla" }
  | {
      kind: "risultati";
      games: { a: Id[]; b: Id[]; sa: number; sb: number }[];
      /** Dopo quale partita cambia la storia della serata (per il segno "la svolta"). */
      turn?: number;
    }
  | {
      kind: "quota";
      playerId: Id;
      kicker: string;
      value: number;
      total: number;
      unit: string;
      label: string;
      tiles: StudioTile[];
    }
  | {
      kind: "record";
      kicker: string;
      playerId: Id;
      items: { label: string; value: number; before: string }[];
    }
  | {
      kind: "serie";
      kicker: string;
      playerId: Id;
      wins: number;
      since: string;
      label: string;
    }
  | {
      kind: "giocatore";
      playerId: Id;
      kicker: string;
      big: { value: number; label: string; before?: string };
      tiles: StudioTile[];
    }
  | {
      kind: "tiro";
      kicker: string;
      rows: { playerId: Id; made: number; att: number }[];
      three?: { playerId: Id; att: number; total: number; made: number };
    }
  | {
      kind: "elo";
      kicker: string;
      rows: { playerId: Id; rank: number; before: number; after: number; delta: number }[];
    }
  | {
      kind: "replay";
      clips: {
        src: string;
        from: number;
        to: number;
        game: number;
        t: number;
        /**
         * La regia del replay: [secondo della clip, centro x, larghezza visibile, centro y] in
         * frazioni del video. Segue canestro e giocatori e allarga solo quanto serve.
         */
        cam?: [number, number, number, number][];
      }[];
    }
  | { kind: "numeri"; kicker: string; tiles: StudioTile[] }
  /** Grafico a torta: come si dividono i punti (o altro) tra i giocatori. */
  | {
      kind: "torta";
      kicker: string;
      title: string;
      unit: string;
      slices: { playerId: Id; value: number }[];
    }
  /**
   * Le coppie: barre con la percentuale di vittorie insieme. "top" e "flop" mettono in risalto la
   * migliore e la peggiore, con la loro etichetta.
   */
  | {
      kind: "coppie";
      kicker: string;
      title: string;
      note?: string;
      rows: { a: Id; b: Id; w: number; g: number; tag?: string; tone?: "top" | "flop" }[];
    }
  /**
   * La forma: la valutazione a partita (punti + rimbalzi + assist + recuperi + stoppate, meno
   * tiri sbagliati e palle perse, come nell'app) della serata contro la media di prima, per
   * vedere chi sta migliorando e chi peggiorando. before null = prima volta (esordio).
   */
  | {
      kind: "forma";
      kicker: string;
      title: string;
      note?: string;
      rows: { playerId: Id; before: number | null; now: number }[];
    }
  /**
   * L'intesa di un giocatore: quanto vince con ciascun compagno, contro la sua media (la linea).
   */
  | {
      kind: "intesa";
      kicker: string;
      playerId: Id;
      avg: number;
      rows: { playerId: Id; w: number; g: number }[];
    };

export interface StudioLine {
  who: StudioWho;
  t: number;
  d: number;
  text: string;
  /** Apertura della bocca, 30 cifre (0-9) al secondo. */
  mouth: string;
  /** Le parole con inizio e fine (secondi dall'inizio della battuta), per i sottotitoli. */
  words: [string, number, number][];
}

/**
 * L'ospite della puntata: un giocatore delle ultime partite che entra in studio con la sua
 * sedia, si siede tra i conduttori, risponde alle domande e poi saluta ed esce.
 */
export interface StudioGuest {
  playerId: Id;
  name: string;
  /** Quando entra da destra camminando. */
  enter: number;
  /** Quando è seduto. */
  sit: number;
  /** Quando si alza per andare. */
  rise: number;
  /** Quando è uscito. */
  exit: number;
}

export interface StudioShow {
  v: 2;
  id: string;
  /** Il giorno delle partite raccontate (YYYY-MM-DD). */
  day: string;
  hosts: Record<StudioHost, string>;
  audio: string;
  duration: number;
  /** Quanto dura la sigla iniziale. */
  intro: number;
  /** Da quando c'è la scheda finale, e la prossima partita annunciata. */
  outro: { t: number; next?: { startsAt: string; place?: string } | null };
  credits: string;
  screens: StudioScreen[];
  shots: { t: number; cam: StudioCam; screen: number }[];
  lines: StudioLine[];
  props: { t: number; who: StudioHost; act: "foglio" }[];
  guest?: StudioGuest | null;
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

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

/** Di quanto si allargano i conduttori quando c'è l'ospite al centro (px dello studio). */
export const GUEST_SPREAD = 34;
/** Da dove entra l'ospite: fuori scena a destra, rispetto al posto al centro. */
const GUEST_FROM = 280;

/**
 * Dove è l'ospite al tempo t. x: quanto è spostato a destra rispetto al suo posto (0 = seduto
 * al centro); seat: 0 in piedi, 1 seduto; apart: quanto si sono allargati i conduttori (0-1);
 * walk: la fase del passo mentre cammina (per il dondolio); on: se è in scena.
 */
export function guestAt(show: Pick<StudioShow, "guest">, t: number): { on: boolean; x: number; seat: number; apart: number; walk: number; dir: -1 | 0 | 1 } {
  const g = show.guest;
  const off = { on: false, x: GUEST_FROM, seat: 0, apart: 0, walk: 0, dir: 0 as const };
  if (!g || t < g.enter || t > g.exit) return off;
  // I conduttori fanno spazio mentre lui arriva, e si richiudono mentre esce.
  const apart = Math.min(clamp01((t - g.enter) / 1.0), 1 - clamp01((t - (g.exit - 1.0)) / 1.0));
  const walkIn = g.sit - 0.55 - g.enter;
  if (t < g.sit - 0.55) {
    const u = clamp01((t - g.enter) / walkIn);
    return { on: true, x: GUEST_FROM * (1 - (1 - Math.pow(1 - u, 2))), seat: 0, apart: ease(apart), walk: (t - g.enter) * 2.6, dir: -1 };
  }
  if (t < g.sit) return { on: true, x: 0, seat: ease((t - (g.sit - 0.55)) / 0.55), apart: ease(apart), walk: 0, dir: 0 };
  if (t < g.rise) return { on: true, x: 0, seat: 1, apart: ease(apart), walk: 0, dir: 0 };
  if (t < g.rise + 0.45) return { on: true, x: 0, seat: 1 - ease((t - g.rise) / 0.45), apart: ease(apart), walk: 0, dir: 0 };
  const u = clamp01((t - g.rise - 0.45) / Math.max(0.5, g.exit - g.rise - 0.45));
  return { on: true, x: GUEST_FROM * u * u, seat: 0, apart: ease(apart), walk: (t - g.rise) * 2.6, dir: 1 };
}

/** Dove punta la telecamera: un punto dello studio che va al centro, e quanto zoom. */
// vy: dove cade il punto nello schermo del telefono. Tutto sta tra la parte alta (~80)
// e i sottotitoli in basso (~600), così niente finisce sotto le scritte.
type WorldCam = Exclude<StudioCam, "replay" | "fine">;
const CAMS: Record<WorldCam, { fx: number; fy: number; s: number; vy: number }> = {
  ampio: { fx: 195, fy: 440, s: 0.92, vy: 360 },
  coppia: { fx: 195, fy: 470, s: 1.0, vy: 410 },
  trio: { fx: 195, fy: 480, s: 0.96, vy: 415 },
  lei: { fx: 112, fy: 505, s: 1.55, vy: 340 },
  lui: { fx: 278, fy: 505, s: 1.55, vy: 340 },
  ospite: { fx: 195, fy: 505, s: 1.55, vy: 340 },
  schermo: {
    fx: SCREEN.x + SCREEN.w / 2,
    fy: SCREEN.y + SCREEN.h / 2,
    s: 1.9,
    vy: 350,
  },
};
const camOf = (c: WorldCam, apart = 0): Cam => {
  const k = CAMS[c];
  // Con l'ospite in studio i primi piani dei conduttori seguono il loro posto, più largo.
  const fx = k.fx + (c === "lei" ? -GUEST_SPREAD : c === "lui" ? GUEST_SPREAD : 0) * apart;
  return { s: k.s, x: STAGE.w / 2 - fx * k.s, y: k.vy - k.fy * k.s };
};
const isWorld = (c: StudioCam): c is WorldCam => c !== "replay" && c !== "fine";

/** L'inquadratura dello studio in ogni momento (durante replay e chiusura resta l'ultima). */
function worldShot(show: Pick<StudioShow, "shots">, t: number): { i: number; cam: WorldCam } {
  let i = 0;
  for (let k = 0; k < show.shots.length; k++) if (show.shots[k].t <= t && isWorld(show.shots[k].cam)) i = k;
  return { i, cam: show.shots[i].cam as WorldCam };
}

/**
 * La telecamera al tempo t. Regia da studio TV: stacchi netti tra un'inquadratura e l'altra;
 * l'unico movimento è lo zoom che porta sul maxischermo, e lì resta finché non si stacca su
 * chi parla. All'uscita dalla sigla la telecamera si allarga sullo studio.
 */
export function cameraAt(show: Pick<StudioShow, "shots" | "intro" | "guest">, t: number): Cam {
  const { i, cam } = worldShot(show, t);
  const apart = guestAt(show, t).apart;
  let out = camOf(cam, apart);
  let prevCam: WorldCam | null = null;
  for (let k = i - 1; k >= 0; k--)
    if (isWorld(show.shots[k].cam)) {
      prevCam = show.shots[k].cam as WorldCam;
      break;
    }
  if (cam === "schermo" && prevCam && prevCam !== "schermo") {
    const prev = camOf(prevCam, apart);
    const u = ease(clamp01((t - show.shots[i].t) / 0.85));
    out = { s: prev.s + (out.s - prev.s) * u, x: prev.x + (out.x - prev.x) * u, y: prev.y + (out.y - prev.y) * u };
  }
  // Uscendo dalla sigla la telecamera si allarga sullo studio, solo sull'inquadratura larga.
  const r = clamp01((t - (show.intro - 0.5)) / 1.3);
  if (r < 1 && (cam === "ampio" || cam === "coppia" || cam === "trio")) {
    const k = 1.12 - 0.12 * ease(r);
    const vy = CAMS[cam].vy;
    out = { s: out.s * k, x: STAGE.w / 2 - (STAGE.w / 2 - out.x) * k, y: vy - (vy - out.y) * k };
  }
  return out;
}

/**
 * Dove sta il maxischermo nello schermo del telefono a zoom finito: lì si appoggia la grafica
 * "a tutto schermo" che lo sostituisce (niente presentatori dietro i sottotitoli).
 */
export function screenRect(): { x: number; y: number; w: number; h: number } {
  const c = camOf("schermo");
  return { x: c.x + SCREEN.x * c.s, y: c.y + SCREEN.y * c.s, w: SCREEN.w * c.s, h: SCREEN.h * c.s };
}

/** La grafica copre lo studio: siamo sul maxischermo e lo zoom è finito (o non c'era). */
export function fullScreenAt(show: Pick<StudioShow, "shots">, t: number): boolean {
  const { i, cam } = worldShot(show, t);
  if (cam !== "schermo") return false;
  let prevCam: StudioCam | null = null;
  for (let k = i - 1; k >= 0; k--)
    if (isWorld(show.shots[k].cam)) {
      prevCam = show.shots[k].cam;
      break;
    }
  return prevCam === "schermo" || t - show.shots[i].t >= 0.8;
}

/** In che modalità è il player: sigla, studio, replay a tutto schermo o scheda finale. */
export function modeAt(show: Pick<StudioShow, "shots" | "intro" | "outro">, t: number): "sigla" | "studio" | "replay" | "fine" {
  if (t < show.intro) return "sigla";
  if (t >= show.outro.t) return "fine";
  let cam: StudioCam = "ampio";
  for (const s of show.shots) if (s.t <= t) cam = s.cam;
  return cam === "replay" ? "replay" : "studio";
}

/** Il canestro in onda durante il replay: quale clip e a che punto. */
export function replayAt(show: Pick<StudioShow, "screens" | "shots">, t: number): { screen: number; clip: number; local: number } | null {
  const { index } = screenAt(show, t);
  const scr = show.screens[index];
  if (!scr || scr.kind !== "replay") return null;
  let clip = 0;
  scr.clips.forEach((c, k) => {
    if (t >= c.t) clip = k;
  });
  const c = scr.clips[clip];
  return { screen: index, clip, local: Math.min(c.to - c.from, Math.max(0, t - c.t)) };
}

/**
 * La regia del replay a un certo punto della clip: centro e larghezza visibile (frazioni del
 * video). Senza regia si vede tutto il campo.
 */
export function replayFrame(clip: { cam?: [number, number, number, number][] }, local: number): { cx: number; w: number; cy: number } {
  const k = clip.cam;
  if (!k?.length) return { cx: 0.5, w: 1, cy: 0.5 };
  if (local <= k[0][0]) return { cx: k[0][1], w: k[0][2], cy: k[0][3] };
  for (let i = 1; i < k.length; i++)
    if (local <= k[i][0]) {
      const u = (local - k[i - 1][0]) / Math.max(1e-6, k[i][0] - k[i - 1][0]);
      return {
        cx: k[i - 1][1] + (k[i][1] - k[i - 1][1]) * u,
        w: k[i - 1][2] + (k[i][2] - k[i - 1][2]) * u,
        cy: k[i - 1][3] + (k[i][3] - k[i - 1][3]) * u,
      };
    }
  const l = k[k.length - 1];
  return { cx: l[1], w: l[2], cy: l[3] };
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

export interface CaptionPage {
  /** Indici delle parole della battuta. */
  from: number;
  to: number;
  s: number;
  e: number;
}

/** Divide una battuta in pagine da 1-3 parole (massimo ~16 lettere), spezzando sulla punteggiatura. */
export function captionPages(line: Pick<StudioLine, "words" | "d">): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let start = 0;
  let chars = 0;
  line.words.forEach(([w], i) => {
    chars += w.length + (i > start ? 1 : 0);
    const next = line.words[i + 1];
    const stop = /[.,:;!?]$/.test(w) || !next || i - start >= 2 || chars + (next?.[0].length ?? 0) + 1 > 16;
    if (stop) {
      pages.push({ from: start, to: i, s: line.words[start][1], e: line.words[i][2] });
      start = i + 1;
      chars = 0;
    }
  });
  // Ogni pagina resta fino all'inizio della successiva (niente buchi), l'ultima fino a fine battuta.
  pages.forEach((p, k) => (p.e = pages[k + 1]?.s ?? line.d + 0.25));
  return pages;
}

/** Il sottotitolo del momento: la pagina e la parola in corso. */
export function captionAt(show: Pick<StudioShow, "lines">, t: number): { line: StudioLine; page: CaptionPage; active: number } | null {
  let line: StudioLine | null = null;
  for (const l of show.lines) if (l.t <= t) line = l;
  if (!line || t > line.t + line.d + 0.25 || !line.words?.length) return null;
  const u = t - line.t;
  const pages = captionPages(line);
  const page = pages.find((p) => u >= p.s && u < p.e) ?? (u < pages[0].s ? null : pages[pages.length - 1]);
  if (!page) return null;
  let active = page.from;
  for (let k = page.from; k <= page.to; k++) if (u >= line.words[k][1]) active = k;
  return { line, page, active };
}

/** Quanto è aperta la bocca di chi parla (0-1), dalla voce vera. */
export function mouthAt(line: StudioLine | null, who: StudioWho, t: number): number {
  if (!line || line.who !== who) return 0;
  const f = Math.floor((t - line.t) * 30);
  const c = line.mouth.charCodeAt(Math.max(0, Math.min(line.mouth.length - 1, f))) - 48;
  return Math.max(0, Math.min(1, c / 9));
}

/** Gli occhi si chiudono ogni tanto, in momenti diversi per i due (deterministico). */
export function blinkAt(who: StudioHost, t: number): number {
  const period = who === "lui" ? 3.9 : 4.6;
  const phase = (t + (who === "lui" ? 0.7 : 2.1)) % period;
  return phase < 0.13 ? Math.abs(phase - 0.065) / 0.065 : 1;
}

/** Il braccio che alza il foglio degli appunti: sale, resta un attimo, torna giù. */
export function armAt(show: Pick<StudioShow, "props">, who: StudioHost, t: number): number {
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

/**
 * Dove guarda: chi parla guarda in camera, chi ascolta guarda chi parla. Con l'ospite in studio
 * i conduttori guardano lui (al centro), anche quando gli fanno una domanda.
 */
export function lookAt(line: StudioLine | null, who: StudioHost, t: number, guest = false): number {
  const toOther = who === "lei" ? 1 : -1;
  if (guest) return line?.who === who ? toOther * 0.75 : toOther;
  if (!line) return toOther * 0.35;
  if (line.who === who) {
    // All'inizio della battuta un'occhiata al collega, poi in camera.
    const u = t - line.t;
    return u < 0.6 ? toOther * 0.6 * (1 - u / 0.6) : 0;
  }
  return toOther;
}

/** Le parti della puntata per la barra in alto: sigla, una per grafica, chiusura. */
export function chapters(show: StudioShow): { t: number; end: number }[] {
  const starts: number[] = [0, show.intro];
  let last = -1;
  for (const s of show.shots)
    if (s.screen !== last && s.t > show.intro + 0.5) {
      starts.push(s.t);
      last = s.screen;
    } else if (s.screen !== last) last = s.screen;
  if (show.outro.t > starts[starts.length - 1] + 0.5) starts.push(show.outro.t);
  return starts.map((t, i) => ({ t, end: starts[i + 1] ?? show.duration }));
}
