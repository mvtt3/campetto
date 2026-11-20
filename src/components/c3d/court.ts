/**
 * Il campetto in 3D per il tiro del giorno: il canestro, le righe, il tuo personaggio di
 * spalle sui cinque punti da tre. Disegna solo quando qualcosa si muove.
 */
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { animateRig, buildCharacter, disposeRig, preloadTextures, type CharacterRig, type Outfit, type Preset } from "./build";

export { preloadTextures };

const RIM_Y = 4.6;
const RIM_R = 0.36;
const THREE_PT = 10;

/** I cinque punti: angolo sinistro, ala sinistra, centro, ala destra, angolo destro. */
export const SPOTS: { name: string; at: [number, number] }[] = [
  { name: "Angolo sinistro", at: [-THREE_PT, 0.9] },
  { name: "Ala sinistra", at: [-THREE_PT * 0.72, THREE_PT * 0.72] },
  { name: "Centro", at: [0, THREE_PT + 0.2] },
  { name: "Ala destra", at: [THREE_PT * 0.72, THREE_PT * 0.72] },
  { name: "Angolo destro", at: [THREE_PT, 0.9] },
];

function courtTexture() {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  // Il campo blu del campetto, con l'area più scura.
  g.fillStyle = "#2d5be3";
  g.fillRect(0, 0, S, S);
  // Una grana leggera, come l'asfalto verniciato.
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},0.035)`;
    g.fillRect((i * 389) % S, (i * 211 + (i >> 3)) % S, 2, 2);
  }
  // 1 unità = 32 px; il canestro sta a (512, 96).
  const u = 32;
  const hx = S / 2, hy = 96;
  g.fillStyle = "#1f45b8";
  g.fillRect(hx - 2.6 * u, 0, 5.2 * u, hy + 6 * u);
  g.strokeStyle = "#fffaf0";
  g.lineWidth = 6;
  g.strokeRect(hx - 2.6 * u, -10, 5.2 * u, hy + 6 * u + 10);
  g.beginPath();
  g.arc(hx, hy + 6 * u, 2.6 * u, 0, Math.PI);
  g.stroke();
  // La linea da tre: due tratti dritti negli angoli e l'arco.
  const a = Math.asin(0.9 / THREE_PT);
  g.beginPath();
  g.moveTo(hx - THREE_PT * u, 0);
  g.lineTo(hx - THREE_PT * u, hy + 0.9 * u);
  g.arc(hx, hy, THREE_PT * u, Math.PI - a, a, true);
  g.lineTo(hx + THREE_PT * u, 0);
  g.stroke();
  // Il fondo campo.
  g.beginPath();
  g.moveTo(0, 4);
  g.lineTo(S, 4);
  g.stroke();
  // I cinque punti di tiro, pallini gialli.
  g.fillStyle = "#ffc531";
  for (const s of SPOTS) {
    g.beginPath();
    g.arc(hx + s.at[0] * u, hy + s.at[1] * u, 14, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { t, size: S / u, hy: hy / u };
}

function netTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 3;
  for (let i = -8; i < 16; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32 + 128, 128);
    g.moveTo(i * 32 + 128, 0);
    g.lineTo(i * 32, 128);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(2, 1);
  return t;
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export type ShotResult = "made" | "miss";

export class Court {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private rig: CharacterRig | null = null;
  private body = new THREE.Group();
  private ball: THREE.Mesh;
  private net: THREE.Mesh;
  private raf = 0;
  private t0 = performance.now();
  private last = performance.now();
  private disposed = false;
  private paused = false;
  private ro: ResizeObserver;
  /** Spostamento da un punto all'altro. */
  private move: { from: THREE.Vector3; to: THREE.Vector3; yawFrom: number; yawTo: number; t: number } | null = null;
  /** Il tiro in volo. */
  private shot: { t: number; result: ShotResult; p0: THREE.Vector3; p1: THREE.Vector3; done: () => void; after: number } | null = null;
  private netKick = 1;
  private skip = false;
  private compiling = false;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lookNow = new THREE.Vector3();
  onFirstFrame?: () => void;
  /** Dove sta, sullo schermo, il fianco destro del personaggio (per la barra del tiro). */
  onAnchor?: (x: number, top: number, bottom: number) => void;
  private anchorLast = "";
  private firstDone = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    // Cielo della sera d'inverno: sfumatura verso l'arancio in basso.
    this.scene.background = (() => {
      const c = document.createElement("canvas");
      c.width = 2;
      c.height = 256;
      const g = c.getContext("2d")!;
      const grd = g.createLinearGradient(0, 0, 0, 256);
      grd.addColorStop(0, "#1b2a5c");
      grd.addColorStop(0.55, "#3d6af0");
      grd.addColorStop(1, "#f6a35c");
      g.fillStyle = grd;
      g.fillRect(0, 0, 2, 256);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.scene.fog = new THREE.Fog("#6d86d8", 30, 70);
    const key = new THREE.DirectionalLight("#fff1dc", 2.2);
    key.position.set(-6, 14, 10);
    this.scene.add(key, new THREE.HemisphereLight("#cfe0ff", "#2a3a7a", 0.9));

    // Il campo.
    const ct = courtTexture();
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ct.size, ct.size), new THREE.MeshStandardMaterial({ map: ct.t, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, ct.size / 2 - ct.hy);
    const around = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), new THREE.MeshStandardMaterial({ color: "#3a3f4a", roughness: 1 }));
    around.rotation.x = -Math.PI / 2;
    around.position.y = -0.01;
    this.scene.add(around, floor);

    // Il canestro: palo, tabellone, ferro, retina.
    const steel = new THREE.MeshStandardMaterial({ color: "#2b2f38", roughness: 0.5, metalness: 0.6 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, RIM_Y + 1.6, 16), steel);
    pole.position.set(0, (RIM_Y + 1.6) / 2, -2.4);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2), steel);
    arm.position.set(0, RIM_Y + 0.9, -1.45);
    // Il tabellone: bianco col riquadro arancione disegnato sopra (una tela, niente linee 3D).
    const bc = document.createElement("canvas");
    bc.width = 360;
    bc.height = 220;
    const bg = bc.getContext("2d")!;
    bg.fillStyle = "#fbfaf6";
    bg.fillRect(0, 0, 360, 220);
    bg.strokeStyle = "#1d1a16";
    bg.lineWidth = 10;
    bg.strokeRect(5, 5, 350, 210);
    bg.strokeStyle = "#f26a1b";
    bg.lineWidth = 8;
    bg.strokeRect(120, 100, 120, 90);
    const bt = new THREE.CanvasTexture(bc);
    bt.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new RoundedBoxGeometry(3.6, 2.2, 0.12, 2, 0.04), [
      new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ map: bt, roughness: 0.3 }),
      new THREE.MeshStandardMaterial({ color: "#d9d6cf", roughness: 0.4 }),
    ]);
    board.position.set(0, RIM_Y + 0.8, -0.55);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(RIM_R, 0.035, 10, 40), new THREE.MeshStandardMaterial({ color: "#f26a1b", roughness: 0.35, metalness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, RIM_Y, 0);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.42), rim.material);
    neck.position.set(0, RIM_Y, -0.38);
    this.net = new THREE.Mesh(
      new THREE.CylinderGeometry(RIM_R, RIM_R * 0.62, 0.62, 20, 1, true),
      new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.3, opacity: 0.9 }),
    );
    this.net.position.set(0, RIM_Y - 0.31, 0);
    this.scene.add(pole, arm, board, rim, neck, this.net);

    // Il pallone che vola (quello in mano si nasconde durante il tiro).
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), new THREE.MeshStandardMaterial({ color: "#f26a1b", roughness: 0.7 }));
    this.ball.visible = false;
    this.scene.add(this.ball, this.body);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    document.addEventListener("visibilitychange", this.onVis);
    this.resize();
  }

  setCharacter(preset: Preset, outfit: Outfit, number?: string) {
    if (this.rig) {
      this.body.remove(this.rig.root);
      disposeRig(this.rig);
    }
    this.rig = buildCharacter(preset, outfit, number);
    this.body.add(this.rig.root);
    // Il pallone che vola è uguale a quello che hai in mano.
    this.ball.material = this.rig.ball.material as THREE.Material;
    if (!this.firstDone) {
      this.compiling = true;
      void this.renderer
        .compileAsync(this.scene, this.camera)
        .catch(() => undefined)
        .finally(() => {
          this.compiling = false;
          this.loop();
        });
    }
    this.loop();
  }

  private spotPos(i: number) {
    const [x, z] = SPOTS[i].at;
    return new THREE.Vector3(x, 0, z);
  }

  private yawTo(p: THREE.Vector3) {
    return Math.atan2(-p.x, -p.z);
  }

  /** La camera sta dietro al personaggio, un po' alta, e guarda il ferro. */
  private aim(p: THREE.Vector3, snap = false) {
    const back = p.clone().setY(0).normalize();
    if (back.lengthSq() < 0.01) back.set(0, 0, 1);
    // Un po' di lato, come le telecamere dei giochi di basket: si vedono il personaggio e il ferro.
    const side = new THREE.Vector3(back.z, 0, -back.x);
    this.camPos.copy(p).addScaledVector(back, 7.6).addScaledVector(side, 1.1).setY(4.7);
    this.camLook.set(0, 0, 0).lerp(p, 0.5).setY(2.7);
    if (snap) {
      this.camera.position.copy(this.camPos);
      this.lookNow.copy(this.camLook);
      this.camera.lookAt(this.lookNow);
    }
  }

  goTo(i: number, snap = false) {
    const to = this.spotPos(i);
    if (snap) {
      this.body.position.copy(to);
      this.body.rotation.y = this.yawTo(to);
      this.aim(to, true);
    } else {
      this.move = { from: this.body.position.clone(), to, yawFrom: this.body.rotation.y, yawTo: this.yawTo(to), t: 0 };
      this.aim(to);
    }
    this.loop();
  }

  /** Tira: la palla parte dalle mani e va verso il ferro; "done" arriva quando è ricaduta. */
  shoot(result: ShotResult, done: () => void) {
    if (!this.rig || this.shot) return;
    const p0 = new THREE.Vector3(0, 3.3, 0.15).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.body.rotation.y).add(this.body.position);
    // Il tiro sbagliato tocca il ferro davanti o di lato e rimbalza fuori.
    const side = Math.random() < 0.5 ? -1 : 1;
    const toShooter = this.body.position.clone().setY(0).normalize();
    const p1 =
      result === "made"
        ? new THREE.Vector3(0, RIM_Y + 0.05, 0)
        : new THREE.Vector3(0, RIM_Y + 0.12, 0)
            .addScaledVector(toShooter, RIM_R * 0.95)
            .add(new THREE.Vector3(toShooter.z, 0, -toShooter.x).multiplyScalar(side * RIM_R * 0.5));
    this.shot = { t: -0.32, result, p0, p1, done, after: 0 };
    this.loop();
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (!p) {
      this.last = performance.now();
      this.loop();
    }
  }

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Sugli schermi stretti si allarga la vista, così ferro e personaggio stanno dentro.
    this.camera.fov = w / h < 0.7 ? 52 : 42;
    this.camera.updateProjectionMatrix();
    this.loop();
  }

  private onVis = () => {
    if (!document.hidden) {
      this.last = performance.now();
      this.loop();
    }
  };

  private loop = () => {
    if (this.raf || this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
  };

  private tick = (now: number) => {
    this.raf = 0;
    if (this.disposed || this.paused || this.compiling || document.hidden) return;
    const busy = !!this.move || !!this.shot || this.netKick < 1 || this.camera.position.distanceToSquared(this.camPos) > 1e-4;
    this.skip = busy ? false : !this.skip;
    if (this.skip && this.firstDone) return this.loop();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = (now - this.t0) / 1000;
    const rig = this.rig;

    if (this.move) {
      const m = this.move;
      m.t = Math.min(1, m.t + dt / 0.75);
      const k = easeInOut(m.t);
      this.body.position.lerpVectors(m.from, m.to, k);
      let dy = m.yawTo - m.yawFrom;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.body.rotation.y = m.yawFrom + dy * k;
      if (m.t >= 1) this.move = null;
    }
    const kc = 1 - Math.pow(0.004, dt);
    this.camera.position.lerp(this.camPos, kc);
    this.lookNow.lerp(this.camLook, kc);
    this.camera.lookAt(this.lookNow);

    if (rig) {
      animateRig(rig, t, 1);
      rig.root.position.y = 0;
      const s = this.shot;
      if (s) {
        // Preparazione (t<0): si piega e porta su le braccia; poi salta e lascia andare.
        if (s.t < 0) {
          const k = 1 + s.t / 0.32;
          rig.root.position.y = -0.18 * Math.sin(k * Math.PI * 0.5);
          rig.arms[0].rotation.z = -0.2 - 2.4 * k;
          rig.arms[1].rotation.z = 0.5 + 2.2 * k;
          rig.ball.position.y = (rig.ball.userData.rest as number) + 2.6 * k;
          rig.ball.position.x = 0.48 - 0.45 * k;
          rig.ball.visible = true;
        } else {
          const up = Math.max(0, Math.sin(Math.min(1, s.t / 0.55) * Math.PI));
          rig.root.position.y = 0.55 * up;
          rig.arms[0].rotation.z = -2.6;
          rig.arms[1].rotation.z = 2.7;
          rig.ball.visible = false;
        }
      } else {
        rig.ball.position.x = (rig.ball.userData.restX as number | undefined) ?? rig.ball.position.x;
        rig.ball.visible = true;
      }
    }

    const s = this.shot;
    if (s) {
      s.t += dt;
      const FLY = 1.05;
      if (s.t >= 0) {
        this.ball.visible = true;
        if (s.t <= FLY) {
          const k = s.t / FLY;
          const h = 3.2;
          this.ball.position.set(
            s.p0.x + (s.p1.x - s.p0.x) * k,
            s.p0.y + (s.p1.y - s.p0.y) * k + 4 * h * k * (1 - k),
            s.p0.z + (s.p1.z - s.p0.z) * k,
          );
          this.ball.rotation.x -= dt * 9;
        } else {
          // Dopo il ferro: dentro scende nella retina, fuori rimbalza via.
          const a = s.t - FLY;
          if (s.result === "made") {
            if (s.after === 0) {
              s.after = 1;
              this.netKick = 0;
            }
            const y = RIM_Y + 0.05 - 4.9 * a * a - 0.6 * a;
            this.ball.position.set(0, Math.max(0.22, y), 0);
          } else {
            const out = s.p1.clone().setY(0).normalize();
            const y = s.p1.y + 2.6 * a - 6 * a * a;
            this.ball.position.set(s.p1.x + out.x * 2.4 * a, Math.max(0.22, y), s.p1.z + out.z * 2.4 * a);
          }
          this.ball.rotation.x -= dt * 6;
          if (a > 0.95) {
            this.ball.visible = false;
            this.shot = null;
            s.done();
          }
        }
      }
    }
    if (this.netKick < 1) {
      this.netKick = Math.min(1, this.netKick + dt / 0.6);
      const w = Math.sin(this.netKick * Math.PI * 3) * (1 - this.netKick);
      this.net.scale.set(1 - w * 0.12, 1 + w * 0.35, 1 - w * 0.12);
    }

    this.renderer.render(this.scene, this.camera);
    this.anchor();
    if (!this.firstDone && rig) {
      this.firstDone = true;
      this.onFirstFrame?.();
    }
    this.loop();
  };

  private anchor() {
    if (!this.onAnchor) return;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).setY(0).normalize();
    const base = this.body.position.clone().addScaledVector(right, 1.25);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const css = (v: THREE.Vector3) => {
      v.project(this.camera);
      return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
    };
    const [x, top] = css(base.clone().setY(3.0));
    const [, bottom] = css(base.clone().setY(0.9));
    const key = `${Math.round(x)}:${Math.round(top)}:${Math.round(bottom)}`;
    if (key === this.anchorLast) return;
    this.anchorLast = key;
    this.onAnchor(x, top, bottom);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    document.removeEventListener("visibilitychange", this.onVis);
    if (this.rig) {
      this.body.remove(this.rig.root);
      disposeRig(this.rig);
    }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m !== this.ball) {
        m.geometry.dispose();
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
          mat.map?.dispose();
          mat.dispose();
        }
      }
    });
    this.renderer.dispose();
  }
}
