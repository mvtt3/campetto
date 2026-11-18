"use client";

import { useEffect, type RefObject } from "react";
import { createShakeDetector, createTiltTracker } from "@/lib/motion";
import { createWobble, type Wobble } from "./wobble";

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * La testata del profilo con i sensori del telefono:
 * - inclinandolo, la carta olografica si muove (riflesso, luce e personaggio in rilievo);
 * - scuotendolo, il personaggio barcolla.
 * Tutto acceso solo mentre la testata si vede (le schede restano montate quando
 * cambi scheda) e mai con "riduci animazioni" del telefono.
 */
export function useHeroMotion(
  ref: RefObject<HTMLElement | null>,
  /** Cambia quando cambia la testata (un altro giocatore): si riaggancia. */
  key?: string,
) {
  useEffect(() => {
    const hero = ref.current;
    if (!hero || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tilt = createTiltTracker();
    const shakes = createShakeDetector();
    const cur = { x: 0, y: 0, vx: 0, vy: 0 };
    const target = { x: 0, y: 0 };
    let raf = 0;
    let prev = 0;
    let visible = false;
    let listening = false;
    let wobble: Wobble | null = null;
    let wobbleSvg: SVGSVGElement | null = null;

    const foil = hero.querySelector<HTMLElement>(".holo-foil > span");
    const glare = hero.querySelector<HTMLElement>(".holo-glare > span");
    const lift = hero.querySelector<HTMLElement>(".hero-parallax");
    // Solo transform e opacità su tre elementi: niente variabili CSS, che farebbero
    // ricalcolare tutta la testata (personaggio compreso) a ogni fotogramma.
    const paint = () => {
      const { x, y } = cur;
      const m = Math.min(1, Math.hypot(x, y));
      if (foil) {
        foil.style.transform = `translate3d(${(-x * 16).toFixed(2)}%,${(-y * 16).toFixed(2)}%,0)`;
        foil.style.opacity = (0.08 + m * 0.3).toFixed(3);
      }
      if (glare) {
        glare.style.transform = `translate3d(${(x * 24).toFixed(2)}%,${(-10 + y * 26).toFixed(2)}%,0)`;
        glare.style.opacity = (m * 0.85).toFixed(3);
      }
      if (lift)
        lift.style.transform = `perspective(600px) translate3d(${(-x * 7).toFixed(2)}px,${(-y * 5).toFixed(2)}px,0) rotateY(${(x * 12).toFixed(2)}deg) rotateX(${(-y * 7).toFixed(2)}deg)`;
    };
    // Una molla morbida verso l'inclinazione letta: niente scatti anche se il sensore è rumoroso.
    const frame = (now: number) => {
      const dt = Math.min(0.033, (now - prev) / 1000 || 0.016);
      prev = now;
      for (const [p, v] of [
        ["x", "vx"],
        ["y", "vy"],
      ] as const) {
        const a = -150 * (cur[p] - target[p]) - 20 * cur[v];
        cur[v] += a * dt;
        cur[p] += cur[v] * dt;
      }
      paint();
      const still =
        Math.abs(cur.x - target.x) < 0.002 &&
        Math.abs(cur.y - target.y) < 0.002 &&
        Math.abs(cur.vx) < 0.01 &&
        Math.abs(cur.vy) < 0.01;
      raf = still ? 0 : requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf) return;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      // Solo in verticale: in orizzontale gli assi si scambiano e la carta impazzirebbe.
      const angle = window.screen?.orientation?.angle ?? 0;
      if (angle !== 0) return;
      const t = tilt.feed(e.beta, e.gamma, e.timeStamp || performance.now());
      target.x = t.x;
      target.y = t.y;
      wake();
    };
    const onMotion = (e: DeviceMotionEvent) => {
      const lin = e.acceleration;
      const raw = lin && lin.x != null ? lin : e.accelerationIncludingGravity;
      if (!raw || raw.x == null || raw.y == null || raw.z == null) return;
      const power = shakes.feed(
        { x: raw.x, y: raw.y, z: raw.z },
        e.timeStamp || performance.now(),
        raw === lin,
      );
      if (power === null) return;
      const svg = hero.querySelector<SVGSVGElement>(".hero-wobble svg.character");
      if (!svg) return;
      // Il disegno cambia se cambi personaggio: si riaggancia a quello nuovo.
      if (svg !== wobbleSvg) {
        wobble?.destroy();
        wobble = createWobble(svg);
        wobbleSvg = svg;
      }
      wobble?.shake(power);
    };

    const listen = (on: boolean) => {
      if (on === listening) return;
      listening = on;
      if (on) {
        window.addEventListener("deviceorientation", onOrientation);
        window.addEventListener("devicemotion", onMotion);
      } else {
        window.removeEventListener("deviceorientation", onOrientation);
        window.removeEventListener("devicemotion", onMotion);
        tilt.reset();
        target.x = target.y = 0;
        wake();
      }
    };
    const update = () =>
      listen(visible && document.visibilityState === "visible");

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    io.observe(hero);
    document.addEventListener("visibilitychange", update);

    // iPhone: i sensori vanno chiesti dopo un tocco. Su Android non serve niente.
    const O = (window as unknown as { DeviceOrientationEvent?: PermissionApi })
      .DeviceOrientationEvent;
    const M = (window as unknown as { DeviceMotionEvent?: PermissionApi })
      .DeviceMotionEvent;
    let asked = false;
    const ask = () => {
      if (asked) return;
      asked = true;
      void O?.requestPermission?.().catch(() => undefined);
      void M?.requestPermission?.().catch(() => undefined);
    };
    const needsAsk =
      typeof O?.requestPermission === "function" ||
      typeof M?.requestPermission === "function";
    if (needsAsk) hero.addEventListener("click", ask, { capture: true });

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      listen(false);
      if (raf) cancelAnimationFrame(raf);
      wobble?.destroy();
      if (needsAsk) hero.removeEventListener("click", ask, { capture: true });
    };
  }, [ref, key]);
}
