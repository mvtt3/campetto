/**
 * I personaggi di Campetto in 3D, come statuine di vinile, con tutto quello che si può
 * indossare. Disegnati nel codice: si scarica pochissimo (solo le texture della testa e
 * dei palloni) e ogni oggetto cambia davvero la sagoma del personaggio.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Look, Slot } from "@/lib/pass/catalog";

export type Preset =
  | "jack" | "kenji" | "bomber" | "fernando" | "lukas" | "giacomo" | "kofi" | "ventosa"
  | "cecchino" | "regista" | "muro" | "lampo" | "jolly";
export type Outfit = Partial<Record<Exclude<Slot, "skin">, Look>>;

const INK = "#1d1a16";
const CREAM = "#fff8ea";
const RED = "#e5412d";
const YELLOW = "#ffc531";
const GREEN = "#2e9e5b";
const PURPLE = "#7c4dcc";
const TEAL = "#1597a6";
const BLUE = "#2d5be3";
const NAVY = "#1d3b66";

/* ---------------------------------------------------------------- */
/* Texture e materiali (condivisi: si creano una volta sola)         */
/* ---------------------------------------------------------------- */

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
function tex(name: string, color = true): THREE.Texture {
  let t = texCache.get(name);
  if (!t) {
    t = loader.load(`/3d/${name}.jpg`);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(name, t);
  }
  return t;
}

const ALL_TEX: [string, boolean][] = [
  ["testa-classico", true], ["testa-marrone", true], ["bump-testa", false], ["bump-pallone", false],
  ["pallone-classico", true], ["pallone-notte", true], ["pallone-neve", true], ["pallone-oro", true],
];
let ready: Promise<void> | null = null;
/** Carica una volta tutte le texture (poi restano in memoria e nella cache dell'app). */
export function preloadTextures(): Promise<void> {
  ready ??= Promise.all(
    ALL_TEX.map(async ([name, color]) => {
      if (texCache.has(name)) return;
      const t = await loader.loadAsync(`/3d/${name}.jpg`).catch(() => null);
      if (!t || texCache.has(name)) return;
      if (color) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      texCache.set(name, t);
    }),
  ).then(() => undefined);
  return ready;
}

/**
 * Sui telefoni con la scheda video debole (per esempio i Mali-G52) i materiali diventano più
 * semplici: niente secondo strato lucido, niente velluto, niente riflessi cangianti. La
 * statuina resta uguale a colpo d'occhio, ma ogni pixel costa molto meno.
 */
let lite = false;
export function setLite(v: boolean) {
  lite = v;
}
function phys(o: THREE.MeshPhysicalMaterialParameters) {
  if (lite) {
    o = { ...o, clearcoat: 0, sheen: 0, iridescence: 0 };
    // Il lucido che dava il secondo strato lo rende un po' la ruvidità.
    if (o.roughness != null) o.roughness = Math.max(0.12, o.roughness * 0.85);
  }
  return new THREE.MeshPhysicalMaterial(o);
}
const vinyl = (color: THREE.ColorRepresentation, o: THREE.MeshPhysicalMaterialParameters = {}) =>
  phys({ color, roughness: 0.38, clearcoat: 0.55, clearcoatRoughness: 0.35, ...o });
const fabric = (o: THREE.MeshPhysicalMaterialParameters = {}) =>
  phys({ roughness: 0.62, sheen: 0.4, sheenRoughness: 0.5, sheenColor: new THREE.Color("#ffffff"), ...o });

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}
/** Le tele disegnate (maglie, pantaloncini, facce) si fanno una volta sola e restano. */
const drawn = new Map<string, THREE.Texture>();
function once(key: string, make: () => THREE.Texture) {
  let t = drawn.get(key);
  if (!t) {
    t = make();
    drawn.set(key, t);
  }
  return t;
}

