/**
 * Il palco 3D: un solo renderer per vista, disegna solo quando serve (si ferma fuori
 * schermo o con l'app in background), al massimo a 1,5x di risoluzione, niente ombre vere
 * (un'ombra morbida dipinta sotto i piedi). Così regge anche sui telefoni più lenti.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { animateRig, buildCharacter, disposeRig, swayRig, type CharacterRig, type Outfit, type Preset } from "./build";

export type Framing = "full" | "testa" | "collo" | "busto" | "braccio" | "gambe" | "piedi" | "pallone";

/** Dove guarda la camera per ogni parte del corpo (target y, distanza, spostamento x). */
const FRAMES: Record<Framing, { y: number; d: number; x?: number; yaw?: number }> = {
  full: { y: 1.5, d: 8.4 },
  testa: { y: 2.62, d: 4.8, yaw: -0.4 },
  collo: { y: 1.95, d: 4.4, yaw: -0.55 },
  busto: { y: 1.4, d: 5.0, yaw: -0.25 },
  braccio: { y: 1.3, d: 3.6, x: -0.42, yaw: 0.55 },
  gambe: { y: 0.78, d: 3.8, yaw: -0.3 },
  piedi: { y: 0.3, d: 2.9, yaw: -0.6 },
  pallone: { y: 0.72, d: 2.3, x: 0.7, yaw: -0.2 },
};

let envTex: THREE.Texture | null = null;
function environment(renderer: THREE.WebGLRenderer) {
  if (!envTex) {
    const pm = new THREE.PMREMGenerator(renderer);
    envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
  }
  return envTex;
}

function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.005;
  return m;
}

function makeScene(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  scene.environment = environment(renderer);
  const key = new THREE.DirectionalLight("#fff1dc", 2.0);
  key.position.set(-3, 5, 4);
  const rim = new THREE.DirectionalLight("#9ec3ff", 1.1);
  rim.position.set(3, 3, -4);
  scene.add(key, rim, new THREE.HemisphereLight("#ffffff", "#40362c", 0.6));
  return scene;
}

function makeRenderer(canvas: HTMLCanvasElement, maxDpr: number) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

