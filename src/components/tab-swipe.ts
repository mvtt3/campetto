"use client";

import { useEffect, useLayoutEffect, type RefObject } from "react";
import { haptic } from "@/components/ui/basics";

/** Evento per far scorrere da sola la scheda verso quella dopo (la guida mostra il gesto). */
export const SWIPE_DEMO = "campetto:swipe-demo";

const IGNORE =
  ".scroll-x, [data-no-swipe], input, textarea, select, [role='slider']";
const STYLE_PROPS = [
  "display",
  "flexDirection",
  "position",
  "inset",
  "transform",
  "transition",
  "zIndex",
  "willChange",
  "contentVisibility",
  "pointerEvents",
] as const;

function clear(el: HTMLElement) {
  for (const p of STYLE_PROPS) el.style[p] = "";
}

/**
 * Scorrere a destra o a sinistra cambia scheda: la schermata segue il dito e
 * quella accanto entra dal bordo, come nelle app native. Gli stili si
 * aggiornano direttamente (niente ridisegni di React durante il gesto).
 */
export function useTabSwipe({
  pager,
  paths,
  active,
  onCommit,
  onPrepare,
  onRelease,
}: {
  pager: RefObject<HTMLDivElement | null>;
  paths: string[];
  active: string | null;
  onCommit: (path: string) => void;
  /** Chiamato a inizio gesto, per avere già pronte le schede vicine. */
  onPrepare: (paths: string[]) => void;
  /** Appena il dito si alza e la scheda cambierà: la barra si aggiorna subito. */
  onRelease?: (path: string) => void;
}) {
  // Quando la scheda attiva cambia, togli gli stili provvisori prima del disegno.
  useLayoutEffect(() => {
    const root = pager.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>(":scope > [data-tab]").forEach(clear);
  }, [active, pager]);

  useEffect(() => {
    const root = pager.current;
    if (!root || !active) return;
    const idx = paths.indexOf(active);
    if (idx < 0) return;
    const el = (p: string) =>
      root.querySelector<HTMLElement>(`:scope > [data-tab="${p}"]`);

    let sx = 0;
    let sy = 0;
    let st = 0;
    let tracking = false;
    let horizontal = false;
    let dx = 0;
    let neighbor: HTMLElement | null = null;
    let dir = 0;
    let busy = false;
    const cur = el(active);

    const place = (x: number, animate: boolean | string) => {
      const w = root.clientWidth;
      const t = animate
        ? `transform ${animate === true ? "280ms cubic-bezier(0.22, 0.8, 0.3, 1)" : animate}`
        : "none";
      if (cur) {
        cur.style.transition = t;
        cur.style.transform = `translate3d(${x}px, 0, 0)`;
        cur.style.willChange = "transform";
      }
      if (neighbor) {
        // Stessa impaginazione della scheda attiva (colonna), altrimenti entrerebbe storta.
        neighbor.style.contentVisibility = "visible";
        neighbor.style.display = "flex";
        neighbor.style.flexDirection = "column";
        neighbor.style.position = "absolute";
        neighbor.style.inset = "0";
        neighbor.style.zIndex = "1";
        neighbor.style.transition = t;
        neighbor.style.willChange = "transform";
        neighbor.style.transform = `translate3d(${x + dir * w}px, 0, 0)`;
      }
    };

    const start = (e: TouchEvent) => {
      if (busy || e.touches.length > 1) return;
      const target = e.target as Element;
      if (target.closest(IGNORE)) return;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      st = performance.now();
      tracking = true;
      horizontal = false;
      dx = 0;
      neighbor = null;
      dir = 0;
      onPrepare([paths[idx - 1], paths[idx + 1]].filter(Boolean));
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const x = e.touches[0].clientX - sx;
      const y = e.touches[0].clientY - sy;
      if (!horizontal) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        if (Math.abs(x) < Math.abs(y) * 1.3) {
          tracking = false;
          return;
        }
        horizontal = true;
      }
      if (e.cancelable) e.preventDefault();
      const d = x < 0 ? 1 : -1;
      if (d !== dir) {
        if (neighbor) clear(neighbor);
        dir = d;
        const p = paths[idx + d];
        neighbor = p ? el(p) : null;
      }
      // Alla prima e all'ultima scheda il bordo fa resistenza.
      dx = paths[idx + d] ? x : x / 4;
      place(dx, false);
      // La pillola della barra segue il dito.
      const pill = document.querySelector<HTMLElement>("[data-nav-pill]");
      if (pill) {
        pill.setAttribute("data-dragging", "");
        pill.style.setProperty(
          "--drag",
          String(
            paths[idx + d]
              ? Math.max(-1, Math.min(1, -dx / root.clientWidth))
              : 0,
          ),
        );
      }
    };
    const end = () => {
      if (!tracking || !horizontal) {
        tracking = false;
        return;
      }
      tracking = false;
      const w = root.clientWidth;
      const v = Math.abs(dx) / Math.max(1, performance.now() - st);
      const target = paths[idx + dir];
      const go =
        !!target &&
        (Math.abs(dx) > w * 0.28 || (v > 0.45 && Math.abs(dx) > 36));
      busy = true;
      const pill = document.querySelector<HTMLElement>("[data-nav-pill]");
      if (pill) {
        pill.removeAttribute("data-dragging");
        pill.style.removeProperty("--drag");
      }
      if (go) onRelease?.(target!);
      place(go ? -dir * w : 0, true);
      const done = () => {
        busy = false;
        if (go) {
          haptic(8);
          onCommit(target!);
        } else {
          if (cur) clear(cur);
          if (neighbor) clear(neighbor);
        }
      };
      if (cur) {
        let fired = false;
        const fin = () => {
          if (fired) return;
          fired = true;
          done();
        };
        cur.addEventListener("transitionend", fin, { once: true });
        window.setTimeout(fin, 340);
      } else done();
    };

    // La guida mostra il gesto: la scheda scorre da sola verso quella dopo, come col dito.
    const demo = () => {
      const target = paths[idx + 1];
      if (busy || tracking || !target) return;
      busy = true;
      dir = 1;
      neighbor = el(target);
      place(0, false);
      const pill = document.querySelector<HTMLElement>("[data-nav-pill]");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          onRelease?.(target);
          place(-root.clientWidth, "640ms cubic-bezier(0.65, 0, 0.35, 1)");
          pill?.removeAttribute("data-dragging");
          let fired = false;
          const fin = () => {
            if (fired) return;
            fired = true;
            busy = false;
            onCommit(target);
          };
          cur?.addEventListener("transitionend", fin, { once: true });
          window.setTimeout(fin, 720);
        }),
      );
    };
    window.addEventListener(SWIPE_DEMO, demo);

    root.addEventListener("touchstart", start, { passive: true });
    root.addEventListener("touchmove", move, { passive: false });
    root.addEventListener("touchend", end);
    root.addEventListener("touchcancel", end);
    return () => {
      window.removeEventListener(SWIPE_DEMO, demo);
      root.removeEventListener("touchstart", start);
      root.removeEventListener("touchmove", move);
      root.removeEventListener("touchend", end);
      root.removeEventListener("touchcancel", end);
    };
  }, [pager, paths, active, onCommit, onPrepare, onRelease]);
}