function canvasTex(c: HTMLCanvasElement, color = true) {
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let meshBumpTex: THREE.Texture | null = null;
function meshBump() {
  if (meshBumpTex) return meshBumpTex;
  const { c, g } = canvas(64, 64);
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "#7a7a7a";
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.beginPath();
      g.arc(x * 16 + (y % 2) * 8 + 4, y * 16 + 8, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  meshBumpTex = canvasTex(c, false);
  meshBumpTex.wrapS = meshBumpTex.wrapT = THREE.RepeatWrapping;
  meshBumpTex.repeat.set(26, 10);
  return meshBumpTex;
}

let curlTex: THREE.Texture | null = null;
function curlBump() {
  if (curlTex) return curlTex;
  const { c, g } = canvas(256, 256);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  let seed = 3;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  g.lineCap = "round";
  for (let i = 0; i < 700; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 3 + rnd() * 5, a = rnd() * Math.PI * 2;
    g.strokeStyle = rnd() > 0.5 ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
    g.lineWidth = 1.4 + rnd() * 1.6;
    g.beginPath();
    g.arc(x, y, r, a, a + Math.PI * (1.1 + rnd() * 0.6));
    g.stroke();
  }
  curlTex = canvasTex(c, false);
  curlTex.wrapS = curlTex.wrapT = THREE.RepeatWrapping;
  curlTex.repeat.set(2, 1);
  return curlTex;
}

/* ---------------------------------------------------------------- */
/* I tre personaggi                                                  */
/* ---------------------------------------------------------------- */

interface FaceShape {
  d?: string;
  ellipse?: [number, number, number, number];
  fill?: string;
  stroke?: string;
  width?: number;
}

interface Spec {
  head: string;
  jersey: string;
  trim: string;
  number: string;
  numberColor: string;
  numberStroke?: string;
  shorts: string;
  shortsTrim: string;
  shoes: string;
  /** La testa nel disegno 2D: centro e raggio (ry se è allungata o schiacciata). */
  svg: { cx: number; cy: number; r: number; ry?: number };
  /** Occhi: x, y, misura, dove guarda, a mezz'asta (uno solo, per chi prende la mira). */
  eyes: [number, number, number?, number?, boolean?][];
  paint: FaceShape[];
  extra: (
    | "collana" | "occhiali" | "afro" | "fascia" | "bandana" | "fascia-alta" | "coppola" | "occhialoni"
    | "fascia-gialla" | "berretto" | "fischietto" | "fascia-lampo" | "berretto-girato"
  )[];
  /** Testa allungata o schiacciata (x, y, z), come nel disegno. */
  headScale?: [number, number, number];
  /** Gambe più lunghe (+) o più corte (−), in unità del 3D. */
  legs?: number;
  /** Braccia grosse (i muscolosi e i rimbalzisti). */
  arms?: "big";
  /** Occhi a mezz'asta, sguardo tranquillo. */
  lids?: boolean;
  /** La faccia quando festeggia (podio, coppa), per chi di suo ha la faccia seria o arrabbiata. */
  cheer?: FaceShape[];
}

const brows = (x: number, y: number, tilt: number, w = 6, gap = 8): FaceShape => ({
  d: `M${x - gap - w / 2} ${y - tilt} L${x - gap + w / 2} ${y + tilt} M${x + gap - w / 2} ${y + tilt} L${x + gap + w / 2} ${y - tilt}`,
  stroke: INK,
  width: 2.6,
});

function grin(x: number, y: number, w = 1): FaceShape[] {
  const T = (d: string) => d.replace(/(-?\d*\.?\d+) (-?\d*\.?\d+)/g, (_, a, b) => `${x + +a * w} ${y + +b}`);
  return [
    { d: T("M-11 0 Q0 13 11 0 Q0 3.5 -11 0 Z"), fill: INK, stroke: INK, width: 2 },
    { d: T("M-5.5 5.6 Q0 3.4 5.5 5.6 Q3 8.6 0 8.4 Q-3.6 8.2 -5.5 5.6 Z"), fill: RED },
    { d: T("M-12 -0.6 Q-13 -2.4 -11.6 -3.6 M12 -0.6 Q13 -2.4 11.6 -3.6"), stroke: INK, width: 1.8 },
  ];
}

export const SPECS: Record<Preset, Spec> = {
  jack: {
    head: "testa-classico", jersey: CREAM, trim: RED, number: "23", numberColor: RED,
    shorts: RED, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 48, r: 27 }, eyes: [[42, 44], [58, 44]], paint: grin(50, 58), extra: ["collana"],
  },
  kenji: {
    head: "testa-marrone", jersey: "#2d5be3", trim: CREAM, number: "11", numberColor: CREAM,
    shorts: "#2d5be3", shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 48, r: 27 }, eyes: [[41, 45, 0.92, 1], [59, 45, 0.92, 1]],
    paint: [{ d: "M42 61 Q51 66 60 59", stroke: INK, width: 2.8 }, { d: "M59 56.6 Q61.6 58 60.4 61", stroke: INK, width: 2.2 }],
    extra: ["occhiali"],
  },
  bomber: {
    head: "testa-classico", jersey: RED, trim: CREAM, number: "30", numberColor: CREAM, numberStroke: INK,
    shorts: RED, shortsTrim: CREAM, shoes: INK,
    svg: { cx: 50, cy: 53, r: 25 }, eyes: [[42, 56, 0.92], [58, 56, 0.92]], paint: grin(50, 67, 0.92),
    extra: ["afro", "fascia"],
  },
  // Fernando: bandana rossa a pois annodata di lato, sguardo deciso e sorriso coi denti.
  fernando: {
    head: "testa-classico", jersey: YELLOW, trim: INK, number: "8", numberColor: INK,
    shorts: YELLOW, shortsTrim: INK, shoes: RED,
    svg: { cx: 50, cy: 49, r: 27 }, eyes: [[42, 48], [58, 48]],
    paint: [
      brows(50, 39.4, 1.8),
      { d: "M40 61 Q50 69 60 61 Z", fill: CREAM, stroke: INK, width: 2.4 },
      { d: "M45 61.6 V64.4 M50 62 V66 M55 61.6 V64.4", stroke: INK, width: 1.4 },
    ],
    extra: ["bandana"],
  },
  // Lukas: il più alto, testa allungata, fascia in fronte, occhi a mezz'asta.
  lukas: {
    head: "testa-classico", jersey: CREAM, trim: PURPLE, number: "33", numberColor: PURPLE,
    shorts: PURPLE, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 45, r: 22, ry: 31 }, eyes: [[43, 47], [57, 47]], lids: true,
    paint: [{ d: "M44 62 Q51 66 58 61", stroke: INK, width: 2.8 }],
    extra: ["fascia-alta"], headScale: [0.86, 1.16, 0.88], legs: 0.2,
  },
  // Giacomo: il più basso, testa schiacciata, coppola anni '30, lentiggini e risata.
  giacomo: {
    head: "testa-classico", jersey: RED, trim: CREAM, number: "5", numberColor: CREAM, numberStroke: INK,
    shorts: RED, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 56, r: 31, ry: 23 }, eyes: [[42, 55, 0.88], [58, 55, 0.88]],
    paint: [
      ...[[31, 62, 1.2], [34.5, 64.6, 1.2], [30, 66, 1.1], [69, 62, 1.2], [65.5, 64.6, 1.2], [70, 66, 1.1]].map(
        ([x, y, r]): FaceShape => ({ ellipse: [x, y, r, r], fill: "#c9500f" }),
      ),
      ...grin(50, 65, 0.92),
    ],
    extra: ["coppola"], headScale: [1.12, 0.86, 1.04], legs: -0.15,
  },
  // Kofi: il più muscoloso, braccia grosse, sopracciglia decise e baffi a manubrio.
  kofi: {
    head: "testa-classico", jersey: CREAM, trim: RED, number: "1", numberColor: RED,
    shorts: RED, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 44, r: 25 }, eyes: [[42, 41, 0.9], [58, 41, 0.9]],
    paint: [
      brows(50, 32.6, 2, 7),
      { d: "M50 53 Q42 50 36 54 Q31 57 32 52 Q30 56 35 58 Q43 59 50 55 Q57 59 65 58 Q70 56 68 52 Q69 57 64 54 Q58 50 50 53 Z", fill: INK },
      { d: "M44 61.6 Q50 63.6 56 61.6", stroke: INK, width: 2.6 },
    ],
    cheer: [
      { d: "M50 53 Q42 50 36 54 Q31 57 32 52 Q30 56 35 58 Q43 59 50 55 Q57 59 65 58 Q70 56 68 52 Q69 57 64 54 Q58 50 50 53 Z", fill: INK },
      ...grin(50, 61, 0.72),
    ],
    extra: [], headScale: [0.94, 0.94, 0.94], arms: "big",
  },
  // Ventosa: il rimbalzista, occhialoni da gioco con l'elastico e il paradenti.
  ventosa: {
    head: "testa-classico", jersey: GREEN, trim: CREAM, number: "4", numberColor: CREAM, numberStroke: INK,
    shorts: GREEN, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 49, r: 26 }, eyes: [[42, 47, 0.9], [58, 47, 0.9]],
    paint: [
      { d: "M40 60 Q50 68 60 60 Z", fill: "#7fd1a4", stroke: INK, width: 2.4 },
      { d: "M44 61.6 V64 M50 62 V65.6 M56 61.6 V64", stroke: INK, width: 1.2 },
    ],
    extra: ["occhialoni"], arms: "big",
  },
  // Cecchino: il tiratore, fascia gialla e un occhio socchiuso che prende la mira.
  cecchino: {
    head: "testa-classico", jersey: CREAM, trim: TEAL, number: "3", numberColor: TEAL,
    shorts: TEAL, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 48, r: 26 }, eyes: [[42, 49, 1, 0, true], [58, 48]],
    paint: [{ d: "M43 62 Q51 65 59 60", stroke: INK, width: 2.6 }],
    extra: ["fascia-gialla"],
  },
  // Regista: il playmaker, cappellino con la visiera blu e il fischietto al collo.
  regista: {
    head: "testa-classico", jersey: BLUE, trim: CREAM, number: "10", numberColor: CREAM,
    shorts: BLUE, shortsTrim: CREAM, shoes: RED,
    svg: { cx: 50, cy: 50, r: 26 }, eyes: [[43, 52, 0.92, -1], [59, 52, 0.92, -1]],
    paint: [...grin(51, 63, 0.85)],
    extra: ["berretto", "fischietto"],
  },
  // Muro: il difensore, braccia grosse, faccia seria e bocca dritta.
  muro: {
    head: "testa-classico", jersey: YELLOW, trim: INK, number: "21", numberColor: INK,
    shorts: YELLOW, shortsTrim: INK, shoes: RED,
    svg: { cx: 50, cy: 50, r: 26 }, eyes: [[42, 49, 0.9], [58, 49, 0.9]],
    paint: [brows(50, 40, -2.2, 7), { d: "M42 62 L58 62", stroke: INK, width: 3 }],
    cheer: grin(50, 61.5, 0.85),
    extra: [], arms: "big",
  },
  // Lampo: il più veloce, fascia blu col fulmine e gambe lunghe.
  lampo: {
    head: "testa-classico", jersey: TEAL, trim: YELLOW, number: "9", numberColor: YELLOW, numberStroke: INK,
    shorts: TEAL, shortsTrim: YELLOW, shoes: RED,
    svg: { cx: 50, cy: 49, r: 26 }, eyes: [[42, 50, 1, 1], [58, 50, 1, 1]],
    paint: [...grin(51, 62, 0.9)],
    extra: ["fascia-lampo"], legs: 0.1,
  },
  // Jolly: il tuttofare, cappellino girato, occhiolino e linguaccia.
  jolly: {
    head: "testa-classico", jersey: YELLOW, trim: PURPLE, number: "6", numberColor: PURPLE,
    shorts: YELLOW, shortsTrim: PURPLE, shoes: RED,
    svg: { cx: 50, cy: 50, r: 26 }, eyes: [[42, 50]],
    paint: [
      { d: "M53 50 Q58 46.4 63 50", stroke: INK, width: 2.8 },
      { d: "M41 61 Q51 70 61 61 Q51 64 41 61 Z", fill: INK, stroke: INK, width: 2 },
      { d: "M51 64.4 Q55 64 56 68 Q53.6 71 51 69 Z", fill: RED, stroke: INK, width: 1.4 },
    ],
    extra: ["berretto-girato"],
  },
};

/* ---------------------------------------------------------------- */
/* Geometria di aiuto                                                */
/* ---------------------------------------------------------------- */

function lathe(profile: [number, number][], segs: number, scaleZ: number) {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  const g = new THREE.LatheGeometry(curve.getPoints(32), segs, Math.PI, Math.PI * 2);
  g.scale(1, 1, scaleZ);
  g.computeVertexNormals();
  return g;
}

function onHead(R: number, yaw: number, pitch: number, out = 0) {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const p = d.clone().multiplyScalar(R + out);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  return { p, q };
}

function svgToHead(f: Spec["svg"], x: number, y: number): [number, number] {
  const X = (x - f.cx) / f.r, Y = -(y - f.cy) / (f.ry ?? f.r);
  const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, Y)));
  const yaw = Math.asin(Math.max(-0.99, Math.min(0.99, X / Math.cos(pitch))));
  return [yaw, pitch];
}

function samplePath(d: string) {
  const tk = d.match(/[MLQHVZ]|-?\d*\.?\d+/g) ?? [];
  const out: { pts: [number, number][]; closed: boolean }[] = [];
  let cur: { pts: [number, number][]; closed: boolean } | null = null;
  let pos: [number, number] = [0, 0], start: [number, number] = [0, 0], cmd = "M", i = 0;
  const num = () => parseFloat(tk[i++]);
  while (i < tk.length) {
    if (/[MLQHVZ]/.test(tk[i])) cmd = tk[i++];
    if (cmd === "M") { pos = [num(), num()]; start = pos; cur = { pts: [pos], closed: false }; out.push(cur); cmd = "L"; }
    else if (cmd === "L") { pos = [num(), num()]; cur?.pts.push(pos); }
    else if (cmd === "H") { pos = [num(), pos[1]]; cur?.pts.push(pos); }
    else if (cmd === "V") { pos = [pos[0], num()]; cur?.pts.push(pos); }
    else if (cmd === "Q") {
      const c = [num(), num()], e: [number, number] = [num(), num()], p0 = pos;
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, u = 1 - t;
        cur?.pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * e[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * e[1]]);
      }
      pos = e;
    } else if (cmd === "Z") { cur?.pts.push(start); pos = start; if (cur) cur.closed = true; }
  }
  return out;
}

