"use client";

import clsx from "clsx";
import { Check, Lock, RotateCw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AVATAR_PRESETS, CHARACTER_TAGLINE, RARITY, type AvatarPresetId, type Rarity } from "@/components/avatar-presets";
import { Character, characterProgress } from "@/components/character";
import { Button, haptic } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";

/**
 * Il personaggio che si gira col dito: trascinando ruota su sé stesso (davanti
 * la faccia, dietro nome e numero sulla canotta); lasciato, torna di fronte e
 * dondola piano.
 */
export function Character3D({ id, number, name, height = 210 }: { id: AvatarPresetId; number?: number | null; name?: string; height?: number }) {
  const inner = useRef<HTMLDivElement>(null);
  const angle = useRef(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; a: number; t: number; v: number } | null>(null);

  const set = (a: number, animate: boolean) => {
    angle.current = a;
    const el = inner.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
    el.style.transform = `rotateY(${a}deg)`;
  };

  return (
    <div
      className="char3d mx-auto flex cursor-grab select-none justify-center active:cursor-grabbing"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, a: angle.current, t: performance.now(), v: 0 };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const a = s.a + (e.clientX - s.x) * 0.9;
        const now = performance.now();
        s.v = (a - angle.current) / Math.max(1, now - s.t);
        s.t = now;
        set(a, false);
      }}
      onPointerUp={() => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        // Un piccolo lancio continua il giro, poi si ferma di fronte o di spalle.
        const projected = angle.current + s.v * 220;
        const snap = Math.round(projected / 180) * 180;
        haptic(5);
        set(snap, true);
        window.setTimeout(() => {
          if (start.current) return;
          // Riporta l'angolo tra 0 e 360 senza farlo vedere.
          set(((snap % 360) + 360) % 360, false);
          setDragging(false);
        }, 720);
      }}
      onPointerCancel={() => {
        start.current = null;
        set(0, true);
        setDragging(false);
      }}
      aria-label="Trascina per girare il personaggio"
      role="img"
    >
      <div className={clsx(!dragging && "char3d-sway")}>
        <div ref={inner} className="char3d-inner">
          <div className="char3d-face">
            <Character id={id} number={number} height={height} idle />
          </div>
          <div className="char3d-face char3d-back">
            <Character id={id} number={number} height={height} back backName={name} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** La scheda di un personaggio: si apre al tocco, sopra a tutto, centrata. */
