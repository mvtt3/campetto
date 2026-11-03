"use client";

import { X } from "lucide-react";
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Character, type Pose } from "@/components/character";
import type { AvatarPresetId } from "@/components/avatar-presets";
import { seeded } from "@/lib/game/economy";
import {
  COURT,
  PLAYER_H,
  courtLines,
  floor,
  projector,
  v3,
  type Camera,
  type Projector,
  type V3,
} from "@/lib/game/camera";
import type { GameState } from "@/lib/game/types";

/**
 * Il palazzetto in 3D (prospettiva vera, disegnata in SVG): parquet blu a retino come
 * i poster dell'app, linee color crema, canestro col tabellone, pubblico sugli spalti,
 * cartelloni e luci. I personaggi sono i disegni dell'app, in piedi sul campo, più
 * grandi quando sono vicini alla telecamera, con la loro ombra.
 */

const INK = "#1D1A16";
const CREAM = "#FFF8EA";
const NEAR = 0.6;

export function useStage() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

type Pt = { x: number; y: number; s: number; depth: number };

/** Taglia un segmento contro il piano davanti alla telecamera (niente linee impazzite). */
function clipSeg(P: Projector, a: V3, b: V3): [Pt, Pt] | null {
  let pa = P.p(a);
  let pb = P.p(b);
  if (pa.depth < NEAR && pb.depth < NEAR) return null;
  if (pa.depth < NEAR || pb.depth < NEAR) {
    const t = (NEAR - pa.depth) / (pb.depth - pa.depth);
    const m = v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    if (pa.depth < NEAR) pa = P.p(m);
    else pb = P.p(m);
  }
  return [pa, pb];
}

/** Un poligono a terra (o in piedi), tagliato davanti alla telecamera. */
function clipPoly(P: Projector, pts: V3[]): string | null {
  const out: V3[] = [];
  const d = pts.map((q) => P.p(q).depth);
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const a = pts[i];
    const b = pts[j];
    const ina = d[i] >= NEAR;
    const inb = d[j] >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (NEAR - d[i]) / (d[j] - d[i]);
      out.push(v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t));
    }
  }
  if (out.length < 3) return null;
  return out
    .map((q) => {
      const r = P.p(q);
      return `${r.x.toFixed(1)},${r.y.toFixed(1)}`;
    })
    .join(" ");
}

const SKIN = ["#F2C9A0", "#E0A97A", "#C68A5C", "#8D5A3B", "#5E3A25", "#F5D7B8"];
const HAIR = ["#1D1A16", "#4A2E1C", "#8A5A2B", "#D8B062", "#2B2724"];

interface Fan {
  p: V3;
  skin: string;
  shirt: string;
  hair: string;
  g: number;
}

/** Il pubblico: sempre lo stesso per ogni palazzetto, coi colori delle due squadre. */
function makeCrowd(home: string, away: string, seed: string): Fan[] {
  const r = seeded(seed);
  const shirts = [home, home, away, CREAM, "#FFC531", "#7C4DCC", "#2E9E5B"];
  const fans: Fan[] = [];
  // Dietro il canestro.
  for (let row = 0; row < 6; row++)
    for (let x = -9.6; x <= 9.6; x += 0.62)
      fans.push({
        p: v3(x + (r() - 0.5) * 0.25, 1.15 + row * 0.62, -1.6 - row * 0.8),
        skin: SKIN[Math.floor(r() * SKIN.length)],
        shirt: shirts[Math.floor(r() * shirts.length)],
        hair: HAIR[Math.floor(r() * HAIR.length)],
        g: Math.floor(r() * 3),
      });
  // Sui due lati.
  for (const side of [-1, 1])
    for (let row = 0; row < 5; row++)
      for (let z = 0.2; z <= 17; z += 0.7)
        fans.push({
          p: v3(side * (9.3 + row * 0.85), 1.15 + row * 0.62, z + (r() - 0.5) * 0.25),
          skin: SKIN[Math.floor(r() * SKIN.length)],
          shirt: shirts[Math.floor(r() * shirts.length)],
          hair: HAIR[Math.floor(r() * HAIR.length)],
          g: Math.floor(r() * 3),
        });
  return fans;
}