const FACE = { yaw0: -1.25, yaw1: 1.25, pitch0: -1.15, pitch1: 0.85 };
function faceDecal(R: number, f: Spec["svg"], shapes: FaceShape[], key: string) {
  const map = once(`face:${key}`, () => faceTexture(f, shapes));
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.003, 40, 28, Math.PI / 2 + FACE.yaw0, FACE.yaw1 - FACE.yaw0, Math.PI / 2 - FACE.pitch1, FACE.pitch1 - FACE.pitch0),
    phys({ map, transparent: true, roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.12, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
  );
  m.renderOrder = 1;
  return m;
}

function faceTexture(f: Spec["svg"], shapes: FaceShape[]) {
  const W = 1024, H = Math.round((W * (FACE.pitch1 - FACE.pitch0)) / (FACE.yaw1 - FACE.yaw0));
  const { c, g } = canvas(W, H);
  const sx = W / (FACE.yaw1 - FACE.yaw0), sy = H / (FACE.pitch1 - FACE.pitch0);
  const px = ([x, y]: [number, number]): [number, number] => {
    const [yaw, pitch] = svgToHead(f, x, y);
    return [(yaw - FACE.yaw0) * sx, (FACE.pitch1 - pitch) * sy];
  };
  g.lineJoin = g.lineCap = "round";
  for (const sh of shapes) {
    let d = sh.d ?? "";
    if (sh.ellipse) {
      const [ex, ey, rx, ry] = sh.ellipse;
      d = "M" + Array.from({ length: 41 }, (_, k) => { const a = (k / 40) * Math.PI * 2; return `${ex + Math.cos(a) * rx} ${ey + Math.sin(a) * ry}`; }).join(" L") + " Z";
    }
    g.beginPath();
    for (const sub of samplePath(d)) {
      sub.pts.forEach((p, k) => (k ? g.lineTo(...px(p)) : g.moveTo(...px(p))));
      if (sub.closed) g.closePath();
    }
    if (sh.fill) { g.fillStyle = sh.fill; g.fill(); }
    if (sh.stroke) { g.strokeStyle = sh.stroke; g.lineWidth = ((sh.width ?? 2) / f.r) * sx; g.stroke(); }
  }
  return canvasTex(c);
}

function eye(R: number, f: Spec["svg"], x: number, y: number, s = 1, look = 0, lid = false) {
  const [yaw, pitch] = svgToHead(f, x, y);
  // Su una testa allungata o schiacciata l'occhio resta della misura del disegno.
  const k = (R / f.r) * s, ky = (R / (f.ry ?? f.r)) * s;
  const g = new THREE.Group();
  const { p, q } = onHead(R, yaw, pitch, -0.012);
  g.position.copy(p);
  g.quaternion.copy(q);
  const white = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), vinyl(CREAM, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06 }));
  white.scale.set(5.6 * k, 7.4 * ky, 0.065);
  const drop = lid ? 2.2 : 1;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), vinyl("#141110", { roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 }));
  pupil.scale.set(3 * k, 4.5 * ky, 0.03);
  pupil.position.set(look * 1.4 * k, -drop * ky, 0.048);
  const shine = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }));
  shine.scale.set(1.1 * k, 1.3 * ky, 0.01);
  shine.position.set(look * 1.4 * k + 1.3 * k, -drop * ky + 1.9 * ky, 0.076);
  g.add(white, pupil, shine);
  if (lid) {
    // La palpebra: mezza calotta del colore della palla, con la riga scura sul bordo.
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      vinyl("#f26a1b", { roughness: 0.55, clearcoat: 0.3 }),
    );
    cap.scale.set(6.4 * k, 8.4 * ky, 0.078);
    cap.position.set(0, -1 * ky, 0);
    const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 11.4 * k, 4, 8), vinyl(INK, { roughness: 0.3 }));
    line.rotation.z = Math.PI / 2;
    line.position.set(0, -1 * ky, 0.07);
    g.add(cap, line);
  }
  return g;
}

function tubeOnHead(R: number, pts: [number, number, number][], radius: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([yw, pt, o]) => onHead(R, yw, pt, o).p));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat);
}