export function CharacterCard({ id, onClose, onUse }: { id: AvatarPresetId | null; onClose: () => void; onUse?: (id: AvatarPresetId) => void }) {
  const { me, engine } = useData();
  const [shown, setShown] = useState<AvatarPresetId | null>(id);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(id);
      setLeaving(false);
    } else if (shown) {
      setLeaving(true);
      const t = window.setTimeout(() => setShown(null), 300);
      return () => window.clearTimeout(t);
    }
  }, [id, shown]);

  useEffect(() => {
    if (!id) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [id, onClose]);

  if (!shown || !me) return null;
  const p = AVATAR_PRESETS.find((x) => x.id === shown)!;
  const rarity = p.rarity as Rarity;
  const prog = characterProgress(shown, engine.badges(me.id).states);
  const current = me.character === shown;
  const pct = prog.need ? Math.round((prog.have / prog.need) * 100) : 100;

  return createPortal(
    <div
      data-over-sheet
      className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="char-title"
    >
      <div className={clsx("absolute inset-0 bg-[#1d1a16]/55", leaving ? "fade-out" : "fade-in")} onClick={onClose} />
      <div
        className={clsx(
          "relative w-full max-w-[340px] select-none overflow-hidden rounded-[30px] border-[2.5px] border-edge bg-surface text-center",
          leaving ? "char-card-out" : "char-card-in",
        )}
        style={{ boxShadow: "6px 6px 0 var(--edge)" }}
      >
        <div className="halftone relative px-4 pb-2 pt-4" style={{ background: p.bg }}>
          <button onClick={onClose} aria-label="Chiudi" className="press absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface text-text">
            <X size={18} />
          </button>
          <span
            className="absolute left-3 top-3 z-10 rounded-full border-2 border-[#1d1a16] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1d1a16]"
            style={{ background: RARITY[rarity].ring === "#1D1A16" ? "#fffaf0" : RARITY[rarity].ring }}
          >
            {RARITY[rarity].one}
          </span>
          <div className={clsx(!prog.unlocked && "opacity-40 grayscale")}>
            <Character3D id={shown} number={me.jerseyNumber} name={me.nickname ?? me.firstName} height={196} />
          </div>
          {!prog.unlocked && (
            <span className="pointer-events-none absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-edge bg-surface text-text">
              <Lock size={24} />
            </span>
          )}
          <p className="mt-1 flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#fffaf0]/85">
            <RotateCw size={12} aria-hidden /> Trascina per girarlo
          </p>
        </div>
        <div className="px-5 pb-5 pt-4">
          <h2 id="char-title" className="display text-[28px] leading-[1.1]">
            {p.name}
          </h2>
          <p className="mt-1 text-[14px] text-muted">{CHARACTER_TAGLINE[shown]}</p>

          {rarity !== "base" && (
            <div className="mt-4 rounded-[18px] bg-raised px-4 py-3">
              <p className="text-[12px] font-semibold text-muted">{prog.unlocked ? "Sbloccato con" : "Si sblocca con"}</p>
              <p className="title text-[15.5px]">{prog.goal}</p>
              <p className="text-[12.5px] text-muted">{prog.detail}</p>
              {!prog.unlocked && (
                <>
                  <div className="mt-2.5 h-2.5 overflow-hidden rounded-full border-2 border-edge bg-surface">
                    <div className="h-full rounded-full bg-ball transition-[width] duration-700" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="tnum mt-1 text-[12.5px] font-bold">
                    {prog.have} di {prog.need} {prog.unit}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-4">
            {prog.unlocked ? (
              current ? (
                <p className="flex h-12 items-center justify-center gap-2 text-[15px] font-bold text-ok">
                  <Check size={18} strokeWidth={3} /> È il tuo personaggio
                </p>
              ) : (
                <Button variant="court" block onClick={() => onUse?.(shown)}>
                  Usa {p.name}
                </Button>
              )
            ) : (
              <Button variant="secondary" block onClick={onClose}>
                Ci provo!
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Tutti i personaggi, divisi per rarità: un tocco apre la scheda. */
export function CharacterGrid({ onOpen }: { onOpen: (id: AvatarPresetId) => void }) {
  const { me, engine } = useData();
  if (!me) return null;
  const states = engine.badges(me.id).states;
  const groups: Rarity[] = ["base", "rara", "epica", "leggendaria"];
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const items = AVATAR_PRESETS.filter((p) => p.rarity === g);
        const open = items.filter((p) => characterProgress(p.id, states).unlocked).length;
        return (
          <section key={g}>
            <h3 className="mb-2.5 flex items-center justify-center gap-2 text-[13.5px] font-bold">
              <span className="h-3 w-3 rounded-full border-2 border-edge" style={{ background: RARITY[g].ring }} aria-hidden />
              {RARITY[g].label}
              <span className="font-semibold text-muted">
                {open}/{items.length}
              </span>
            </h3>
            <div className="grid grid-cols-3 gap-2.5">
              {items.map((p) => {
                const prog = characterProgress(p.id, states);
                const on = me.character === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      haptic(5);
                      onOpen(p.id);
                    }}
                    aria-label={`${p.name}${prog.unlocked ? "" : ", bloccato"}${on ? ", il tuo" : ""}`}
                    className={clsx(
                      "press relative flex flex-col items-center rounded-[20px] border-2 border-edge px-1 pb-2 pt-2",
                      on ? "sticker bg-volt" : "bg-surface",
                    )}
                  >
                    <span className={clsx("block", !prog.unlocked && "opacity-35 grayscale")}>
                      <Character id={p.id} number={me.jerseyNumber} height={84} />
                    </span>
                    {!prog.unlocked && (
                      <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-edge bg-surface">
                        <Lock size={12} />
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-edge bg-ok text-white">
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                    <span className="mt-1 w-full truncate text-[12.5px] font-bold">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