export interface StageOptions {
  interactive?: boolean;
  framing?: Framing;
  /** Rotazione di partenza (radianti). */
  yaw?: number;
  /** Gira da solo piano, come in vetrina (radianti al secondo); si ferma mentre lo tocchi. */
  spin?: number;
  /**
   * Gira attorno a un oggetto che non sta sull'asse del personaggio (il pallone in mano, la
   * fascia sul braccio): così, girando, resta al centro dell'inquadratura invece di uscirne.
   */
  pivot?: "pallone" | "braccio";
}

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  private holder = new THREE.Group();
  private rig: CharacterRig | null = null;
  private raf = 0;
  private visible = true;
  private t0 = performance.now();
  private last = performance.now();
  private yaw: number;
  private vYaw = 0;
  private dribble = 1;
  private pop = 1;
  private dragging = false;
  private lastX = 0;
  private moved = 0;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private framing: Framing;
  private disposed = false;
  private shadow: THREE.Mesh;
  onFirstFrame?: () => void;
  private firstDone = false;

  constructor(private canvas: HTMLCanvasElement, private opts: StageOptions = {}) {
    this.renderer = makeRenderer(canvas, 1.5);
    this.scene = makeScene(this.renderer);
    this.scene.add(this.holder);
    this.shadow = contactShadow();
    this.holder.add(this.shadow);
    this.yaw = opts.yaw ?? -0.35;
    this.prevYaw = this.yaw;
    this.framing = opts.framing ?? "full";
    this.frame();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) {
        this.last = performance.now();
        this.loop();
      }
    });
    this.io.observe(canvas);
    document.addEventListener("visibilitychange", this.onVis);
    if (opts.interactive) {
      canvas.addEventListener("pointerdown", this.onDown);
      window.addEventListener("pointermove", this.onMove);
      window.addEventListener("pointerup", this.onUp);
      canvas.style.touchAction = "pan-y";
    }
    this.resize();
    this.loop();
  }

  private paused = false;
  /** Fermo (per esempio sotto a un'altra finestra): non disegna e non consuma. */
  setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      this.last = performance.now();
      this.loop();
    }
  }

  setFraming(f: Framing) {
    this.framing = f;
    this.frame();
  }

  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lookNow = new THREE.Vector3();
  private framed = false;

  /** La camera scivola verso la parte del corpo scelta (al primo colpo ci va diretta). */
  private frame(snap = false) {
    const f = FRAMES[this.framing];
    // Su uno schermo più alto che largo ci si allontana un po', così l'oggetto resta tutto in vista.
    const d = f.d * Math.max(1, 1 / Math.max(0.5, this.camera.aspect)) ** 0.8;
    // Col perno l'oggetto è già sull'asse: la camera guarda dritto al centro.
    const x = this.opts.pivot ? 0 : (f.x ?? 0);
    this.camPos.set(x, f.y + d * 0.08, d);
    this.camLook.set(x, f.y, 0);
    if (!this.framed || snap) {
      this.framed = true;
      this.camera.position.copy(this.camPos);
      this.lookNow.copy(this.camLook);
      this.camera.lookAt(this.lookNow);
    }
    this.loop();
  }

  private compiling = false;

  setCharacter(preset: Preset, outfit: Outfit, number?: string) {
    const old = this.rig;
    this.rig = buildCharacter(preset, outfit, number);
    this.holder.add(this.rig.root);
    this.centerPivot();
    if (!old && !this.firstDone) {
      // La prima volta si preparano i materiali in parallelo, senza bloccare lo schermo.
      this.compiling = true;
      void this.renderer
        .compileAsync(this.scene, this.camera)
        .catch(() => undefined)
        .finally(() => {
          this.compiling = false;
          this.loop();
        });
    }
    if (old) {
      this.holder.remove(old.root);
      disposeRig(old);
      this.pop = 0;
    }
    this.loop();
  }

  /** Sposta il personaggio in modo che l'oggetto scelto stia sull'asse di rotazione. */
  private centerPivot() {
    const r = this.rig;
    if (!r || !this.opts.pivot) return;
    r.root.position.set(0, 0, 0);
    this.holder.updateMatrixWorld(true);
    const target = this.opts.pivot === "pallone" ? r.ball : r.arms[0];
    const c = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
    this.holder.worldToLocal(c);
    r.root.position.set(-c.x, 0, -c.z);
    this.shadow.position.set(0, this.shadow.position.y, 0);
    // Il pallone da solo, come in vetrina: il personaggio non gli passa davanti girando.
    if (this.opts.pivot === "pallone") {
      r.body.visible = false;
      this.shadow.scale.setScalar(0.45);
    }
  }

  /** Il palleggio, come quando lo tocchi. */
  dribbleNow() {
    if (this.dribble >= 1) this.dribble = 0;
    this.loop();
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame(!this.firstDone);
  }

  private onVis = () => {
    if (!document.hidden) {
      this.last = performance.now();
      this.loop();
    }
  };

  private spinHold = 0;
  /** Il "vento" sui vestiti: una molla che insegue la velocità con cui gira il personaggio. */
  private sway = 0;
  private swayV = 0;
  private prevYaw = 0;

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.spinHold = Infinity;
    this.lastX = e.clientX;
    this.moved = 0;
    this.vYaw = 0;
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    this.lastX = e.clientX;
    this.moved += Math.abs(dx);
    this.yaw += dx * 0.012;
    this.vYaw = dx * 0.7;
    this.loop();
  };
  private onUp = () => {
    if (!this.dragging) return;
    this.dragging = false;
    this.spinHold = performance.now() + 1400;
    if (this.moved < 6) this.dribbleNow();
  };

  private loop = () => {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private skip = false;

  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.paused || this.compiling || !this.visible || document.hidden) return;
    // Quando nessuno lo tocca respira e basta: basta mezzo ritmo (30 al secondo), metà fatica.
    const spin = this.opts.spin ?? 0;
    const busy =
      this.dragging ||
      (spin !== 0 && performance.now() > this.spinHold) ||
      Math.abs(this.vYaw) > 0.02 ||
      Math.abs(this.sway) > 0.004 ||
      Math.abs(this.swayV) > 0.02 ||
      this.dribble < 1 ||
      this.pop < 1 ||
      this.camera.position.distanceToSquared(this.camPos) > 1e-5;
    this.skip = busy ? false : !this.skip;
    if (this.skip && this.firstDone) {
      this.loop();
      return;
    }
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    if (!this.dragging) {
      this.vYaw *= Math.pow(0.04, dt);
      this.yaw += this.vYaw * dt;
      // In vetrina riparte da solo un attimo dopo che l'hai lasciato.
      if (spin && now > this.spinHold) this.yaw += spin * dt * Math.min(1, (now - this.spinHold) / 600);
    }
    if (this.dribble < 1) this.dribble = Math.min(1, this.dribble + dt / 1.1);
    if (this.pop < 1) this.pop = Math.min(1, this.pop + dt / 0.45);
    const p = this.pop < 1 ? 1 + Math.sin(this.pop * Math.PI) * 0.06 : 1;
    this.holder.scale.setScalar(p);
    this.holder.rotation.y = this.yaw;
    // I vestiti restano indietro rispetto a dove gira (velocità opposta), poi lo raggiungono.
    if (dt > 0) {
      const w = (this.yaw - this.prevYaw) / dt;
      const target = Math.max(-0.6, Math.min(0.6, -w * 0.09));
      this.swayV += (55 * (target - this.sway) - 8 * this.swayV) * dt;
      this.sway += this.swayV * dt;
    }
    this.prevYaw = this.yaw;
    const k = 1 - Math.pow(0.002, dt);
    this.camera.position.lerp(this.camPos, k);
    this.lookNow.lerp(this.camLook, k);
    this.camera.lookAt(this.lookNow);
    if (this.rig) {
      animateRig(this.rig, t, this.dribble);
      swayRig(this.rig, this.sway, t);
    }
    this.renderer.render(this.scene, this.camera);
    if (!this.firstDone && this.rig) {
      this.firstDone = true;
      this.onFirstFrame?.();
    }
    this.loop();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    if (this.rig) disposeRig(this.rig);
    this.renderer.dispose();
  }
}