const BOARDS = ["CAMPETTO STAR", "PASTA SPICCHIO", "NICHELINO", "BASKET NOSTRA", "SPICCHIO COLA"];

/** Lo sfondo fisso della scena: spalti, cartelloni, parquet, linee, tabellone. */
export const Arena = memo(function Arena({
  cam,
  home,
  away,
  seed,
}: {
  cam: Camera;
  home: string;
  away: string;
  seed: string;
}) {
  const P = useMemo(() => projector(cam), [cam]);
  const crowd = useMemo(() => makeCrowd(home, away, seed), [home, away, seed]);
  const { w, h } = cam;
  const lines = useMemo(() => courtLines(), []);
  const lw = (q: Pt) => Math.max(1.1, q.s * 0.07);

  // Le gradinate: grandi blocchi scuri dietro e ai lati.
  const standBack = clipPoly(P, [v3(-11, 0, -1.2), v3(11, 0, -1.2), v3(11, 5.2, -6.6), v3(-11, 5.2, -6.6)]);
  const standL = clipPoly(P, [v3(-8.8, 0, -1.2), v3(-8.8, 0, 20), v3(-13.6, 4.4, 20), v3(-13.6, 4.4, -1.2)]);
  const standR = clipPoly(P, [v3(8.8, 0, -1.2), v3(8.8, 0, 20), v3(13.6, 4.4, 20), v3(13.6, 4.4, -1.2)]);
  const apron = clipPoly(P, [floor(-9.2, -1.2), floor(9.2, -1.2), floor(9.2, 22), floor(-9.2, 22)]);
  const court = clipPoly(P, [floor(-COURT.halfW, 0), floor(COURT.halfW, 0), floor(COURT.halfW, 22), floor(-COURT.halfW, 22)]);
  const keyArea = clipPoly(P, [
    floor(-COURT.key.halfW, 0),
    floor(COURT.key.halfW, 0),
    floor(COURT.key.halfW, COURT.key.len),
    floor(-COURT.key.halfW, COURT.key.len),
  ]);
  const boardQuad = (x0: number, x1: number) => clipPoly(P, [v3(x0, 0, -0.7), v3(x1, 0, -0.7), v3(x1, 0.9, -0.7), v3(x0, 0.9, -0.7)]);
  // Il canestro: palo, braccio, tabellone.
  const B = COURT.board;
  const backboard = clipPoly(P, [v3(-B.w / 2, B.bottom, B.z), v3(B.w / 2, B.bottom, B.z), v3(B.w / 2, B.top, B.z), v3(-B.w / 2, B.top, B.z)]);
  const square = clipPoly(P, [v3(-0.3, 3.05, B.z - 0.01), v3(0.3, 3.05, B.z - 0.01), v3(0.3, 3.5, B.z - 0.01), v3(-0.3, 3.5, B.z - 0.01)]);
  const pole = clipSeg(P, v3(0, 0, -1.0), v3(0, 3.35, -1.0));
  const arm = clipSeg(P, v3(0, 3.35, -1.0), v3(0, 3.35, B.z));
  const padBase = clipPoly(P, [v3(-0.5, 0, -1.4), v3(0.5, 0, -1.4), v3(0.5, 1.0, -0.8), v3(-0.5, 1.0, -0.8)]);
  const rimShadow = P.p(floor(0, COURT.rim.z));
  const light = P.p(floor(0, 4.5));

  return (
    <svg className="pointer-events-none absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <defs>
        <linearGradient id="ar-bg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0d1124" />
          <stop offset="0.55" stopColor="#1a2246" />
          <stop offset="1" stopColor="#0d1124" />
        </linearGradient>
        <pattern id="ar-dots" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.1" fill="#000" opacity="0.17" />
        </pattern>
        <radialGradient id="ar-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ar-beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FFF8EA" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFF8EA" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="url(#ar-bg)" />
      {/* fasci di luce dei riflettori */}
      <path d={`M${w * 0.18} 0 L${w * 0.32} 0 L${w * 0.5} ${h * 0.75} L${w * 0.28} ${h * 0.75} Z`} fill="url(#ar-beam)" />
      <path d={`M${w * 0.7} 0 L${w * 0.84} 0 L${w * 0.74} ${h * 0.75} L${w * 0.54} ${h * 0.75} Z`} fill="url(#ar-beam)" />
      {standBack && <polygon points={standBack} fill="#262b4a" />}
      {standL && <polygon points={standL} fill="#20253f" />}
      {standR && <polygon points={standR} fill="#20253f" />}
      {/* il pubblico: tre gruppi che saltano a turno quando si esulta */}
      {[0, 1, 2].map((g) => (
        <g key={g} className={`crowd crowd-g${g}`}>
          {crowd
            .filter((f) => f.g === g)
            .map((f, i) => {
              const q = P.p(f.p);
              // Troppo vicino alla telecamera: sarebbe una macchia enorme sul bordo.
              if (q.depth < 4.5 || q.x < -20 || q.x > w + 20 || q.y < -20 || q.y > h + 20) return null;
              const r = q.s * 0.15;
              if (r < 0.9) return null;
              return (
                <g key={i}>
                  <ellipse cx={q.x} cy={q.y + r * 2.1} rx={r * 1.55} ry={r * 1.25} fill={f.shirt} />
                  <circle cx={q.x} cy={q.y} r={r} fill={f.skin} />
                  <path d={`M${q.x - r} ${q.y - r * 0.15} A${r} ${r} 0 0 1 ${q.x + r} ${q.y - r * 0.15}`} fill={f.hair} />
                </g>
              );
            })}
        </g>
      ))}
      {/* i cartelloni a bordo campo */}
      {BOARDS.map((t, i) => {
        const x0 = -9 + i * 3.6;
        const poly = boardQuad(x0, x0 + 3.5);
        if (!poly) return null;
        const c = P.p(v3(x0 + 1.75, 0.45, -0.7));
        return (
          <g key={t}>
            <polygon points={poly} fill={i % 2 ? "#F26A1B" : "#FFC531"} stroke={INK} strokeWidth="1.2" />
            {c.depth > NEAR && (
              <text
                x={c.x}
                y={c.y + c.s * 0.16}
                textAnchor="middle"
                fontFamily="var(--font-ultra), Georgia, serif"
                fontSize={Math.max(5, c.s * 0.42)}
                fill={INK}
                textLength={Math.max(10, c.s * 3.1)}
                lengthAdjust="spacingAndGlyphs"
              >
                {t}
              </text>
            )}
          </g>
        );
      })}
      {apron && <polygon points={apron} fill="#1f45b8" />}
      {court && <polygon points={court} fill="#2d5be3" />}
      {court && <polygon points={court} fill="url(#ar-dots)" />}
      {keyArea && <polygon points={keyArea} fill="#1f3fa6" />}
      {/* luce dall'alto sul parquet */}
      <ellipse cx={light.x} cy={light.y} rx={light.s * 9} ry={light.s * 3.5} fill="url(#ar-light)" />
      {lines.map((pts, i) => {
        const segs: string[] = [];
        let width = 1.2;
        for (let k = 0; k < pts.length - 1; k++) {
          const c = clipSeg(P, pts[k], pts[k + 1]);
          if (!c) continue;
          width = Math.max(width, lw(c[0]));
          segs.push(`M${c[0].x.toFixed(1)} ${c[0].y.toFixed(1)} L${c[1].x.toFixed(1)} ${c[1].y.toFixed(1)}`);
        }
        return <path key={i} d={segs.join(" ")} stroke="#FFF8EA" strokeOpacity="0.85" strokeWidth={Math.min(4, width)} fill="none" strokeLinecap="round" />;
      })}
      {/* ombra del canestro */}
      <ellipse cx={rimShadow.x} cy={rimShadow.y} rx={rimShadow.s * 0.6} ry={rimShadow.s * 0.18} fill="#000" opacity="0.25" />
      {padBase && <polygon points={padBase} fill="#F26A1B" stroke={INK} strokeWidth="1.5" />}
      {pole && (
        <line x1={pole[0].x} y1={pole[0].y} x2={pole[1].x} y2={pole[1].y} stroke={INK} strokeWidth={Math.max(3, pole[0].s * 0.16)} strokeLinecap="round" />
      )}
      {arm && <line x1={arm[0].x} y1={arm[0].y} x2={arm[1].x} y2={arm[1].y} stroke={INK} strokeWidth={Math.max(2.5, arm[0].s * 0.12)} />}
      {backboard && <polygon points={backboard} fill={CREAM} fillOpacity="0.92" stroke={INK} strokeWidth="2.2" strokeLinejoin="round" />}
      {square && <polygon points={square} fill="none" stroke="#E5412D" strokeWidth="2" />}
    </svg>
  );
});

/** Il ferro e la retina, disegnati sopra al pallone: così la palla passa "dentro". */
export function HoopFront({ cam, swish }: { cam: Camera; swish: boolean }) {
  const P = useMemo(() => projector(cam), [cam]);
  const { rim, rimR } = COURT;
  const R = rimR * 1.25;
  const ring = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    return P.p(v3(rim.x + R * Math.cos(a), rim.y, rim.z + R * Math.sin(a)));
  });
  const net = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const top = P.p(v3(rim.x + R * Math.cos(a), rim.y, rim.z + R * Math.sin(a)));
    const bot = P.p(v3(rim.x + R * 0.55 * Math.cos(a + 0.4), rim.y - 0.46, rim.z + R * 0.55 * Math.sin(a + 0.4)));
    return { top, bot };
  });
  const ringD = ring.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ") + "Z";
  const s = P.p(rim).s;
  return (
    <svg className="pointer-events-none absolute inset-0 z-[900]" width={cam.w} height={cam.h} aria-hidden>
      <g className={swish ? "net-swish" : undefined} style={{ transformOrigin: `${P.p(rim).x}px ${P.p(rim).y}px` }}>
        {net.map((n, i) => (
          <line key={i} x1={n.top.x} y1={n.top.y} x2={n.bot.x} y2={n.bot.y} stroke={CREAM} strokeOpacity="0.9" strokeWidth={Math.max(0.8, s * 0.025)} />
        ))}
        <path
          d={net.map((n, i) => `${i ? "L" : "M"}${n.bot.x.toFixed(1)} ${n.bot.y.toFixed(1)}`).join(" ") + "Z"}
          fill="none"
          stroke={CREAM}
          strokeOpacity="0.8"
          strokeWidth={Math.max(0.8, s * 0.025)}
        />
      </g>
      <path d={ringD} fill="none" stroke={INK} strokeWidth={Math.max(2.4, s * 0.09)} />
      <path d={ringD} fill="none" stroke="#F26A1B" strokeWidth={Math.max(1.4, s * 0.05)} />
    </svg>
  );
}

