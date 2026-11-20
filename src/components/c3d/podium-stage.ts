/**
 * Il podio in 3D: i tre personaggi veri in un solo palco (un solo renderer per tutti e tre).
 * Disegna solo quando qualcuno si muove: da fermi il palco è un'immagine e non consuma.
 * Le foto che la pagina mostra prima del 3D si ritagliano da questo stesso palco, quindi
 * quando il 3D prende il loro posto il cambio non si vede.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  buildCharacter,
  disposeRig,
  preloadTextures,
  type CharacterRig,
  type Outfit,
  type Preset,
} from "./build";

/** Il premio del posto (con il suo gesto), o "riposo": fermo col pallone, come nel camerino. */
export type Award = "oro" | "argento" | "bronzo" | "riposo";

/** Un posto sul podio, misurato sulla pagina (pixel CSS, rispetto al palco). */
export interface PodiumSlot {
  /** Chi è e cosa indossa: se non cambia, il personaggio non si ricostruisce. */
  key: string;
  preset: Preset;
  outfit: Outfit;
  number?: string;
  award: Award;
  /** Centro orizzontale e base (i piedi) del riquadro, larghezza e altezza. */
  cx: number;
  bottom: number;
  w: number;
  h: number;
  /** Verso dove guarda da fermo (radianti); se manca, verso il primo. */
  yaw?: number;
}

/** Quanto è alto il personaggio (testa compresa) nelle unità del 3D: serve a riempire il riquadro. */
const FIG_H = 3.25;
/** Leggermente dall'alto, come chi guarda un podio. */
const TILT = 0.09;
/** Verso dove guarda chi sta di lato: un po' verso il primo. */
const REST_YAW: Record<Award, number> = {
  oro: 0,
  argento: 0.32,
  bronzo: -0.32,
  riposo: -0.35,
};
const DURATION: Record<Award, number> = {
  oro: 2.5,
  argento: 2.4,
  bronzo: 2.1,
  riposo: 1.1,
};
const restYaw = (s: PodiumSlot) => s.yaw ?? REST_YAW[s.award];

const GOLD = new THREE.MeshPhysicalMaterial({
  color: "#f2b632",
  metalness: 1,
  roughness: 0.22,
  clearcoat: 0.6,
});
const SILVER = new THREE.MeshPhysicalMaterial({
  color: "#eef3f8",
  metalness: 0.75,
  roughness: 0.3,
  clearcoat: 0.7,
  clearcoatRoughness: 0.2,
});

function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(0,0,0,0.5)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.1),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  return m;
}

/** La coppa d'oro: base scura, stelo e coppa con i due manici. L'origine è dove la si impugna. */
function trophy() {
  const g = new THREE.Group();
  g.scale.setScalar(1.45);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.08, 24),
    new THREE.MeshPhysicalMaterial({
      color: "#2a211b",
      roughness: 0.35,
      clearcoat: 0.8,
    }),
  );
  base.position.y = -0.1;
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.04, 24),
    GOLD,
  );
  plate.position.y = -0.04;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.04, 0.16, 16),
    GOLD,
  );
  stem.position.y = 0.05;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), GOLD);
  knot.position.y = 0.06;
  const profile = [
    [0.02, 0.12],
    [0.07, 0.15],
    [0.13, 0.22],
    [0.165, 0.32],
    [0.175, 0.42],
    [0.185, 0.45],
    [0.17, 0.455],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), GOLD);
  (cup.material as THREE.Material).side = THREE.DoubleSide;
  g.add(base, plate, stem, knot, cup);
  for (const sd of [-1, 1]) {
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.016, 10, 24, Math.PI * 1.15),
      GOLD,
    );
    handle.position.set(sd * 0.175, 0.33, 0);
    handle.rotation.z =
      sd === 1 ? -Math.PI * 0.55 : Math.PI * 0.45 + Math.PI * 0.1;
    if (sd === -1) handle.rotation.y = Math.PI;
    g.add(handle);
  }
  return g;
}

