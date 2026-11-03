/**
 * La telecamera della partita: un vero 3D in prospettiva, fatto a mano (niente
 * librerie pesanti). Il campo, il canestro, il pallone e il pubblico sono punti
 * nello spazio, in metri; la telecamera li proietta sullo schermo. I personaggi
 * restano i disegni dell'app, in piedi sul parquet e più grandi quando sono vicini.
 *
 * Il campo (metà campo, regole FIBA): x da −7,5 a 7,5 (larghezza 15 m), z da 0
 * (linea di fondo, sotto il canestro) a 14 (metà campo), y in alto.
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: V3, b: V3): V3 => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const norm = (a: V3): V3 => {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return v3(a.x / l, a.y / l, a.z / l);
};
export const lerp3 = (a: V3, b: V3, t: number): V3 => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export interface Camera {
  pos: V3;
  target: V3;
  /** Campo visivo orizzontale, in gradi. */
  fov: number;
  w: number;
  h: number;
  /** Dove cade il centro dell'inquadratura in altezza (0,5 = a metà). */
  cy?: number;
}

export interface Projector {
  cam: Camera;
  /** Il punto sullo schermo (px) e quanti px vale un metro lì. depth ≤ 0: dietro la telecamera. */
  p: (P: V3) => { x: number; y: number; s: number; depth: number };
  key: string;
}

export function projector(cam: Camera): Projector {
  const F = norm(sub(cam.target, cam.pos));
  const R = norm(cross(F, v3(0, 1, 0)));
  const U = cross(R, F);
  const f = cam.w / 2 / Math.tan(((cam.fov / 2) * Math.PI) / 180);
  const cy = (cam.cy ?? 0.5) * cam.h;
  return {
    cam,
    key: `${cam.pos.x.toFixed(2)},${cam.pos.y.toFixed(2)},${cam.pos.z.toFixed(2)}|${cam.target.x.toFixed(2)},${cam.target.y.toFixed(2)},${cam.target.z.toFixed(2)}|${cam.fov}|${cam.w}x${cam.h}`,
    p: (P) => {
      const d = sub(P, cam.pos);
      const depth = dot(d, F);
      const z = Math.max(0.05, depth);
      return { x: cam.w / 2 + (f * dot(d, R)) / z, y: cy - (f * dot(d, U)) / z, s: f / z, depth };
    },
  };
}

// ———————————— Il campo ————————————

export const COURT = {
  halfW: 7.5,
  len: 14,
  /** Il centro del ferro: 1,575 m dalla linea di fondo, a 3,05 m. */
  rim: v3(0, 3.05, 1.575),
  rimR: 0.23,
  board: { z: 1.2, w: 1.8, bottom: 2.9, top: 3.95 },
  key: { halfW: 2.45, len: 5.8 },
  ftR: 1.8,
  three: { r: 6.75, cornerX: 6.6 },
  restricted: 1.25,
} as const;

/** L'altezza dei personaggi in campo (cartoni: testa grande). */
export const PLAYER_H = 2.35;

/** Un punto a terra. */
export const floor = (x: number, z: number) => v3(x, 0, z);

/** Il punto tra un attaccante e il canestro, a `d` metri da lui: dove si mette il difensore. */
export function guardSpot(att: { x: number; z: number }, d = 1.3) {
  const bx = COURT.rim.x - att.x;
  const bz = COURT.rim.z - att.z;
  const l = Math.hypot(bx, bz) || 1;
  return { x: att.x + (bx / l) * d, z: att.z + (bz / l) * d };
}

/** Le linee del campo, come spezzate di punti a terra. */
export function courtLines(): V3[][] {
  const L: V3[][] = [];
  const { halfW, len, rim, key, ftR, three, restricted } = COURT;
  const seg = (pts: [number, number][]) => L.push(pts.map(([x, z]) => floor(x, z)));
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number, n = 32) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cz + r * Math.sin(a)]);
    }
    return pts;
  };
  // Perimetro (fondo, laterali, metà campo).
  seg([
    [-halfW, 0],
    [halfW, 0],
    [halfW, len],
    [-halfW, len],
    [-halfW, 0],
  ]);
  // Area.
  seg([
    [-key.halfW, 0],
    [-key.halfW, key.len],
    [key.halfW, key.len],
    [key.halfW, 0],
  ]);
  // Lunetta del tiro libero.
  seg(arc(0, key.len, ftR, 0, Math.PI, 28));
  // Linea da tre: i due tratti dritti negli angoli e l'arco.
  const zc = rim.z + Math.sqrt(three.r ** 2 - three.cornerX ** 2);
  const a0 = Math.atan2(zc - rim.z, three.cornerX);
  seg([
    [-three.cornerX, 0],
    [-three.cornerX, zc],
  ]);
  seg([
    [three.cornerX, 0],
    [three.cornerX, zc],
  ]);
  seg(arc(rim.x, rim.z, three.r, a0, Math.PI - a0, 48));
  // Semicerchio sotto canestro.
  seg(arc(rim.x, rim.z, restricted, 0, Math.PI, 16));
  // Cerchio di centrocampo (metà).
  seg(arc(0, len, ftR, Math.PI, 2 * Math.PI, 24));
  return L;
}