/** Altezza "di disegno" dei personaggi: poi si scalano con la distanza. */
const BASE = 150;

export interface Actor {
  key: string;
  id: AvatarPresetId;
  at: { x: number; z: number };
  back?: boolean;
  pose?: Pose;
  kit?: { jersey: string; trim: string };
  outfit?: GameState["outfit"];
  number?: number | null;
  backName?: string;
  jump?: boolean;
  /** Sollevato da terra, in metri (la schiacciata). */
  lift?: number;
  crouch?: boolean;
  move?: number;
  dim?: boolean;
  /** Un'etichetta sopra la testa (chi ha segnato). */
  tag?: string | null;
  glow?: boolean;
}

/** Un personaggio in campo: si muove e cambia grandezza da solo (transizioni CSS). */
export function Actor3D({ a, P }: { a: Actor; P: Projector }) {
  const q = P.p(floor(a.at.x, a.at.z));
  if (q.depth < NEAR + 0.3) return null;
  const k = (q.s * PLAYER_H) / BASE;
  const jump = a.lift ? -(a.lift / PLAYER_H) * BASE : a.jump ? -BASE * 0.24 : 0;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{
        transform: `translate3d(${q.x}px, ${q.y}px, 0) scale(${k})`,
        transformOrigin: "0 0",
        zIndex: Math.round(1000 - q.depth * 20),
        transition: `transform ${a.move ?? 800}ms cubic-bezier(.45,.05,.35,1)`,
        opacity: a.dim ? 0.6 : 1,
      }}
    >
      {/* l'ombra sul parquet */}
      <div
        className="absolute rounded-[50%] bg-black"
        style={{ width: 66, height: 18, left: -33, top: -9, opacity: a.jump ? 0.14 : 0.3, transition: "opacity 200ms" }}
      />
      <div
        style={{
          transform: `translate(-50%, -100%) translateY(${jump}px) scaleY(${a.crouch ? 0.93 : 1})`,
          transformOrigin: "50% 100%",
          transition: a.jump ? "transform 260ms cubic-bezier(.2,.9,.3,1)" : "transform 320ms cubic-bezier(.5,0,.7,.4)",
          filter: a.glow ? "drop-shadow(0 0 10px #FFC531)" : undefined,
        }}
      >
        <Character
          id={a.id}
          height={BASE}
          back={a.back}
          backName={a.backName}
          number={a.number}
          pose={a.pose}
          kit={a.kit}
          outfit={a.outfit}
          noBall
          idle={!a.jump && (a.pose ?? "dribble") === "dribble"}
        />
      </div>
      {a.tag && (
        <span
          className="game-pop absolute left-0 whitespace-nowrap rounded-full border-2 border-[#1d1a16] bg-[#FFC531] px-2 py-0.5 text-[15px] font-bold text-[#1d1a16]"
          style={{ top: -BASE - 34, transform: `translateX(-50%) scale(${1 / Math.max(0.6, k)})`, transformOrigin: "50% 100%" }}
        >
          {a.tag}
        </span>
      )}
    </div>
  );
}