function starShape(r1: number, r2: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

/** La medaglia d'argento col nastro: il disco si muove, i due lembi del nastro lo seguono. */
function medal() {
  const disc = new THREE.Group();
  disc.scale.setScalar(1.3);
  const coin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.03, 36),
    SILVER,
  );
  coin.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.115, 0.012, 8, 36),
    SILVER,
  );
  const st = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape(0.07, 0.03), {
      depth: 0.012,
      bevelEnabled: false,
    }),
    new THREE.MeshPhysicalMaterial({
      color: "#c3ccd8",
      metalness: 0.8,
      roughness: 0.35,
    }),
  );
  st.position.z = 0.012;
  const loop = new THREE.Mesh(
    new THREE.TorusGeometry(0.025, 0.008, 6, 16),
    SILVER,
  );
  loop.position.y = 0.135;
  disc.add(coin, rim, st, loop);
  const ribbonMat = new THREE.MeshPhysicalMaterial({
    color: "#2d5be3",
    roughness: 0.6,
    sheen: 0.5,
    sheenColor: new THREE.Color("#9db4ff"),
  });
  const strips = [-1, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.012), ribbonMat);
    return m;
  });
  return { disc, strips };
}

/* ---------------------------------------------------------------- */
/* Pose: tutto si calcola dal tempo, così la posa di riposo è sempre  */
/* identica alla foto e il movimento parte da lì senza scatti         */
/* ---------------------------------------------------------------- */

type ArmPose = [number, number]; // rotazione x (avanti) e z (di lato)
type Key = [number, ArmPose];

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Interpola tra le pose chiave con un'accelerazione morbida (niente scatti). */
function track(keys: Key[], t: number): ArmPose {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, b] = keys[i];
    const [t0, a] = keys[i - 1];
    if (t <= t1) {
      const k = smooth((t - t0) / (t1 - t0));
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
  }
  return keys[keys.length - 1][1];
}

/** Valore che sale e scende dolcemente tra a e b (0 fuori, 1 in mezzo). */
function bell(t: number, a: number, b: number, edge = 0.12) {
  if (t <= a || t >= b) return 0;
  return smooth(Math.min(1, (t - a) / edge, (b - t) / edge));
}

// Le braccia: [sinistra di chi guarda (lato -1), destra (lato +1, quella del pallone)].
const HOLD_L: ArmPose = [-0.88, 0.5];
const HOLD_R: ArmPose = [-0.88, -0.5];
const DOWN_L: ArmPose = [0, -0.2];
const BALL_R: ArmPose = [0, 0.5];
const DOWN_R: ArmPose = [0, 0.2];

const REST: Record<Award, [ArmPose, ArmPose]> = {
  oro: [HOLD_L, HOLD_R],
  argento: [DOWN_L, BALL_R],
  bronzo: [DOWN_L, DOWN_R],
  riposo: [DOWN_L, BALL_R],
};

const KEYS: Record<Award, [Key[], Key[]]> = {
  // La coppa sale accanto alla testa con la destra, la sinistra esulta, poi torna al petto.
  oro: [
    [
      [0, HOLD_L],
      [0.12, [-0.7, 0.45]],
      [0.32, [-0.2, -2.35]],
      [0.45, [-0.25, -2.6]],
      [0.56, [-0.2, -2.3]],
      [0.66, [-0.25, -2.6]],
      [0.76, [-0.2, -2.35]],
      [1, HOLD_L],
    ],
    [
      [0, HOLD_R],
      [0.12, [-0.75, -0.45]],
      [0.32, [-0.12, 2.72]],
      [0.76, [-0.12, 2.72]],
      [1, HOLD_R],
    ],
  ],
  // La sinistra prende la medaglia dal petto, la mostra all'altezza del viso, poi la rimette giù.
  argento: [
    [
      [0, DOWN_L],
      [0.24, [-1.1, 0.72]],
      [0.46, [-2.03, 0.5]],
      [0.74, [-2.03, 0.5]],
      [0.88, [-1.1, 0.72]],
      [1, DOWN_L],
    ],
    [
      [0, BALL_R],
      [1, BALL_R],
    ],
  ],
  // Mani davanti al petto e quattro applausi, poi giù.
  bronzo: [
    [
      [0, DOWN_L],
      [0.16, [-0.88, 0.45]],
      [0.84, [-0.88, 0.45]],
      [1, DOWN_L],
    ],
    [
      [0, DOWN_R],
      [0.16, [-0.88, -0.45]],
      [0.84, [-0.88, -0.45]],
      [1, DOWN_R],
    ],
  ],
  // Fermo: un saluto con la mano libera.
  riposo: [
    [
      [0, DOWN_L],
      [0.3, [-0.2, -2.5]],
      [0.45, [-0.2, -2.2]],
      [0.6, [-0.2, -2.5]],
      [1, DOWN_L],
    ],
    [
      [0, BALL_R],
      [1, BALL_R],
    ],
  ],
};