// ———————————— Le inquadrature ————————————

/** Dall'alto, tutta la metà campo: per la telecronaca. */
export function wideCam(w: number, h: number): Camera {
  // In verticale (telefono) serve più campo visivo per avere tutta la larghezza.
  const fov = w / h < 0.8 ? 66 : 56;
  return { pos: v3(0, 6.6, 12.8), target: v3(0, 1.0, 4.4), fov, w, h, cy: 0.5 };
}

/**
 * Alle spalle di chi ha la palla, che guarda verso il canestro: per i tuoi momenti.
 * Dagli angoli la telecamera non può stare dietro (ci sono gli spalti): si sposta verso
 * il centro e inquadra un po' di sbieco, così in quadro ci sono il giocatore e il ferro.
 */
export function actionCam(focus: { x: number; z: number }, w: number, h: number): Camera {
  const { rim } = COURT;
  const dx = focus.x - rim.x;
  const dz = focus.z - rim.z;
  const l = Math.hypot(dx, dz) || 1;
  let ux = (dx / l) * 0.42;
  let uz = (dz / l) * 0.42 + 0.58;
  const ul = Math.hypot(ux, uz);
  ux /= ul;
  uz /= ul;
  const back = Math.min(5.8, Math.max(4, 3.6 + 0.12 * l));
  const px = Math.max(-8.6, Math.min(8.6, focus.x + ux * back));
  // Negli angoli la mira va un po' più verso il giocatore.
  const corner = Math.min(1, Math.max(0, (Math.abs(focus.x) - 4) / 2.4)) * Math.min(1, Math.max(0, (4 - focus.z) / 2.5));
  const t = 0.42 - 0.08 * corner;
  const tall = w / h < 0.8;
  return {
    pos: v3(px, 3.1, focus.z + uz * back),
    target: v3(focus.x + (rim.x - focus.x) * t, 1.8, focus.z + (rim.z - focus.z) * t),
    fov: (tall ? 52 : 46) + 6 * corner,
    w,
    h,
    cy: tall ? 0.6 : 0.55,
  };
}

/** Di lato, a metà campo: si vede tutta la rincorsa della schiacciata fino al ferro. */
export function dunkCam(w: number, h: number): Camera {
  return { pos: v3(4.4, 2.4, 9.0), target: v3(-0.9, 2.2, 3.9), fov: w / h < 0.8 ? 60 : 50, w, h, cy: 0.55 };
}

/** Un punto spostato di lato (perpendicolare alla linea col canestro), verso il centro del campo. */
export function beside(p: { x: number; z: number }, d: number) {
  const bx = COURT.rim.x - p.x;
  const bz = COURT.rim.z - p.z;
  const l = Math.hypot(bx, bz) || 1;
  let qx = -bz / l;
  let qz = bx / l;
  if (qx * p.x > 0 || (p.x === 0 && qx < 0)) {
    qx = -qx;
    qz = -qz;
  }
  return { x: p.x + qx * d, z: p.z + qz * d };
}

/** Traiettoria a parabola tra due punti, con la cima `apex` metri sopra il più alto. */
export function arcPoints(a: V3, b: V3, apex: number, n = 22): V3[] {
  const top = Math.max(a.y, b.y) + apex;
  // y(t) = a.y + B t + C t²  passante per top a metà circa.
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = a.x + (b.x - a.x) * t;
    const z = a.z + (b.z - a.z) * t;
    // Bézier quadratico in altezza col punto di controllo a 2·top − (a+b)/2.
    const c = 2 * top - (a.y + b.y) / 2;
    const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c + t * t * b.y;
    pts.push(v3(x, y, z));
  }
  return pts;
}