/** Diametro del pallone in metri (un po' più grande del vero, come nei cartoni). */
const BALL_D = 0.34;

/** Il pallone in 3D: si appoggia a un punto e vola lungo una traiettoria, con l'ombra a terra. */
export function useBall3D(P: Projector | null) {
  const el = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const last = useRef<V3>(v3(0, 1, 6));
  const frame = useCallback(
    (p: V3) => {
      if (!P) return { ball: "", shade: "", z: 0 };
      const q = P.p(p);
      const g = P.p(floor(p.x, p.z));
      const k = (q.s * BALL_D) / 40;
      const ks = (g.s * BALL_D) / 40;
      return {
        ball: `translate3d(${q.x}px, ${q.y}px, 0) scale(${k})`,
        shade: `translate3d(${g.x}px, ${g.y}px, 0) scale(${ks * 1.3}, ${ks * 0.45})`,
        z: Math.round(1000 - q.depth * 20) + 5,
      };
    },
    [P],
  );
  const place = useCallback(
    (p: V3) => {
      last.current = p;
      const f = frame(p);
      if (el.current) {
        el.current.getAnimations?.().forEach((x) => x.cancel());
        el.current.style.transform = f.ball;
        el.current.style.zIndex = String(f.z);
        el.current.style.opacity = "1";
      }
      if (shadow.current) {
        shadow.current.getAnimations?.().forEach((x) => x.cancel());
        shadow.current.style.transform = f.shade;
        shadow.current.style.opacity = String(Math.max(0, 0.35 - p.y * 0.06));
      }
    },
    [frame],
  );
  /** Vola lungo i punti dati (in metri), in `ms`. */
  const fly = useCallback(
    (pts: V3[], ms: number) => {
      if (!el.current?.animate || !pts.length) return Promise.resolve();
      const fs = pts.map(frame);
      el.current.style.zIndex = String(Math.max(...fs.map((f) => f.z)));
      const a = el.current.animate(
        fs.map((f) => ({ transform: f.ball })),
        { duration: ms, easing: "linear", fill: "forwards" },
      );
      shadow.current?.animate(
        fs.map((f, i) => ({ transform: f.shade, opacity: Math.max(0, 0.35 - pts[i].y * 0.06) })),
        { duration: ms, easing: "linear", fill: "forwards" },
      );
      last.current = pts[pts.length - 1];
      return a.finished.then(
        () => {
          const f = frame(last.current);
          if (el.current) el.current.style.zIndex = String(f.z);
        },
        () => undefined,
      );
    },
    [frame],
  );
  return { el, shadow, place, fly, last };
}