/** Le pose dei gesti, per i controlli: ogni gesto parte e finisce nella posa della foto. */
export const GESTI = { REST, KEYS, track };

interface Actor {
  slot: PodiumSlot;
  rig: CharacterRig;
  holder: THREE.Group;
  upper: THREE.Object3D;
  restBallY: number;
  prop: { trophy?: THREE.Group; medal?: ReturnType<typeof medal> };
  /** Avanzamento dell'animazione del tocco: da 0 a 1, poi fermo. */
  play: number;
  yaw: number;
  vYaw: number;
  /** Quando torna a guardare avanti dopo che l'hai girato. */
  backAt: number;
}

const tmpV = new THREE.Vector3();
const HAND = new THREE.Vector3(0, -0.62, 0);

function handPos(arm: THREE.Object3D, out: THREE.Vector3) {
  return out
    .copy(HAND)
    .applyEuler((arm as THREE.Group).rotation)
    .add(arm.position);
}

/** Mette il personaggio nella posa del momento t (0 = riposo, uguale alla foto). */
function pose(a: Actor, t: number) {
  const { rig, slot } = a;
  const award = slot.award;
  const anim = t > 0 && t < 1;
  const [kl, kr] = KEYS[award];
  const [pl, pr] = anim ? [track(kl, t), track(kr, t)] : REST[award];
  // Durante l'applauso le mani si aprono e si chiudono.
  let clapL = pl[1],
    clapR = pr[1];
  if (award === "bronzo" && anim) {
    const c =
      bell(t, 0.16, 0.84, 0.06) *
      (0.5 - 0.5 * Math.cos(((t - 0.16) / 0.68) * Math.PI * 8));
    clapL = pl[1] + c * 0.13;
    clapR = pr[1] - c * 0.13;
  }
  rig.arms[0].rotation.set(pl[0], 0, clapL);
  rig.arms[1].rotation.set(pr[0], 0, clapR);

  // Corpo: il primo fa un saltello, il terzo saltella a ogni applauso, il secondo si gonfia d'orgoglio.
  let hop = 0,
    squash = 0,
    proud = 0;
  if (anim && award === "oro") {
    squash = bell(t, 0.02, 0.2, 0.08) * 0.04;
    hop =
      Math.max(
        0,
        Math.sin(Math.min(1, Math.max(0, (t - 0.16) / 0.26)) * Math.PI),
      ) * 0.16;
  }
  if (anim && award === "bronzo")
    hop =
      bell(t, 0.16, 0.84, 0.06) *
      Math.abs(Math.sin(((t - 0.16) / 0.68) * Math.PI * 4)) *
      0.05;
  if (anim && award === "argento") proud = bell(t, 0.42, 0.8, 0.12);
  rig.body.position.y = hop - squash;
  rig.body.scale.set(
    1 + squash * 0.5 + proud * 0.015,
    1 - squash + proud * 0.01,
    1 + squash * 0.5 + proud * 0.015,
  );

  // Testa: guarda la coppa, la medaglia o annuisce.
  const h = rig.head.rotation;
  if (anim && award === "oro")
    h.set(
      -0.12 * bell(t, 0.28, 0.8),
      0.25 * bell(t, 0.28, 0.8),
      -0.12 * bell(t, 0.28, 0.8),
    );
  else if (anim && award === "argento")
    h.set(
      0.12 * bell(t, 0.36, 0.82),
      -0.22 * bell(t, 0.36, 0.82),
      0.1 * bell(t, 0.36, 0.82),
    );
  else if (anim && award === "bronzo")
    h.set(0.06 * Math.sin(t * Math.PI * 8) * bell(t, 0.16, 0.84), 0, 0);
  else h.set(0, 0, 0);

  // Una strizzata d'occhi a metà gesto: è vivo.
  const blink = anim ? Math.max(0, 1 - Math.abs(t - 0.6) / 0.035) : 0;
  for (const e of rig.eyes) e.scale.y = 1 - blink * 0.9;

  // Il pallone: in mano solo al secondo.
  rig.ball.visible = award === "argento" || award === "riposo";
  rig.ball.position.y = a.restBallY;
  rig.ball.scale.setScalar(1);

  if (a.prop.trophy) {
    // In mano destra; a riposo sta in mezzo alle due mani, sul petto.
    const up =
      smooth(Math.min(1, Math.max(0, (t - 0.1) / 0.2))) *
      (anim ? 1 - smooth(Math.min(1, Math.max(0, (t - 0.78) / 0.2))) : 0);
    handPos(rig.arms[1], tmpV);
    a.prop.trophy.position.set(
      tmpV.x - 0.13 * (1 - up) - 0.02 * up,
      tmpV.y + 0.02 + up * 0.06,
      tmpV.z + 0.02,
    );
    a.prop.trophy.rotation.set(
      0,
      0,
      up * Math.sin(t * 26) * 0.08 * bell(t, 0.34, 0.76),
    );
  }
  if (a.prop.medal) {
    const { disc, strips } = a.prop.medal;
    const chest = tmpV.set(0, 1.34, 0.4);
    const held = anim ? bell(t, 0.24, 0.88, 0.04) : 0;
    const hand = handPos(rig.arms[0], new THREE.Vector3()).add(
      new THREE.Vector3(0.05, 0.02, 0.1),
    );
    disc.position.copy(chest).lerp(hand, held);
    disc.rotation.set(
      -0.08 * (1 - held),
      0.25 * held,
      0.12 * held * Math.sin(t * 18),
    );
    // I due lembi del nastro vanno dal collo all'anello della medaglia.
    const top = disc.position.clone().add(new THREE.Vector3(0, 0.18, 0));
    strips.forEach((s, i) => {
      const neck = new THREE.Vector3((i ? 1 : -1) * 0.17, 1.76, 0.29);
      const mid = neck.clone().add(top).multiplyScalar(0.5);
      const dir = top.clone().sub(neck);
      s.position.copy(mid);
      s.scale.y = dir.length();
      s.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
    });
  }
}

