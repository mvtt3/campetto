"use client";

import { haptic } from "@/components/ui/basics";
import { play } from "@/lib/sound";

/**
 * Lo scossone sul personaggio del profilo: perde l'equilibrio e si inclina sul piede
 * da quella parte, la testa arriva in ritardo, gli cade il pallone, gli girano gli
 * occhi con le stelline; poi si ricompone e riprende il pallone.
 * Muove solo l'attributo transform dei gruppi del disegno (character-sway, -head,
 * -pupil, -ball-drop): niente stili da ricalcolare, che sui telefoni economici pesano.
 * Gira solo finché c'è qualcosa da muovere.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Spring {
  x: number;
  v: number;
  k: number;
  c: number;
}
/** Un passo di molla verso zero; restituisce l'accelerazione. */
function step(s: Spring, dt: number) {
  const a = -s.k * s.x - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
  return a;
}

function star(): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  const p = document.createElementNS(SVG_NS, "path");
  const pts = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 2.1 : 4.6;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${i ? "L" : "M"}${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
  });
  p.setAttribute("d", `${pts.join(" ")} Z`);
  p.setAttribute("fill", "#FFC531");
  p.setAttribute("stroke", "#1D1A16");
  p.setAttribute("stroke-width", "1.4");
  p.setAttribute("stroke-linejoin", "round");
  g.appendChild(p);
  return g;
}

export interface Wobble {
  shake: (power?: number) => void;
  destroy: () => void;
}