export function BallNodes({
  ballRef,
  shadowRef,
}: {
  ballRef: React.RefObject<HTMLDivElement | null>;
  shadowRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div
        ref={shadowRef}
        className="pointer-events-none absolute left-0 top-0 z-[5] h-10 w-10 rounded-full bg-black"
        style={{ marginLeft: -20, marginTop: -20, transformOrigin: "50% 50%", opacity: 0 }}
      />
      <div
        ref={ballRef}
        className="pointer-events-none absolute left-0 top-0 h-10 w-10"
        style={{ marginLeft: -20, marginTop: -20, transformOrigin: "50% 50%", transform: "translate3d(-200px,-200px,0)" }}
      >
        <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden>
          <circle cx="20" cy="20" r="17.5" fill="#F26A1B" stroke={INK} strokeWidth="2.6" />
          <path d="M20 2.5 V37.5 M2.5 20 H37.5 M8 7.5 Q15 20 8 32.5 M32 7.5 Q25 20 32 32.5" fill="none" stroke={INK} strokeWidth="1.8" />
          <path d="M9.5 11 Q12 7.5 16.5 6.5" fill="none" stroke={CREAM} strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
        </svg>
      </div>
    </>
  );
}

/** Dove sono le mani di un giocatore a terra in (x, z): sopra la testa, al petto o al fianco. */
export function hands(at: { x: number; z: number }, where: "up" | "chest" | "side", back = true): V3 {
  if (where === "up") return v3(at.x, PLAYER_H * 1.02, at.z);
  if (where === "chest") return v3(at.x, PLAYER_H * 0.55, at.z - 0.15);
  return v3(at.x + (back ? -0.42 : 0.42), PLAYER_H * 0.3, at.z);
}