/** Cede il passo allo schermo: il lavoro riprende quando il telefono è libero. */
export const breathe = () =>
  new Promise<void>((r) =>
    window.requestIdleCallback
      ? window.requestIdleCallback(() => r(), { timeout: 200 })
      : window.setTimeout(r, 16),
  );

/** La foto di un ritaglio, in WebP (o PNG se il telefono non sa farla). */
export function encode(c: HTMLCanvasElement): string | null {
  try {
    return c.toDataURL("image/webp", 0.9);
  } catch {
    return null;
  }
}

export class PodiumStage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
  private actors: Actor[] = [];
  private raf = 0;
  private last = 0;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private disposed = false;
  private compiled: Promise<void> | null = null;
  private drag: { i: number; x: number; moved: number } | null = null;
  private env: THREE.WebGLRenderTarget;
  /** Chiamato alla fine di ogni movimento, quando il palco torna fermo. */
  onIdle?: () => void;
  /** Chiamato quando parte un gesto (per il suono). */
  onPlay?: (award: Award) => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    // La luce d'ambiente appartiene a questo renderer: non si può prestare a un altro palco.
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.04);
    pm.dispose();
    this.scene.environment = this.env.texture;
    const key = new THREE.DirectionalLight("#fff1dc", 2.0);
    key.position.set(-3, 5, 4);
    const rim = new THREE.DirectionalLight("#9ec3ff", 1.1);
    rim.position.set(3, 3, -4);
    this.scene.add(
      key,
      rim,
      new THREE.HemisphereLight("#ffffff", "#40362c", 0.6),
    );
    this.camera.rotation.x = -TILT;
  }

  /** Misura del palco in pixel CSS. */
  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    // Un'unità del mondo = un pixel CSS: i riquadri della pagina si mappano dritti.
    Object.assign(this.camera, {
      left: -this.w / 2,
      right: this.w / 2,
      top: this.h / 2,
      bottom: -this.h / 2,
    });
    this.camera.position.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /** Mette (o lascia) i personaggi nei posti; ridisegna una volta, già in posa di riposo. */
  async setSlots(slots: PodiumSlot[]) {
    await preloadTextures();
    if (this.disposed) return;
    const keep = new Map(this.actors.map((a) => [a.slot.key, a]));
    const next: Actor[] = [];
    for (const slot of slots) {
      let a = keep.get(slot.key);
      if (a && a.slot.award === slot.award) keep.delete(slot.key);
      else {
        // Un personaggio alla volta, lasciando respirare lo schermo tra uno e l'altro.
        await breathe();
        if (this.disposed) return;
        a = this.makeActor(slot);
      }
      a.slot = slot;
      this.place(a);
      next.push(a);
    }
    for (const old of keep.values()) this.drop(old);
    this.actors = next;
    // La prima volta si preparano i materiali senza bloccare lo schermo.
    this.compiled ??= this.renderer
      .compileAsync(this.scene, this.camera)
      .then(() => undefined)
      .catch(() => undefined);
    await this.compiled;
    if (!this.disposed) this.render();
  }

  private makeActor(slot: PodiumSlot): Actor {
    // Sul podio e con la coppa festeggiano tutti, anche chi di suo ha la faccia seria.
    const rig = buildCharacter(
      slot.preset,
      slot.outfit,
      slot.number,
      slot.award === "riposo" ? undefined : "festa",
    );
    const holder = new THREE.Group();
    holder.add(contactShadow(), rig.root);
    const upper = rig.arms[0].parent!;
    const prop: Actor["prop"] = {};
    if (slot.award === "oro") {
      prop.trophy = trophy();
      upper.add(prop.trophy);
    }
    if (slot.award === "argento") {
      prop.medal = medal();
      upper.add(prop.medal.disc, ...prop.medal.strips);
    }
    this.scene.add(holder);
    const yaw = restYaw(slot);
    return {
      slot,
      rig,
      holder,
      upper,
      restBallY: rig.ball.position.y,
      prop,
      play: 1,
      yaw,
      vYaw: 0,
      backAt: 0,
    };
  }

  private drop(a: Actor) {
    this.scene.remove(a.holder);
    disposeRig(a.rig);
  }

  private place(a: Actor) {
    const s = a.slot;
    const k = s.h / FIG_H;
    a.holder.scale.setScalar(k);
    // Piedi sulla base del riquadro (con la camera appena inclinata).
    a.holder.position.set(
      s.cx - this.w / 2,
      (this.h / 2 - s.bottom + 4) / Math.cos(TILT),
      0,
    );
    a.holder.rotation.y = a.yaw;
    pose(a, a.play >= 1 ? 0 : a.play);
  }

  /** Disegna un fotogramma. */
  render() {
    for (const a of this.actors) {
      a.holder.rotation.y = a.yaw;
      pose(a, a.play >= 1 ? 0 : a.play);
    }
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Le foto dei tre posti, ritagliate dall'ultimo fotogramma a riposo: identiche al 3D.
   * Va chiamata subito dopo un render (stesso giro), finché il fotogramma è ancora lì.
   */
  photos(): (HTMLCanvasElement | null)[] {
    this.render();
    const src = this.renderer.domElement;
    return this.actors.map((a) => {
      const s = a.slot;
      const c = document.createElement("canvas");
      c.width = Math.round(s.w * this.dpr);
      c.height = Math.round(s.h * this.dpr);
      const g = c.getContext("2d");
      if (!g) return null;
      g.drawImage(
        src,
        (s.cx - s.w / 2) * this.dpr,
        (s.bottom - s.h) * this.dpr,
        c.width,
        c.height,
        0,
        0,
        c.width,
        c.height,
      );
      return c;
    });
  }

  /** Ferma un personaggio a un punto preciso del suo gesto (per i controlli). */
  freeze(i: number, t: number) {
    const a = this.actors[i];
    if (!a) return;
    a.play = t >= 1 ? 1 : t;
    this.render();
  }

  /** Il gesto del tocco: parte dalla posa in cui è, senza attese. */
  play(i: number) {
    const a = this.actors[i];
    if (!a || (a.play > 0 && a.play < 1)) return;
    a.play = 0.0001;
    this.onPlay?.(a.slot.award);
    this.loop();
  }

  pointerDown(i: number, x: number) {
    if (!this.actors[i]) return;
    this.drag = { i, x, moved: 0 };
    this.actors[i].vYaw = 0;
  }

  pointerMove(x: number) {
    const d = this.drag;
    if (!d) return;
    const a = this.actors[d.i];
    const dx = x - d.x;
    d.x = x;
    d.moved += Math.abs(dx);
    a.yaw += dx * 0.02;
    a.vYaw = dx * 1.1;
    this.loop();
  }

  /** Il dito se n'è andato a scorrere la pagina: niente gesto, torna di fronte. */
  pointerCancel() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    this.actors[d.i].backAt = performance.now() + 300;
    this.loop();
  }

  /** Restituisce true se era un tocco (non un trascinamento). */
  pointerUp(): boolean {
    const d = this.drag;
    this.drag = null;
    if (!d) return false;
    const a = this.actors[d.i];
    if (d.moved < 8) {
      this.play(d.i);
      return true;
    }
    a.backAt = performance.now() + 1300;
    this.loop();
    return false;
  }

  private loop() {
    if (this.raf || this.disposed) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    let busy = false;
    this.actors.forEach((a, i) => {
      if (a.play < 1) {
        a.play = Math.min(1, a.play + dt / DURATION[a.slot.award]);
        busy ||= a.play < 1;
      }
      if (this.drag?.i === i) {
        busy = true;
        return;
      }
      // Lasciato andare: gira ancora un poco, poi torna piano a guardare avanti.
      if (Math.abs(a.vYaw) > 0.01) {
        a.yaw += a.vYaw * dt;
        a.vYaw *= Math.pow(0.03, dt);
        busy = true;
      }
      const rest = restYaw(a.slot);
      if (now > a.backAt && Math.abs(a.vYaw) <= 0.01) {
        // La strada più corta per tornare di fronte.
        let diff = rest - a.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(diff) > 0.002) {
          a.yaw += diff * (1 - Math.pow(0.004, dt));
          busy = true;
        } else a.yaw = rest;
      } else if (Math.abs(a.yaw - rest) > 0.002) busy = true;
    });
    this.render();
    if (busy) this.raf = requestAnimationFrame(this.tick);
    else this.onIdle?.();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const a of this.actors) this.drop(a);
    this.actors = [];
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/**
 * Una foto sola (per la Home): il personaggio in un riquadro w×h, fermo, con la coppa se "oro".
 * Usa un palco nascosto che si butta subito dopo, così non resta niente in memoria.
 * `fig`: quanto è alto il personaggio nel riquadro (il resto è aria per quello che sporge).
 */
let photoStage: {
  stage: PodiumStage;
  canvas: HTMLCanvasElement;
  timer: number;
} | null = null;

export async function figurePhoto(
  o: Omit<PodiumSlot, "cx" | "bottom" | "key"> & { fig: number },
): Promise<string | null> {
  // Un solo palco nascosto per tutte le foto: si butta poco dopo l'ultima.
  if (!photoStage) {
    const canvas = document.createElement("canvas");
    photoStage = { stage: new PodiumStage(canvas), canvas, timer: 0 };
  }
  const ps = photoStage;
  window.clearTimeout(ps.timer);
  try {
    ps.stage.resize(o.w, o.h);
    await ps.stage.setSlots([
      {
        ...o,
        key: `foto|${o.preset}|${JSON.stringify(o.outfit)}|${o.number ?? ""}`,
        cx: o.w / 2,
        bottom: o.h,
        h: o.fig,
      },
    ]);
    ps.stage.render();
    return encode(ps.canvas);
  } catch {
    return null;
  } finally {
    ps.timer = window.setTimeout(() => {
      if (photoStage === ps) {
        ps.stage.dispose();
        photoStage = null;
      }
    }, 5000);
  }
}