/* ---------------------------------------------------------------- */
/* Le foto dei personaggi e degli oggetti (per liste e griglie)      */
/* ---------------------------------------------------------------- */

let shot: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } | null = null;

/**
 * Una foto del personaggio con quello che indossa, inquadrata su una parte del corpo.
 * Un solo renderer nascosto per tutte le foto: nelle liste si vedono immagini, non 3D vivo.
 */
export function snapshot(preset: Preset, outfit: Outfit, framing: Framing, size = 192, yaw = -0.35): Promise<Blob | null> {
  if (!shot) {
    const c = document.createElement("canvas");
    const renderer = makeRenderer(c, 1);
    shot = { renderer, scene: makeScene(renderer), camera: new THREE.PerspectiveCamera(28, 1, 0.1, 60) };
  }
  const { renderer, scene, camera } = shot;
  renderer.setSize(size, size, false);
  const f = FRAMES[framing];
  camera.aspect = 1;
  camera.fov = framing === "full" ? 30 : 28;
  camera.position.set(f.x ?? 0, f.y + f.d * 0.08, framing === "full" ? 7.2 : f.d);
  camera.lookAt(f.x ?? 0, f.y, 0);
  camera.updateProjectionMatrix();
  const rig = buildCharacter(preset, outfit);
  rig.root.rotation.y = f.yaw ?? yaw;
  scene.add(rig.root);
  animateRig(rig, 0.4, 1);
  renderer.render(scene, camera);
  // La copia dell'immagine si prende subito; la compressione avviene dopo, senza bloccare.
  const done = new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, "image/webp", 0.88));
  scene.remove(rig.root);
  disposeRig(rig);
  return done;
}

export { preloadTextures } from "./build";