/** Il palcoscenico: misura lo spazio, crea la telecamera e disegna tutto il resto. */
export function Stage({
  stageRef,
  cam,
  home,
  away,
  seed,
  swish,
  hype,
  children,
}: {
  stageRef: React.RefObject<HTMLDivElement | null>;
  cam: Camera | null;
  home: string;
  away: string;
  seed: string;
  swish: boolean;
  /** Il pubblico che salta. */
  hype?: boolean;
  children?: ReactNode;
}) {
  return (
    <div ref={stageRef} className={`relative min-h-0 flex-1 overflow-hidden bg-[#0d1124] ${hype ? "arena-hype" : ""}`}>
      {cam && cam.w > 0 && (
        <>
          <Arena cam={cam} home={home} away={away} seed={seed} />
          {children}
          <HoopFront cam={cam} swish={swish} />
        </>
      )}
    </div>
  );
}

/**
 * Il gioco a tutto schermo: niente intestazione dell'app, solo la barra del gioco in
 * alto (punteggio, tempo, chi gioca) e sotto il palazzetto fino ai bordi.
 */
export function GameScreen({
  hud,
  onClose,
  children,
  testId,
}: {
  hud: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div className="fixed inset-0 z-[66] bg-[#0d1124] text-[#FFF8EA]" data-testid={testId}>
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <div className="flex shrink-0 items-center gap-3 bg-[#1d1a16] px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Esci"
              className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[#FFF8EA]/30 text-[#FFF8EA]"
            >
              <X size={20} />
            </button>
          )}
          <div className="min-w-0 flex-1">{hud}</div>
        </div>
        <div className="relative min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export { CREAM, INK };
