"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { haptic } from "./basics";

/**
 * La "i" informativa: un tocco apre un fumetto breve accanto al punto, un altro
 * tocco (o un tocco fuori) lo chiude. Solo dove serve davvero una spiegazione.
 */
export function InfoTip({
  label,
  children,
  className,
  size = 18,
}: {
  /** Di cosa parla, per chi usa il lettore di schermo: "Info su ELO". */
  label: string;
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    arrow: number;
    below: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const w = Math.min(272, window.innerWidth - 24);
      const h = tip.current?.offsetHeight ?? 90;
      const cx = r.left + r.width / 2;
      const left = Math.min(
        Math.max(12, cx - w / 2),
        window.innerWidth - w - 12,
      );
      const below =
        r.bottom + 10 + h < window.innerHeight - 12 || r.top - h - 10 < 12;
      setPos({
        left,
        top: below ? r.bottom + 10 : r.top - h - 10,
        arrow: cx - left,
        below,
      });
    };
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      const t = e.target as Node;
      if (tip.current?.contains(t) || btn.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const away = () => setOpen(false);
    document.addEventListener("pointerdown", close, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", away);
    document.addEventListener("scroll", away, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", away);
      document.removeEventListener("scroll", away, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          // Anche dentro una scheda cliccabile: apre solo il fumetto.
          e.preventDefault();
          e.stopPropagation();
          haptic(4);
          setOpen((o) => !o);
        }}
        className={clsx(
          "relative inline-grid shrink-0 place-items-center rounded-full border-2 border-current align-middle font-serif font-bold italic leading-none opacity-70 transition-opacity before:absolute before:-inset-3 before:content-[''] hover:opacity-100",
          open && "!opacity-100",
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.62 }}
      >
        i
      </button>
      {open &&
        createPortal(
          <div
            ref={tip}
            id={id}
            role="tooltip"
            className="menu-pop fixed z-[65] rounded-[18px] border-[2.5px] border-edge bg-surface px-8 py-3 text-center text-[13.5px] font-medium leading-snug text-text"
            style={{
              left: pos?.left ?? -999,
              top: pos?.top ?? -999,
              width: Math.min(
                272,
                typeof window !== "undefined" ? window.innerWidth - 24 : 272,
              ),
              boxShadow: "3px 3px 0 var(--edge)",
              transformOrigin: pos
                ? `${pos.arrow}px ${pos.below ? "0" : "100%"}`
                : undefined,
            }}
          >
            <span
              aria-hidden
              className={clsx(
                "absolute h-3 w-3 rotate-45 border-edge bg-surface",
                pos?.below
                  ? "-top-[7.5px] border-l-[2.5px] border-t-[2.5px]"
                  : "-bottom-[7.5px] border-b-[2.5px] border-r-[2.5px]",
              )}
              style={{ left: (pos?.arrow ?? 20) - 6 }}
            />
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => setOpen(false)}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full text-muted"
            >
              <X size={15} />
            </button>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