function star(r1: number, r2: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/* ---------------------------------------------------------------- */
/* Tele dei vestiti                                                  */
/* ---------------------------------------------------------------- */

function jerseyTexture(s: Spec, number: string) {
  const W = 1024, H = 512;
  const { c, g } = canvas(W, H);
  g.fillStyle = s.jersey;
  g.fillRect(0, 0, W, H);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "rgba(255,255,255,0.06)");
  grd.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = s.trim;
  g.fillRect(0, 0, W, 23);
  for (const u of [0.25, 0.75]) {
    g.fillRect(u * W - 35, 60, 13, H - 80);
    g.fillRect(u * W + 22, 60, 13, H - 80);
  }
  const num = (x: number, size: number) => {
    g.font = `900 ${size}px "DM Sans", system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    if (s.numberStroke) {
      g.lineWidth = size * 0.09;
      g.strokeStyle = s.numberStroke;
      g.strokeText(number, x, H * 0.66);
    }
    g.fillStyle = s.numberColor;
    g.fillText(number, x, H * 0.66);
  };
  num(W * 0.5, 145);
  num(0, 190);
  num(W, 190);
  return canvasTex(c);
}

function shortsTexture(color: string, trim: string, pattern?: "renna") {
  const W = 512, H = 256;
  const { c, g } = canvas(W, H);
  g.fillStyle = color;
  g.fillRect(0, 0, W, H);
  if (pattern === "renna") {
    // Fiocchi di neve sparsi.
    g.fillStyle = "rgba(255,248,234,0.85)";
    for (let i = 0; i < 46; i++) {
      const x = (i * 97) % W, y = 30 + ((i * 53) % (H - 80));
      g.beginPath();
      g.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
      g.fill();
    }
  }
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, "rgba(255,255,255,0.08)");
  grd.addColorStop(1, "rgba(0,0,0,0.14)");
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.fillStyle = trim;
  g.fillRect(0, H - (pattern ? 44 : 30), W, pattern ? 30 : 15);
  g.fillRect(0, 0, W, 17);
  g.globalCompositeOperation = "destination-out";
  for (const u of [0, 0.5, 1]) {
    g.beginPath();
    g.moveTo(u * W - 35, H);
    g.lineTo(u * W, H * 0.42);
    g.lineTo(u * W + 35, H);
    g.closePath();
    g.fill();
  }
  return canvasTex(c);
}

/** Il maglione di Natale: rosso, fasce a zig-zag, fiocchi e alberelli. */
function sweaterTexture() {
  const W = 1024, H = 512;
  const { c, g } = canvas(W, H);
  g.fillStyle = "#c8261b";
  g.fillRect(0, 0, W, H);
  const band = (y: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 32) g.lineTo(x, y + (x / 32) % 2 * 18);
    g.lineTo(W, y + 30);
    for (let x = W; x >= 0; x -= 32) g.lineTo(x, y + 30 + (x / 32) % 2 * 18);
    g.closePath();
    g.fill();
  };
  band(60, CREAM);
  band(380, CREAM);
  g.fillStyle = "#1f7a4a";
  g.fillRect(0, 118, W, 14);
  g.fillRect(0, 352, W, 14);
  // Alberelli e fiocchi in mezzo.
  for (let i = 0; i < 8; i++) {
    const x = 64 + i * 128;
    if (i % 2) {
      g.strokeStyle = CREAM;
      g.lineWidth = 6;
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        g.beginPath();
        g.moveTo(x - Math.cos(a) * 34, 240 - Math.sin(a) * 34);
        g.lineTo(x + Math.cos(a) * 34, 240 + Math.sin(a) * 34);
        g.stroke();
      }
    } else {
      g.fillStyle = "#1f7a4a";
      g.beginPath();
      g.moveTo(x, 190);
      g.lineTo(x + 38, 290);
      g.lineTo(x - 38, 290);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffc531";
      g.beginPath();
      g.arc(x, 186, 9, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Coste in basso e al collo.
  g.fillStyle = "#9e1c14";
  g.fillRect(0, 0, W, 22);
  g.fillRect(0, H - 34, W, 34);
  return canvasTex(c);
}

function stripesTexture(a: string, b: string) {
  const { c, g } = canvas(128, 128);
  g.fillStyle = a;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = b;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 16, 0);
    g.lineTo(i + 16 + 128, 128);
    g.lineTo(i + 128, 128);
    g.closePath();
    g.fill();
  }
  const t = canvasTex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 2);
  return t;
}

/* La sneaker bassa: forme condivise da tutte le scarpe (si calcolano una volta). */
const SHOE = { heel: -0.29, toe: 0.3, floor: 0.05, w: 0.138 };
/** Altezza della tomaia lungo la scarpa (z avanti): tallone, caviglia, collo del piede, punta. */
const SHOE_TOP: [number, number][] = [[-0.3, 0.19], [-0.26, 0.226], [-0.18, 0.208], [-0.1, 0.198], [-0.02, 0.212], [0.06, 0.198], [0.14, 0.17], [0.22, 0.145], [0.3, 0.12]];
function shoeTop(z: number) {
  const p = SHOE_TOP;
  if (z <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (z <= p[i][0]) {
      const t = (z - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      const k = (1 - Math.cos(t * Math.PI)) / 2;
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k;
    }
  }
  return p[p.length - 1][1];
}
/** Quanto è larga la scarpa vista da sopra (0 in punta e al tallone, 1 al centro): tonda alle estremità. */
const shoeWidth = (u: number) => Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(u), 3.2)));
let shoeGeo: { upper: THREE.BufferGeometry; sole: THREE.BufferGeometry } | null = null;
function shoeGeometry() {
  if (shoeGeo) return shoeGeo;
  const L = (SHOE.toe - SHOE.heel) / 2, zc = (SHOE.toe + SHOE.heel) / 2;
  // Tomaia: una sfera fitta modellata a scarpa, così è liscia ovunque (niente spigoli o buchi).
  const upper = new THREE.SphereGeometry(1, 40, 32);
  const pos = upper.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getY(i);
    const px = pos.getX(i), pz = pos.getZ(i);
    const r = Math.hypot(px, pz);
    const c = r > 1e-6 ? px / r : 0;
    const sn = r > 1e-6 ? pz / r : 0;
    const z = zc + L * u;
    const hw = SHOE.w * shoeWidth(u);
    const ht = (shoeTop(z) - SHOE.floor) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 8)), 0.22);
    const x = hw * Math.sign(c) * Math.pow(Math.abs(c), 0.7);
    const y = sn >= 0 ? SHOE.floor + ht * Math.pow(sn, 0.7) : SHOE.floor + sn * 0.02;
    pos.setXYZ(i, x, y, z);
  }
  upper.computeVertexNormals();
  // Suola: la pianta vista da sopra, un po' più grande della tomaia, estrusa verso l'alto:
  // sotto è piatta e poggia tutta per terra.
  const foot = new THREE.Shape();
  const N = 56, Ls = L - 0.002, Ws = SHOE.w + 0.002;
  for (let k = 0; k <= N; k++) {
    const u = -1 + (2 * k) / N;
    const pt = [Ws * shoeWidth(u), zc + Ls * u] as const;
    if (k === 0) foot.moveTo(pt[0], pt[1]);
    else foot.lineTo(pt[0], pt[1]);
  }
  for (let k = N - 1; k > 0; k--) {
    const u = -1 + (2 * k) / N;
    foot.lineTo(-Ws * shoeWidth(u), zc + Ls * u);
  }
  const depth = 0.046, bevel = 0.009;
  const sole = new THREE.ExtrudeGeometry(foot, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  sole.rotateX(Math.PI / 2);
  sole.translate(0, depth + bevel, 0);
  sole.computeVertexNormals();
  shoeGeo = { upper, sole };
  return shoeGeo;
}

/**
 * Una sneaker bassa vera, non un mattoncino: tomaia liscia e bombata che scende verso la
 * punta, suola piatta che poggia tutta per terra, imbottitura attorno alla caviglia,
 * linguetta, lacci incrociati e linguetta dietro al tallone.
 */
function sneaker(upper: string, sole: string, laces: string) {
  const g = new THREE.Group();
  const geo = shoeGeometry();
  const upperMat = vinyl(upper, { roughness: 0.38, clearcoat: 0.5 });
  const soleMat = vinyl(sole, { roughness: 0.7, clearcoat: 0.1 });
  g.add(new THREE.Mesh(geo.sole, soleMat), new THREE.Mesh(geo.upper, upperMat));

  // Imbottitura attorno alla caviglia (il calzino entra lì) e linguetta davanti.
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.094, 0.024, 10, 28), vinyl(new THREE.Color(upper).lerp(new THREE.Color(INK), 0.3), { roughness: 0.6, clearcoat: 0.2 }));
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 1.25, 1);
  collar.position.set(0, shoeTop(-0.1) + 0.004, -0.1);
  const tongue = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.07, 0.035, 3, 0.016), upperMat);
  tongue.position.set(0, shoeTop(-0.01) + 0.02, -0.01);
  tongue.rotation.x = -0.5;
  // Linguetta dietro al tallone.
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.07, 0.025, 2, 0.01), soleMat);
  tab.position.set(0, shoeTop(-0.28) - 0.01, -0.282);
  tab.rotation.x = 0.15;
  g.add(collar, tongue, tab);

  // Lacci incrociati sul collo del piede, appoggiati sulla tomaia.
  const laceMat = vinyl(laces, { roughness: 0.8, clearcoat: 0 });
  const laceGeo = new THREE.CapsuleGeometry(0.012, 0.1, 3, 6);
  for (let i = 0; i < 3; i++) {
    const z = 0.035 + i * 0.045;
    const slope = (shoeTop(z + 0.01) - shoeTop(z - 0.01)) / 0.02;
    for (const d of [-1, 1]) {
      const l = new THREE.Mesh(laceGeo, laceMat);
      l.rotation.set(-Math.atan(slope), d * 0.42, Math.PI / 2);
      l.position.set(0, shoeTop(z) + 0.008, z);
      g.add(l);
    }
  }
  return g;
}

/* ---------------------------------------------------------------- */
/* Il personaggio                                                    */
/* ---------------------------------------------------------------- */

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  ball: THREE.Mesh;
  eyes: THREE.Group[];
  blinkAt: number;
  /** Quello che si muove col vento quando giri il personaggio (vedi swayRig). */
  cloth: Cloth;
}

/** Le parti morbide: collana, ciondolo, capelli, berretto, pantaloncini, maglia, lacci della felpa. */
export interface Cloth {
  chain?: THREE.Group;
  pendant?: THREE.Group;
  hair?: THREE.Group;
  hat?: THREE.Group;
  shorts?: THREE.Mesh;
  torso?: THREE.Mesh;
  laces?: THREE.Group[];
}

const R = 0.56;
/** Dove sta la testa: serve anche al camerino per inquadrare gli oggetti. */
export const HEAD_Y = 2.3;

/** "festa": la faccia contenta di chi sale sul podio o alza la coppa. */
export function buildCharacter(preset: Preset, outfit: Outfit = {}, number?: string, mood?: "festa"): CharacterRig {
  const s = SPECS[preset];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const black = vinyl("#1b1817", { roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const glove = vinyl("#fbfaf6", { roughness: 0.45, clearcoat: 0.3 });
  const shoes = outfit.piedi?.kind === "shoes" ? outfit.piedi : null;
  const shorts = outfit.gambe?.kind === "shorts" ? outfit.gambe : null;
  const top = outfit.busto;
  const sleeveLook = outfit.braccio;
  const lift = s.legs ?? 0;
  const big = s.arms === "big";

  // Scarpe, calzini e gambe.
  for (const side of [-1, 1]) {
    const shoe = sneaker(shoes?.upper ?? s.shoes, shoes?.sole ?? "#f6f2ea", shoes?.laces ?? "#ffffff");
    shoe.position.set(side * 0.2, 0, 0.06);
    shoe.rotation.y = side * 0.08;
    body.add(shoe);
    // Calzino alto che esce dalla scarpa bassa.
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.088, 0.25, 16), vinyl("#fbfaf6", { roughness: 0.75, clearcoat: 0 }));
    sock.position.set(side * 0.2, 0.31, -0.04);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.03, 16), vinyl(shoes?.upper ?? s.trim, { roughness: 0.7, clearcoat: 0 }));
    stripe.position.set(side * 0.2, 0.4, -0.04);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3 + lift, 4, 12), black);
    leg.position.set(side * 0.2, 0.6 + lift / 2, 0);
    body.add(sock, stripe, leg);
  }

  // Tutto quello che sta sopra le gambe: si alza o si abbassa con la lunghezza delle gambe.
  const upper = new THREE.Group();
  upper.position.y = lift;
  body.add(upper);

  const cloth: Cloth = {};
  // Pantaloncini.
  cloth.shorts = new THREE.Mesh(
    lathe([[0.48, 0.6], [0.47, 0.75], [0.44, 0.9], [0.4, 0.98]], 40, 0.74),
    fabric({ map: once(`shorts:${shorts?.color ?? s.shorts}:${shorts?.trim ?? s.shortsTrim}:${shorts?.pattern ?? ""}`, () => shortsTexture(shorts?.color ?? s.shorts, shorts?.trim ?? s.shortsTrim, shorts?.pattern)), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, sheen: 0.3 }),
  );
  upper.add(cloth.shorts);

  // Busto: la canotta, oppure la felpa o il maglione (più larghi, con le maniche).
  const torso: [number, number][] = [[0.44, 0.92], [0.43, 1.08], [0.46, 1.32], [0.47, 1.52], [0.44, 1.66], [0.34, 1.76], [0.2, 1.8]];
  if (top?.kind === "hoodie" || top?.kind === "sweater") {
    const big = torso.map(([r, y]) => [r + 0.05, y] as [number, number]);
    big[0] = [0.5, 0.86];
    const mat =
      top.kind === "hoodie"
        ? fabric({ color: top.color, roughness: 0.85, sheen: 0.6, sheenColor: new THREE.Color("#8a93a6") })
        : fabric({ map: once("sweater", sweaterTexture), roughness: 0.9, sheen: 0.7, sheenColor: new THREE.Color("#ffb3a8") });
    cloth.torso = new THREE.Mesh(lathe(big, 48, 0.78), mat);
    upper.add(cloth.torso);
    // Polsini e fondo a costine.
    const rib = fabric({ color: top.kind === "hoodie" ? top.color : "#9e1c14", roughness: 0.9 });
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 10, 40), rib);
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1, 0.78, 1);
    hem.position.y = 0.88;
    upper.add(hem);
    if (top.kind === "hoodie") {
      // Cappuccio dietro il collo, tasca davanti e lacci.
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.11, 12, 32, Math.PI * 1.25), mat);
      hood.rotation.set(Math.PI / 2 + 0.25, 0, Math.PI * 0.125 + Math.PI);
      hood.scale.set(1, 1.1, 0.8);
      hood.position.set(0, 1.78, -0.06);
      const pocket = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.22, 0.06, 3, 0.03), mat);
      pocket.position.set(0, 1.08, 0.36);
      pocket.rotation.x = -0.05;
      upper.add(hood, pocket);
      // I lacci pendono da in alto: ognuno nel suo gruppo, così col vento dondolano.
      cloth.laces = [];
      for (const sd of [-1, 1]) {
        const hang = new THREE.Group();
        hang.position.set(sd * 0.09, 1.74, 0.4);
        const lace = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), vinyl(CREAM, { roughness: 0.8, clearcoat: 0 }));
        lace.position.y = -0.14;
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), vinyl(top.trim, { roughness: 0.4 }));
        tip.position.y = -0.3;
        hang.add(lace, tip);
        upper.add(hang);
        cloth.laces.push(hang);
      }
    } else {
      const neck = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 10, 40), rib);
      neck.rotation.x = Math.PI / 2;
      neck.scale.set(1, 0.78, 1);
      neck.position.y = 1.79;
      upper.add(neck);
    }
  } else {
    cloth.torso = new THREE.Mesh(
      lathe(torso, 64, 0.74),
      fabric({ map: once(`jersey:${preset}:${number ?? s.number}`, () => jerseyTexture(s, number ?? s.number)), bumpMap: meshBump(), bumpScale: 0.6, sheenColor: new THREE.Color(s.jersey).lerp(new THREE.Color("#ffffff"), 0.5) }),
    );
    upper.add(cloth.torso);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 10, 40), fabric({ color: s.trim }));
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1, 0.74, 1);
    collar.position.y = 1.775;
    upper.add(collar);
  }

  // Braccia "a tubo" nere coi guanti bianchi. La sinistra (a destra per chi guarda) tiene il pallone.
  const arms: THREE.Group[] = [];
  const sleeveMat =
    top?.kind === "hoodie"
      ? fabric({ color: top.color, roughness: 0.85, sheen: 0.6 })
      : top?.kind === "sweater"
        ? fabric({ map: once("stripes:sweater", () => stripesTexture("#c8261b", "#9e1c14")), roughness: 0.9 })
        : null;
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * (big ? 0.47 : 0.43), 1.6, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(big ? 0.1 : 0.075, 0.42, 4, 12), black);
    limb.position.y = -0.25;
    arm.add(limb);
    if (big) {
      // Il bicipite gonfio, come nel disegno.
      const biceps = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14), black);
      biceps.scale.set(1, 1.35, 1);
      biceps.position.set(side * 0.012, -0.2, 0.01);
      arm.add(biceps);
    }
    if (sleeveMat) {
      const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.36, 4, 12), sleeveMat);
      sl.position.y = -0.22;
      arm.add(sl);
    }
    // La fascia o il manicotto, sul braccio che tira (quello libero).
    if (side === -1 && sleeveLook?.kind === "armband") {
      const band = new THREE.Mesh(new THREE.TorusGeometry(sleeveMat ? 0.11 : 0.082, 0.032, 10, 28), vinyl(sleeveLook.color, { roughness: 0.6, clearcoat: 0.1 }));
      band.rotation.x = Math.PI / 2;
      band.scale.set(1, 1, 1.6);
      band.position.y = -0.34;
      arm.add(band);
    }
    if (side === -1 && sleeveLook?.kind === "sleeve") {
      const t = once(`stripes:${sleeveLook.stripes.join()}`, () => stripesTexture(sleeveLook.stripes[0], sleeveLook.stripes[1]));
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.084, 0.44, 20, 1, true), fabric({ map: t, roughness: 0.55 }));
      sl.position.y = -0.27;
      arm.add(sl);
    }
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.035, 10, 24), glove);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.5;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.145 : 0.13, 20, 14), glove);
    hand.scale.set(1, 1.05, 0.95);
    hand.position.y = -0.62;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.06, 4, 8), glove);
    thumb.position.set(-side * 0.08, -0.56, 0.07);
    thumb.rotation.z = side * 0.7;
    arm.add(cuff, hand, thumb);
    arm.rotation.z = side === 1 ? 0.5 : -0.2;
    arm.userData.rest = arm.rotation.z;
    upper.add(arm);
    arms.push(arm);
  }

  // Il pallone sotto la mano.
  const ballLook = outfit.pallone?.kind === "ball" ? outfit.pallone.texture : "classico";
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 32, 24),
    phys({
      map: tex(`pallone-${ballLook}`),
      bumpMap: tex("bump-pallone", false),
      bumpScale: 1.2,
      roughness: ballLook === "oro" ? 0.3 : 0.7,
      metalness: ballLook === "oro" ? 0.6 : 0,
      clearcoat: ballLook === "neve" ? 0.6 : 0.15,
    }),
  );
  const handAt = new THREE.Vector3(0, -0.62, 0).applyEuler(arms[1].rotation).add(arms[1].position);
  ball.position.set(handAt.x + 0.02, handAt.y - 0.31 + lift, 0.04);
  ball.userData.rest = ball.position.y;
  ball.userData.restX = ball.position.x;
  root.add(ball);

  // Testa: un pallone con la faccia, come nel disegno dell'app.
  const f = s.svg;
  const head = new THREE.Group();
  // Testa allungata o schiacciata: il mento resta dove sta, cambia l'altezza.
  const hs = s.headScale ?? [1, 1, 1];
  head.scale.set(...hs);
  head.position.set(0, HEAD_Y + (hs[1] - 1) * R, 0.02);
  upper.add(head);
  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(R, 56, 40),
    phys({ map: tex(s.head), bumpMap: tex("bump-testa", false), bumpScale: 1.1, roughness: 0.66, clearcoat: 0.18, clearcoatRoughness: 0.5 }),
  );
  skull.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeRotationX(THREE.MathUtils.degToRad(25)).multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.degToRad(35))),
  );
  head.add(skull);
  const eyes = s.eyes.map(([x, y, sc = 1, look = 0, lid]) => eye(R, f, x, y, sc, look, lid ?? s.lids));
  head.add(...eyes);
  const cheer = mood === "festa" && s.cheer;
  head.add(faceDecal(R, f, [...s.eyes.map(([x, y, sc = 1]): FaceShape => ({ ellipse: [x, y, 6.5 * sc, 8.3 * sc], fill: INK })), ...(cheer || s.paint)], cheer ? `${preset}:festa` : preset));

  const afro = s.extra.includes("afro");
  const headTop = outfit.testa;

  for (const x of s.extra) {
    if (x === "collana" && !outfit.gioielli && !top) Object.assign(cloth, addChain(upper, "star"));
    if (x === "occhiali" && !outfit.viso) {
      const frame = vinyl("#1b1817", { roughness: 0.22, clearcoat: 1 });
      for (const [ex, ey] of s.eyes) {
        const [yaw, pitch] = svgToHead(f, ex, ey);
        const { p, q } = onHead(R, yaw, pitch, 0.07);
        const rim = new THREE.Mesh(new THREE.TorusGeometry((9 / f.r) * R, 0.021, 10, 40), frame);
        rim.position.copy(p);
        rim.quaternion.copy(q);
        const lens = new THREE.Mesh(
          new THREE.CircleGeometry((9 / f.r) * R, 32),
          phys({ color: "#ffffff", transparent: true, opacity: 0.16, roughness: 0.04, clearcoat: 1, depthWrite: false }),
        );
        lens.position.copy(p);
        lens.quaternion.copy(q);
        lens.renderOrder = 2;
        head.add(rim, lens);
      }
      const [by, bp] = svgToHead(f, 50, 42);
      head.add(tubeOnHead(R, [[by - 0.12, bp, 0.07], [by, bp + 0.02, 0.07], [by + 0.12, bp, 0.07]], 0.018, frame));
      for (const sd of [-1, 1]) {
        const [y0, p0] = svgToHead(f, 50 + sd * 18, 43);
        head.add(tubeOnHead(R, [[y0, p0, 0.07], [y0 + sd * 0.25, p0 + 0.03, 0.045], [sd * 1.25, p0 + 0.05, 0.028], [sd * 1.75, p0 - 0.02, 0.026]], 0.017, frame));
      }
    }
    if (x === "afro") cloth.hair = addAfro(head, !!headTop);
    if (x === "fascia" && !headTop) addHeadband(head);
    if (x === "fascia-alta" && !headTop) addHeadband(head, { color: CREAM, stripe: RED, h: 0.4 * R, w: 0.17, tilt: 0.12 });
    if (x === "bandana" && !headTop) addBandana(head);
    if (x === "coppola" && !headTop) addFlatCap(head);
    if (x === "occhialoni" && !outfit.viso) addSportGoggles(head, f);
    if (x === "fascia-gialla" && !headTop) addHeadband(head, { color: YELLOW, h: 0.4 * R, w: 0.15, tilt: 0.24 });
    if (x === "fascia-lampo" && !headTop) {
      addHeadband(head, { color: NAVY, h: 0.4 * R, w: 0.16, tilt: 0.24 });
      addBolt(head, f);
    }
    if ((x === "berretto" || x === "berretto-girato") && !headTop) {
      const girato = x === "berretto-girato";
      const cap = addHat(head, girato ? { kind: "cap", color: PURPLE, visor: PURPLE } : { kind: "cap", color: CREAM, visor: BLUE }, false);
      // Il regista lo porta un po' di lato, il jolly al contrario.
      if (cap) {
        cap.rotation.y = girato ? -2.36 : -0.4;
        cloth.hat = cap;
      }
    }
    if (x === "fischietto" && !top) addWhistle(upper);
  }

  // Oggetti da indossare: testa, viso, gioielli.
  if (headTop) cloth.hat = addHat(head, headTop, afro);
  if (outfit.viso) addFace(head, outfit.viso, f, s);
  if (outfit.gioielli?.kind === "chain") Object.assign(cloth, addChain(upper, outfit.gioielli.pendant, !!top));
  if (outfit.gioielli?.kind === "earring") addEarrings(head);

  return { root, body, head, arms, ball, eyes, blinkAt: 2 + Math.random() * 2, cloth };
}

/** Raggio del busto alla quota y (lo stesso profilo della canotta), per appoggiarci la catena. */
function torsoRadius(y: number) {
  const p: [number, number][] = [[0.44, 0.92], [0.43, 1.08], [0.46, 1.32], [0.47, 1.52], [0.44, 1.66], [0.34, 1.76], [0.2, 1.8]];
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) if (y <= p[i][1]) return p[i - 1][0] + ((p[i][0] - p[i - 1][0]) * (y - p[i - 1][1])) / (p[i][1] - p[i - 1][1]);
  return p[p.length - 1][0];
}

/**
 * La catena d'oro: anelli veri intrecciati (uno dritto e uno girato) che scendono a U sul
 * petto appoggiati alla maglia, e il ciondolo appeso a un anellino. Catena e ciondolo sono
 * in gruppi col perno in alto: quando giri il personaggio dondolano (vedi swayRig).
 */
function addChain(body: THREE.Group, pendant: "star" | "ball", overTop = false) {
  const gold = phys({ color: "#f2b632", metalness: 1, roughness: 0.22, clearcoat: 0.6 });
  const lift = overTop ? 0.05 : 0;
  const neck = new THREE.Vector3(0, 1.78, 0);
  const chain = new THREE.Group();
  chain.position.copy(neck);
  // Il percorso: dai lati del collo giù fino al centro del petto, sempre sopra la maglia.
  const at = (a: number) => {
    const x = Math.sin(a) * 0.27;
    const y = 1.79 - 0.25 * Math.pow(Math.cos(a), 1.6);
    const r = torsoRadius(y) + lift;
    const z = Math.sqrt(Math.max(0, r * r - x * x)) * (overTop ? 0.78 : 0.74) + 0.024;
    return new THREE.Vector3(x, y, z).sub(neck);
  };
  const curve = new THREE.CatmullRomCurve3(Array.from({ length: 13 }, (_, i) => at(-Math.PI / 2 + (i / 12) * Math.PI)));
  const n = 46;
  const links = new THREE.InstancedMesh(new THREE.TorusGeometry(0.019, 0.0065, 6, 12), gold, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), roll = new THREE.Quaternion(), one = new THREE.Vector3(1, 1.45, 1);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    // L'anello sta lungo la catena; uno su due è girato di 90°.
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    roll.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i % 2 ? Math.PI / 2 : 0);
    m.compose(p, q.multiply(roll), one);
    links.setMatrixAt(i, m);
  }
  chain.add(links);

  // Il ciondolo appeso in basso, col suo anellino.
  const bottom = curve.getPointAt(0.5);
  const hang = new THREE.Group();
  hang.position.copy(bottom);
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 8, 16), gold);
  bail.position.y = -0.028;
  hang.add(bail);
  const shine = phys({ color: "#ffc531", metalness: 0.85, roughness: 0.2, clearcoat: 0.8 });
  if (pendant === "star") {
    const st = new THREE.Mesh(new THREE.ExtrudeGeometry(star(0.095, 0.042), { depth: 0.025, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.012, bevelSegments: 2 }), shine);
    st.position.set(0, -0.135, -0.004);
    st.rotation.x = -0.12;
    hang.add(st);
  } else {
    // Un pallone d'oro con le cuciture.
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), shine);
    ball.position.y = -0.112;
    const seam = phys({ color: "#a8741a", metalness: 1, roughness: 0.35 });
    for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.071, 0.0045, 6, 32), seam);
      ring.rotation.set(rx, ry, 0);
      ball.add(ring);
    }
    hang.add(ball);
  }
  chain.add(hang);
  body.add(chain);
  return { chain, pendant: hang };
}

function addAfro(head: THREE.Group, squashed: boolean): THREE.Group {
  const hair = phys({ color: "#2e1c11", roughness: 0.78, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color("#6e4f3c"), bumpMap: curlBump(), bumpScale: 4 });
  const geo = new THREE.SphereGeometry(1, 14, 10);
  const c0 = new THREE.Vector3(0, 0.66 * R, -0.42 * R);
  // Sotto un cappello l'afro si schiaccia un po' e sporge ai lati.
  const ax = new THREE.Vector3(1.12 * R, (squashed ? 0.7 : 0.92) * R, 0.86 * R);
  // Tutto l'afro in un gruppo col perno al centro della testa: col vento si piega un filo.
  const group = new THREE.Group();
  const core = new THREE.Mesh(geo, hair);
  core.position.copy(c0);
  core.scale.copy(ax).multiplyScalar(0.9);
  group.add(core);
  const N = 70;
  const list: THREE.Matrix4[] = [];
  const q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const rr = Math.sqrt(1 - y * y);
    const a = i * 2.39996;
    const p = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr).multiply(ax).add(c0);
    if (p.y < 0.05 * R) continue;
    if (p.z > 0.08 * R && p.y < 1.05 * R) continue;
    q.setFromEuler(new THREE.Euler(i, i * 2.1, i * 0.7));
    sc.setScalar(R * (0.28 + ((((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1) * 0.12));
    list.push(new THREE.Matrix4().compose(p, q, sc));
  }
  const puffs = new THREE.InstancedMesh(geo, hair, list.length);
  list.forEach((m, i) => puffs.setMatrixAt(i, m));
  group.add(puffs);
  head.add(group);
  return group;
}

function addHeadband(head: THREE.Group, o: { color?: string; stripe?: string; h?: number; w?: number; tilt?: number } = {}) {
  const tilt = o.tilt ?? 0.19, h = o.h ?? 0.225 * R, w = o.w ?? 0.15, th = 0.024;
  const n = new THREE.Vector3(0, Math.cos(tilt), -Math.sin(tilt));
  const rad = (hh: number) => Math.sqrt(R * R - hh * hh) + th;
  const band = new THREE.Group();
  band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  band.position.copy(n).multiplyScalar(h);
  band.add(new THREE.Mesh(new THREE.CylinderGeometry(rad(h + w / 2), rad(h - w / 2), w, 64, 1, true), fabric({ color: o.color ?? RED, roughness: 0.6, sheen: 0.25 })));
  if (o.stripe) {
    const st = new THREE.Mesh(new THREE.TorusGeometry(rad(h) + 0.004, 0.017, 8, 64), fabric({ color: o.stripe, roughness: 0.6 }));
    st.rotation.x = Math.PI / 2;
    band.add(st);
  }
  const ink = vinyl(INK, { roughness: 0.35 });
  for (const dy of [-w / 2, w / 2]) {
    const e = new THREE.Mesh(new THREE.TorusGeometry(rad(h + dy), 0.016, 8, 64), ink);
    e.rotation.x = Math.PI / 2;
    e.position.y = dy;
    band.add(e);
  }
  head.add(band);
}

/** La tela rossa a pois della bandana. */
function bandanaTexture() {
  const { c, g } = canvas(512, 256);
  g.fillStyle = RED;
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = CREAM;
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 18; y < 256; y += 36)
    for (let x = (y / 36) % 2 ? 0 : 22; x < 512; x += 44) {
      g.beginPath();
      g.arc(x + rnd() * 8, y + rnd() * 6, 6.5 + rnd() * 2, 0, Math.PI * 2);
      g.fill();
    }
  return canvasTex(c);
}

/** Bandana: calotta stretta sulla testa, più alta in fronte, col nodo e le due code di lato. */
function addBandana(head: THREE.Group) {
  const mat = fabric({ map: once("bandana", bandanaTexture), roughness: 0.6, sheen: 0.35, sheenColor: new THREE.Color("#ffb3a8"), side: THREE.DoubleSide });
  const edge = THREE.MathUtils.degToRad(66);
  const g = new THREE.Group();
  g.rotation.x = -0.2;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 48, 20, 0, Math.PI * 2, 0, edge), mat);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(R * 1.035 * Math.sin(edge), 0.02, 8, 64), fabric({ color: "#b32f20", roughness: 0.7 }));
  hem.rotation.x = Math.PI / 2;
  hem.position.y = R * 1.035 * Math.cos(edge);
  g.add(cap, hem);
  head.add(g);
  const red = fabric({ color: RED, roughness: 0.6, sheen: 0.35 });
  const { p } = onHead(R, 1.28, 0.34, 0.03);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), red);
  knot.position.copy(p);
  head.add(knot);
  for (const [dx, dy, rz] of [[0.13, 0.05, 0.45], [0.1, -0.12, -1.0]] as const) {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), red);
    tail.scale.set(0.15, 0.065, 0.028);
    tail.position.set(p.x + dx, p.y + dy, p.z - 0.03);
    tail.rotation.set(0, -0.35, rz);
    head.add(tail);
  }
}

/** Coppola anni '30: calotta morbida inclinata in avanti, visierina corta e bottone in cima. */
function addFlatCap(head: THREE.Group) {
  const wool = fabric({ color: "#7a5a3c", roughness: 0.95, sheen: 0.25, sheenColor: new THREE.Color("#b08a62") });
  const dark = fabric({ color: "#5e4430", roughness: 0.9, sheen: 0.2 });
  const g = new THREE.Group();
  g.rotation.x = 0.1;
  g.position.set(0, 0.06, 0);
  const edge = THREE.MathUtils.degToRad(70);
  const sc = new THREE.Vector3(1.05, 0.9, 1.12);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 20, 0, Math.PI * 2, 0, edge), wool);
  crown.scale.copy(sc);
  const rimY = R * 1.06 * Math.cos(edge) * sc.y;
  const rimR = R * 1.06 * Math.sin(edge);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.024, 8, 64), dark);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(sc.x, sc.z, 1);
  rim.position.y = rimY;
  // Visierina corta davanti, stretta quanto la fronte e piegata appena in giù.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.035, 32, 1, false, -Math.PI / 2, Math.PI), dark);
  brim.scale.set(1.05, 1, 0.55);
  brim.position.set(0, rimY - 0.012, rimR * sc.z - 0.07);
  brim.rotation.x = 0.22;
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), dark);
  button.position.y = R * 1.06 * sc.y;
  // La cucitura davanti, appena accennata.
  const seamPts = [0.35, 0.8, 1.25].map((a) => new THREE.Vector3(0, Math.sin(a) * R * 1.075 * sc.y, Math.cos(a) * R * 1.075 * sc.z));
  const seam = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPts), 16, 0.009, 6, false), dark);
  g.add(crown, rim, brim, button, seam);
  head.add(g);
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Occhialoni da gioco: due lenti squadrate con la montatura spessa e l'elastico attorno alla testa. */
function addSportGoggles(head: THREE.Group, f: Spec["svg"]) {
  const k = R / f.r;
  const frameMat = vinyl(INK, { roughness: 0.3, clearcoat: 0.9 });
  const lensMat = new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.2, roughness: 0.04, clearcoat: 1, depthWrite: false });
  for (const cx of [40.5, 59.5]) {
    const outer = roundedRect(17 * k, 15 * k, 6 * k);
    outer.holes.push(roundedRect(12 * k, 10 * k, 3.6 * k));
    const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6 }), frameMat);
    const [yaw, pitch] = svgToHead(f, cx, 46);
    const { p, q } = onHead(R, yaw, pitch, 0.035);
    frame.position.copy(p);
    frame.quaternion.copy(q);
    const lens = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(12.4 * k, 10.4 * k, 3.6 * k)), lensMat);
    lens.position.copy(onHead(R, yaw, pitch, 0.06).p);
    lens.quaternion.copy(q);
    lens.renderOrder = 2;
    head.add(frame, lens);
  }
  const [by, bp] = svgToHead(f, 50, 45);
  head.add(tubeOnHead(R, [[by - 0.08, bp, 0.07], [by + 0.08, bp, 0.07]], 0.02, frameMat));
  // L'elastico gira dietro la testa, all'altezza degli occhi.
  const [, sp] = svgToHead(f, 50, 46);
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.022, R + 0.022, 0.07, 56, 1, true), fabric({ color: INK, roughness: 0.6, side: THREE.DoubleSide }));
  strap.position.y = Math.sin(sp) * R * 0.98;
  strap.scale.set(Math.cos(sp) + 0.02, 1, Math.cos(sp) + 0.02);
  head.add(strap);
}

/** Il fulmine giallo sulla fascia di Lampo. */
function addBolt(head: THREE.Group, f: Spec["svg"]) {
  const k = R / f.r;
  const pts: [number, number][] = [[52, 30.5], [46, 38.6], [50.4, 38.6], [47, 44], [55, 35.6], [50.8, 35.6], [53.6, 30.5]];
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 50.5) * k, -(y - 37) * k)));
  const bolt = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 1 }),
    vinyl(YELLOW, { roughness: 0.3, clearcoat: 0.8 }),
  );
  const [yaw, pitch] = svgToHead(f, 50.5, 37);
  const { p, q } = onHead(R, yaw, pitch, 0.026);
  bolt.position.copy(p);
  bolt.quaternion.copy(q);
  head.add(bolt);
}

/** Il fischietto d'argento appeso al collo con il cordino. */
function addWhistle(upper: THREE.Group) {
  const metal = new THREE.MeshPhysicalMaterial({ color: "#dfe6ee", metalness: 0.85, roughness: 0.25, clearcoat: 0.6 });
  const w = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.09, 0.08, 3, 0.03), metal);
  const tip = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.05, 0.06, 2, 0.015), metal);
  tip.position.set(-0.09, 0.015, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.007, 6, 12), metal);
  ring.position.set(0.05, 0.055, 0);
  w.add(body, tip, ring);
  w.position.set(0.11, 1.5, 0.37);
  w.rotation.set(-0.15, 0, -0.12);
  upper.add(w);
  const cord = vinyl(INK, { roughness: 0.6, clearcoat: 0 });
  for (const sd of [-1, 1]) {
    const pts = [new THREE.Vector3(sd * 0.2, 1.76, 0.2), new THREE.Vector3(sd * 0.12 + 0.05, 1.64, 0.33), new THREE.Vector3(0.16, 1.56, 0.37)];
    upper.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.01, 6, false), cord));
  }
}

/** Cappellino e berretto: si appoggiano in cima alla testa (o sull'afro, un po' più su). */
function addHat(head: THREE.Group, look: Look, afro: boolean): THREE.Group | undefined {
  const g = new THREE.Group();
  g.position.y = afro ? R * 0.72 : R * 0.18;
  g.position.z = afro ? -0.08 : 0;
  g.scale.setScalar(afro ? 1.2 : 1);
  g.rotation.x = -0.12;
  if (look.kind === "cap") {
    const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 1.04, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2.15), fabric({ color: look.color, roughness: 0.7, sheen: 0.3 }));
    crown.scale.set(1, 0.82, 1);
    // La visiera parte dal bordo davanti e sporge in avanti.
    const visor = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.78, R * 0.78, 0.045, 32, 1, false, -Math.PI / 2, Math.PI), vinyl(look.visor, { roughness: 0.5 }));
    visor.position.set(0, 0.02, R * 0.82);
    visor.scale.set(1, 1, 0.85);
    visor.rotation.x = 0.32;
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), fabric({ color: look.visor }));
    button.position.y = R * 0.82;
    const logo = new THREE.Mesh(new THREE.CircleGeometry(0.075, 24), vinyl(INK, { roughness: 0.4 }));
    const { p, q } = onHead(R * 1.04, 0, 0.55, 0.004);
    logo.position.set(p.x, p.y * 0.82, p.z);
    logo.quaternion.copy(q);
    g.add(crown, visor, button, logo);
  } else if (look.kind === "santa") {
    const red = fabric({ color: "#d62a1e", roughness: 0.85, sheen: 0.8, sheenColor: new THREE.Color("#ff9a8a") });
    // Il cono si piega da un lato, come i berretti veri.
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(new THREE.Vector3(Math.sin(t * 1.6) * 0.42 * t, t * 0.95, -t * t * 0.25));
    }
    const path = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(path, 24, 1, 20, false);
    // Raggio che si stringe verso la punta.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const segs = 25, ring = 21;
    const v = new THREE.Vector3();
    for (let i = 0; i < segs; i++) {
      const t = i / (segs - 1);
      const c = path.getPoint(t);
      const r = R * 0.98 * (1 - t) + 0.03;
      for (let j = 0; j < ring; j++) {
        const k = i * ring + j;
        v.fromBufferAttribute(pos, k).sub(c).normalize().multiplyScalar(r).add(c);
        pos.setXYZ(k, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    const cone = new THREE.Mesh(geo, red);
    cone.position.y = 0.02;
    const fur = fabric({ color: "#fbf6ee", roughness: 1, sheen: 1, sheenColor: new THREE.Color("#ffffff") });
    const brim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.98, 0.09, 12, 40), fur);
    brim.rotation.x = Math.PI / 2;
    const tip = path.getPoint(1);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), fur);
    pom.position.set(tip.x, tip.y + 0.02, tip.z);
    // Cono e pon pon si piegano insieme sul bordo di pelliccia, che resta fermo.
    const flop = new THREE.Group();
    flop.add(cone, pom);
    g.add(flop, brim);
    g.userData.pom = pom;
    head.add(g);
    return flop;
  }
  head.add(g);
  return undefined;
}

function addFace(head: THREE.Group, look: Look, f: Spec["svg"], s: Spec) {
  if (look.kind === "shades") {
    const frame = vinyl(look.frame, { roughness: 0.25, clearcoat: 1 });
    const lensMat = phys({ color: look.lens, roughness: 0.05, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0 });
    for (const [ex, ey] of s.eyes) {
      const [yaw, pitch] = svgToHead(f, ex, ey);
      const { p, q } = onHead(R, yaw, pitch, 0.075);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lensMat);
      lens.scale.set(0.19, 0.14, 0.035);
      lens.position.copy(p);
      lens.quaternion.copy(q);
      head.add(lens);
    }
    const [by, bp] = svgToHead(f, 50, f.cy - 4);
    head.add(tubeOnHead(R, [[by - 0.42, bp + 0.08, 0.09], [by, bp + 0.1, 0.1], [by + 0.42, bp + 0.08, 0.09]], 0.024, frame));
    for (const sd of [-1, 1])
      head.add(tubeOnHead(R, [[sd * 0.62, bp + 0.06, 0.07], [sd * 1.0, bp + 0.08, 0.035], [sd * 1.6, bp + 0.05, 0.026]], 0.02, frame));
  } else if (look.kind === "goggles") {
    // Maschera da neve: lente unica a specchio e fascia elastica attorno alla testa.
    const [, ep] = svgToHead(f, 50, s.eyes[0][1]);
    const lens = new THREE.Mesh(
      new THREE.SphereGeometry(R + 0.08, 40, 12, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - ep - 0.24, 0.48),
      phys({ color: "#8fd3ff", metalness: 0.9, roughness: 0.08, iridescence: 1, iridescenceIOR: 1.6, clearcoat: 1 }),
    );
    const rim = vinyl(INK, { roughness: 0.4 });
    const frame = new THREE.Mesh(new THREE.SphereGeometry(R + 0.06, 40, 12, Math.PI / 2 - 0.8, 1.6, Math.PI / 2 - ep - 0.27, 0.54), rim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.035, R + 0.035, 0.12, 48, 1, true), fabric({ color: look.band, roughness: 0.6, side: THREE.DoubleSide }));
    band.position.y = Math.sin(ep) * R;
    head.add(frame, lens, band);
  }
}

function addEarrings(head: THREE.Group) {
  const gem = phys({ color: "#ffffff", metalness: 0.1, roughness: 0, clearcoat: 1, iridescence: 0.8, envMapIntensity: 2.4 });
  const gold = phys({ color: "#f2b632", metalness: 1, roughness: 0.2 });
  for (const sd of [-1, 1]) {
    const { p } = onHead(R, sd * 1.42, -0.22, 0.03);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), gold);
    hoop.position.copy(p);
    hoop.rotation.y = Math.PI / 2;
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), gem);
    stone.position.copy(p).add(new THREE.Vector3(0, -0.1, 0));
    stone.scale.set(1, 1.3, 1);
    head.add(hoop, stone);
  }
}

/** Vita da vetrina: respira, muove la testa, sbatte le palpebre, palleggia quando lo tocchi. */
export function animateRig(u: CharacterRig, t: number, dribble: number) {
  const breathe = Math.sin(t * 2.1);
  u.body.scale.set(1 + breathe * 0.006, 1 + breathe * 0.012, 1 + breathe * 0.006);
  u.head.rotation.z = Math.sin(t * 0.9) * 0.05;
  u.head.rotation.x = Math.sin(t * 1.3 + 1) * 0.03;
  u.arms[0].rotation.z = (u.arms[0].userData.rest as number) - Math.sin(t * 2.1) * 0.03;
  if (t > u.blinkAt + 0.16) u.blinkAt = t + 2.2 + Math.random() * 2.5;
  const b = t > u.blinkAt ? Math.sin(((t - u.blinkAt) / 0.16) * Math.PI) : 0;
  for (const e of u.eyes) e.scale.y = 1 - b * 0.9;
  const rest = u.ball.userData.rest as number;
  let y = rest;
  let push = 0;
  if (dribble < 1) {
    const k = (dribble * 2) % 1;
    y = 0.2 + (rest - 0.2) * Math.abs(Math.cos(k * Math.PI));
    push = Math.max(0, Math.cos(k * Math.PI * 2)) * 0.18;
    const squash = Math.max(0, 1 - (y - 0.2) / 0.08) * 0.14;
    u.ball.scale.set(1 + squash, 1 - squash, 1 + squash);
    u.ball.rotation.x = dribble * 9;
  } else u.ball.scale.setScalar(1);
  u.ball.position.y = y + breathe * 0.006;
  u.arms[1].rotation.z = (u.arms[1].userData.rest as number) + Math.sin(t * 2.1) * 0.02 + push * 0.4;
}

/**
 * Il vento leggero: quando giri il personaggio le parti morbide restano un attimo indietro e
 * poi lo raggiungono, come per una folata. `sway` arriva dalla scena (una molla sulla
 * velocità di rotazione, circa tra -0.6 e 0.6); qui si girano solo pochi gruppi, niente fisica.
 */
export function swayRig(u: CharacterRig, sway: number, t: number) {
  const c = u.cloth;
  const breeze = Math.sin(t * 1.7) * 0.025 + Math.sin(t * 2.9 + 1) * 0.012;
  const w = sway + breeze;
  const a = Math.abs(sway);
  if (c.chain) {
    c.chain.rotation.y = w * 0.45;
    c.chain.rotation.x = -a * 0.22;
  }
  if (c.pendant) {
    c.pendant.rotation.z = w * 0.7;
    c.pendant.rotation.x = -a * 0.45 - Math.abs(breeze) * 0.3;
  }
  if (c.hair) {
    c.hair.rotation.z = w * 0.1;
    c.hair.rotation.y = w * 0.12;
  }
  if (c.hat) {
    c.hat.rotation.z = w * 0.35;
    c.hat.rotation.x = -a * 0.12;
  }
  if (c.shorts) {
    c.shorts.rotation.y = w * 0.14;
    c.shorts.scale.set(1 + a * 0.06, 1, 1 + a * 0.06);
  }
  if (c.torso) c.torso.rotation.y = w * 0.05;
  if (c.laces) for (const l of c.laces) {
    l.rotation.z = w * 0.8;
    l.rotation.x = -a * 0.5;
  }
}

/** Libera la memoria della scheda video quando il personaggio cambia (le texture condivise restano). */
export function disposeRig(rig: CharacterRig) {
  const shared = new Set([...texCache.values(), ...drawn.values()]);
  if (meshBumpTex) shared.add(meshBumpTex);
  if (curlTex) shared.add(curlTex);
  rig.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // Le forme delle scarpe sono di tutti: restano.
    if (m.geometry !== shoeGeo?.upper && m.geometry !== shoeGeo?.sole) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      for (const k of ["map", "bumpMap"] as const) {
        const tx = (mat as THREE.MeshPhysicalMaterial)[k];
        if (tx && !shared.has(tx)) tx.dispose();
      }
      mat.dispose();
    }
  });
}