export function createWobble(svg: SVGSVGElement): Wobble | null {
  const sway = svg.querySelector<SVGGElement>(".character-sway");
  if (!sway) return null;
  const head = svg.querySelector<SVGGElement>(".character-head");
  const drop = svg.querySelector<SVGGElement>(".character-ball-drop");
  const ballEl = svg.querySelector<SVGGElement>(".character-ball");
  const shadow = svg.querySelector<SVGEllipseElement>(".character-shadow");
  const pupils = [...svg.querySelectorAll<SVGGElement>(".character-pupil")];
  const shadowCy = Number(shadow?.getAttribute("cy") ?? 179);
  const footY = shadowCy - 3;

  let ball: { x: number; y: number; r: number } | null = null;
  try {
    if (drop && ballEl && ballEl.getAttribute("display") !== "none") {
      const b = ballEl.getBBox();
      if (b.width > 0)
        ball = { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.height / 2 };
    }
  } catch {
    ball = null;
  }
  const ground = ball ? shadowCy - ball.r - 1 : 0;

  const th: Spring = { x: 0, v: 0, k: 55, c: 4.2 };
  const hd: Spring = { x: 0, v: 0, k: 150, c: 9 };
  let kicks: { at: number; v: number }[] = [];
  let dizzyUntil = 0;
  let raf = 0;
  let prev = 0;
  let stars: { g: SVGGElement; parts: SVGGElement[]; cx: number; top: number; rx: number } | null = null;
  // Il pallone: in mano, libero (cade e rimbalza) o mentre torna in mano.
  let mode: "held" | "free" | "back" = "held";
  const bp = { x: 0, y: 0 };
  const bv = { x: 0, y: 0 };
  let brot = 0;
  let restSince = 0;
  let back = { x: 0, y: 0, r: 0, t0: 0 };
  let bounced = false;

  const pivotX = (deg: number) => 50 + clamp(deg / 8, -1, 1) * 13.5;
  /** Dove sta la mano col pallone quando il corpo pende di `deg` gradi. */
  const held = (deg: number) => {
    if (!ball) return { x: 0, y: 0 };
    const px = pivotX(deg);
    const a = (deg * Math.PI) / 180;
    const dx = ball.x - px;
    const dy = ball.y - footY;
    return {
      x: px + dx * Math.cos(a) - dy * Math.sin(a) - ball.x,
      y: footY + dx * Math.sin(a) + dy * Math.cos(a) - ball.y,
    };
  };

  const ensureStars = () => {
    if (stars) return stars;
    const host = head ?? sway;
    let box = { x: 25, y: 10, width: 50 };
    try {
      box = host.getBBox();
    } catch {
      /* ignora */
    }
    const g = document.createElementNS(SVG_NS, "g");
    g.setAttribute("class", "character-dizzy");
    g.setAttribute("opacity", "0");
    const parts = [star(), star(), star()];
    parts.forEach((p) => g.appendChild(p));
    host.appendChild(g);
    stars = {
      g,
      parts,
      cx: box.x + box.width / 2,
      top: box.y + 4,
      rx: Math.min(26, box.width * 0.45),
    };
    return stars;
  };

  const releaseBall = () => {
    if (!ball || mode !== "held") return;
    mode = "free";
    const h = held(th.x);
    bp.x = h.x;
    bp.y = h.y;
    bv.x = 12 + clamp(th.v * 0.04, -20, 20);
    bv.y = -70;
    brot = th.x;
    restSince = 0;
    bounced = false;
  };

  // Scrive l'attributo solo se cambia: meno lavoro per il telefono.
  const last = new WeakMap<Element, string>();
  const put = (el: Element | null, v: string | null) => {
    if (!el || last.get(el) === (v ?? "")) return;
    last.set(el, v ?? "");
    if (v) el.setAttribute("transform", v);
    else el.removeAttribute("transform");
  };
  const headPivot = (() => {
    const o = head?.style.transformOrigin.match(/([-\d.]+)px ([-\d.]+)px/);
    return o ? `${o[1]} ${o[2]}` : "50 76";
  })();

  const clear = () => {
    put(sway, null);
    put(head, null);
    put(shadow, null);
    put(drop, null);
    pupils.forEach((p) => put(p, null));
    if (stars) stars.g.setAttribute("opacity", "0");
  };

  const frame = (now: number) => {
    const dt = Math.min(0.033, (now - prev) / 1000 || 0.016);
    prev = now;
    while (kicks.length && kicks[0].at <= now) th.v += kicks.shift()!.v;
    const acc = step(th, dt);
    if (Math.abs(th.x) > 32) {
      th.x = Math.sign(th.x) * 32;
      th.v *= -0.3;
    }
    hd.v += -acc * 0.22 * dt;
    step(hd, dt);
    const dz = now < dizzyUntil;
    const t = now / 1000;

    const ox = pivotX(th.x);
    put(sway, `rotate(${th.x.toFixed(2)} ${ox.toFixed(2)} ${footY})`);
    put(head, `rotate(${clamp(hd.x, -22, 22).toFixed(1)} ${headPivot})`);
    // L'ombra resta a terra: si sposta e si allarga, partendo dal suo centro.
    const sx = 1 + Math.abs(th.x) / 60;
    put(
      shadow,
      `translate(${(th.x * 0.5 + 50 * (1 - sx)).toFixed(2)} 0) scale(${sx.toFixed(3)} 1)`,
    );
    // Gli occhi guardano dove pende, e girano in tondo quando gli gira la testa.
    const px = dz ? Math.cos(t * 9) * 1.6 : clamp(th.x * 0.05, -1.4, 1.4);
    const py = dz ? Math.sin(t * 9) * 1.6 : 0;
    pupils.forEach((p) => put(p, `translate(${px.toFixed(1)} ${py.toFixed(1)})`));
    if (stars && (dz || stars.g.getAttribute("opacity") !== "0")) {
      const o = dz ? Math.min(1, (dizzyUntil - now) / 300) : 0;
      stars.g.setAttribute("opacity", o.toFixed(2));
      stars.parts.forEach((s, i) => {
        const a = t * 4.2 + i * 2.094;
        const x = stars!.cx + Math.cos(a) * stars!.rx;
        const y = stars!.top + Math.sin(a) * 6;
        const sc = 0.75 + (Math.sin(a) + 1) * 0.25;
        s.setAttribute(
          "transform",
          `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${sc.toFixed(2)}) rotate(${((a * 40) % 360).toFixed(0)})`,
        );
      });
    }

    if (ball && drop) {
      // Il gruppo del pallone sta dentro al corpo: per farlo cadere dritto si toglie la rotazione del corpo.
      const unrotate = `rotate(${(-th.x).toFixed(2)} ${ox.toFixed(2)} ${footY})`;
      const at = (x: number, y: number, r: number) =>
        `${unrotate} translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${r.toFixed(1)} ${ball!.x} ${ball!.y})`;
      if (mode === "held") {
        put(drop, null);
      } else if (mode === "free") {
        bv.y += 620 * dt;
        bp.x += bv.x * dt;
        bp.y += bv.y * dt;
        brot += bv.x * dt * 6;
        if (ball.y + bp.y > ground) {
          bp.y = ground - ball.y;
          if (Math.abs(bv.y) > 40) {
            bv.y *= -0.48;
            haptic(8);
            if (!bounced) play("bounce");
            bounced = true;
          } else bv.y = 0;
          bv.x *= 0.82;
        }
        // A destra c'è poco spazio prima del bordo della testata.
        if (ball.x + bp.x > 92) {
          bp.x = 92 - ball.x;
          bv.x *= -0.5;
        }
        if (ball.x + bp.x < -4) {
          bp.x = -4 - ball.x;
          bv.x *= -0.5;
        }
        bv.x *= Math.pow(0.6, dt);
        const calm =
          Math.abs(th.x) < 2 && Math.abs(th.v) < 15 && bv.y === 0 && !dz;
        restSince = calm ? restSince || now : 0;
        if (restSince && now - restSince > 450) {
          mode = "back";
          back = { x: bp.x, y: bp.y, r: brot, t0: now };
        }
        put(drop, at(bp.x, bp.y, brot));
      } else {
        const k = Math.min(1, (now - back.t0) / 380);
        const e = 1 - Math.pow(1 - k, 3);
        const h = held(th.x);
        const x = back.x + (h.x - back.x) * e;
        const y = back.y + (h.y - back.y) * e - Math.sin(k * Math.PI) * 26;
        put(drop, at(x, y, back.r * (1 - e) + th.x * e));
        if (k >= 1) {
          mode = "held";
          haptic(10);
        }
      }
    }

    const settled =
      !kicks.length &&
      Math.abs(th.x) < 0.05 &&
      Math.abs(th.v) < 0.5 &&
      Math.abs(hd.x) < 0.05 &&
      Math.abs(hd.v) < 0.5 &&
      !dz &&
      mode === "held";
    if (settled) {
      raf = 0;
      th.x = th.v = hd.x = hd.v = 0;
      clear();
      svg.removeAttribute("data-wobbling");
      return;
    }
    raf = requestAnimationFrame(frame);
  };

  return {
    shake(power = 1) {
      const t0 = performance.now();
      const seq = [340, -550, 490, -340];
      kicks = seq.map((v, i) => ({ at: t0 + i * 105, v: v * power }));
      haptic([18, 60, 18, 60, 24]);
      play("squeak");
      if (power > 0.6) {
        window.setTimeout(releaseBall, 160);
        ensureStars();
        dizzyUntil = Math.max(dizzyUntil, t0 + 1700);
      }
      svg.setAttribute("data-wobbling", "");
      if (!raf) {
        prev = t0;
        raf = requestAnimationFrame(frame);
      }
    },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clear();
      stars?.g.remove();
      stars = null;
    },
  };
}
