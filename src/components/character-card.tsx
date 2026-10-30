"use client";

import clsx from "clsx";
import { Check, Lock, RotateCw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AVATAR_PRESETS, CHARACTER_TAGLINE, RARITIES, RARITY, type AvatarPresetId, type Rarity } from "@/components/avatar-presets";
import { Character, characterProgress, nextCharacter, type GoalStep } from "@/components/character";
import { Button, haptic } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { play } from "@/lib/sound";

/** Quanto è spesso il personaggio, in proporzione alla larghezza. */
const DEPTH = 0.16;
const SLICES = 9;

/**
 * Il personaggio che si gira col dito, come un pupazzetto in mano: trascini e
 * ruota, lasci e prosegue un poco, poi si ferma di fronte o di spalle con una
 * molla morbida. Un tocco lo gira di mezzo giro. Ha spessore: di lato si vede
 * il bordo, non sparisce. Da fermo dondola piano.
 */
export function Character3D({
  id,
  number,
  name,
  height = 210,
  intro = "peek",
  locked = false,
}: {
  id: AvatarPresetId;
  number?: number | null;
  name?: string;
  height?: number;
  /** "spin": entra girando (sblocco), "peek": un piccolo cenno per far capire che si gira. */
  intro?: "spin" | "peek" | "none";
  locked?: boolean;
}) {
  const inner = useRef<HTMLDivElement>(null);
  // Lo spessore (gli strati interni) arriva al fotogramma dopo: la scheda si apre subito al tocco.
  const [thick, setThick] = useState(false);
  useEffect(() => {
    // Dopo il primo disegno (un fotogramma, poi subito dopo): non rallenta la risposta al tocco.
    let t = 0;
    const r = requestAnimationFrame(() => (t = window.setTimeout(() => setThick(true), 0)));
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t);
    };
  }, []);
  // Respira solo il lato che si vede: gli strati interni e il lato nascosto stanno fermi (meno lavoro al telefono).
  const [face, setFace] = useState<"front" | "back">("front");
  const width = Math.round((height * 100) / 185);
  const depth = Math.round(width * DEPTH);

  useEffect(() => {
    const el = inner.current;
    const sway = el?.parentElement;
    if (!el || !sway) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const st = {
      angle: 0,
      vel: 0,
      target: 0,
      drag: null as null | { x: number; a: number; samples: { t: number; a: number }[]; moved: boolean; t0: number },
      last: performance.now(),
      touched: false,
      raf: 0,
    };
    const stage = sway.parentElement!;
    el.style.transform = "";
    // L'entrata (un cenno o un giro intero) la fa il browser da solo: fluida anche sui telefoni lenti.
    const introCls = reduce || intro === "none" ? null : intro === "spin" ? "char3d-spin" : "char3d-peek";
    let introOn = Boolean(introCls);
    const endIntro = (keepAngle: boolean) => {
      if (!introOn) return;
      introOn = false;
      if (keepAngle) {
        try {
          const t = getComputedStyle(el).transform;
          if (t && t !== "none") {
            const m = new DOMMatrixReadOnly(t);
            st.angle = (Math.atan2(m.m31, m.m11) * 180) / Math.PI;
          }
        } catch {
          /* ignora */
        }
      }
      el.classList.remove(introCls!);
      el.style.transform = `rotateY(${st.angle.toFixed(2)}deg)`;
    };
    const onIntroEnd = (e: AnimationEvent) => {
      if (e.target !== el || !introOn) return;
      endIntro(false);
      setFace("front");
      startSway();
    };
    if (introCls) {
      el.classList.add(introCls);
      el.addEventListener("animationend", onIntroEnd);
    }

    // Da fermo dondola piano: lo fa il browser da solo (animazione CSS), senza lavoro a ogni fotogramma.
    const startSway = () => {
      if (!reduce) sway.classList.add("char3d-swaying");
    };
    // Al tocco il dondolio si ferma dov'è: il suo angolo passa al personaggio, senza scatti.
    const stopSway = () => {
      if (!sway.classList.contains("char3d-swaying")) return;
      try {
        const t = getComputedStyle(sway).transform;
        if (t && t !== "none") {
          const m = new DOMMatrixReadOnly(t);
          st.angle += (Math.atan2(m.m31, m.m11) * 180) / Math.PI;
        }
      } catch {
        /* browser vecchio: riparte da dov'era prima del dondolio */
      }
      sway.classList.remove("char3d-swaying");
      el.style.transform = `rotateY(${st.angle.toFixed(2)}deg)`;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      st.raf = 0;
      if (!st.drag) {
        // Molla verso la faccia più vicina (leggermente elastica, non dura).
        const k = 90;
        const c = 2 * Math.sqrt(k) * 0.82;
        const acc = -k * (st.angle - st.target) - c * st.vel;
        st.vel += acc * dt;
        st.angle += st.vel * dt;
        if (Math.abs(st.angle - st.target) < 0.25 && Math.abs(st.vel) < 4) {
          // Fermo: l'angolo torna tra 0 e 360 senza che si veda, e il ciclo si spegne.
          const norm = ((st.target % 360) + 360) % 360;
          st.angle = norm;
          st.target = norm;
          st.vel = 0;
          el.style.transform = `rotateY(${norm}deg)`;
          setFace(norm === 180 ? "back" : "front");
          if (st.touched) play("tick");
          startSway();
          return;
        }
      }
      el.style.transform = `rotateY(${st.angle.toFixed(2)}deg)`;
      st.raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (st.raf) return;
      st.last = performance.now();
      st.raf = requestAnimationFrame(frame);
    };
    // Senza entrata animata: fermo subito, poi il dondolio.
    const t0 = introCls ? 0 : window.setTimeout(wake, 60);

    const down = (e: PointerEvent) => {
      stage.setPointerCapture(e.pointerId);
      endIntro(true);
      stopSway();
      st.touched = true;
      st.drag = { x: e.clientX, a: st.angle, samples: [{ t: e.timeStamp, a: st.angle }], moved: false, t0: e.timeStamp };
      st.vel = 0;
      wake();
    };
    const move = (e: PointerEvent) => {
      const d = st.drag;
      if (!d) return;
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 5) d.moved = true;
      st.angle = d.a + dx * 0.75;
      d.samples.push({ t: e.timeStamp, a: st.angle });
      while (d.samples.length > 2 && e.timeStamp - d.samples[0].t > 90) d.samples.shift();
    };
    const up = (e: PointerEvent) => {
      const d = st.drag;
      if (!d) return;
      st.drag = null;
      wake();
      if (!d.moved && e.timeStamp - d.t0 < 350) {
        // Un tocco: mezzo giro.
        st.target = Math.round(st.angle / 180) * 180 + 180;
        st.vel = 260;
        haptic(5);
        play("whoosh");
        return;
      }
      const a = d.samples[0];
      const b = d.samples[d.samples.length - 1];
      const v = b.t > a.t ? ((b.a - a.a) / (b.t - a.t)) * 1000 : 0;
      st.vel = Math.max(-1400, Math.min(1400, v));
      // Dove si fermerebbe con lo slancio: la faccia più vicina a quel punto.
      st.target = Math.round((st.angle + st.vel * 0.28) / 180) * 180;
      if (Math.abs(st.vel) > 500) play("whoosh");
      haptic(4);
    };
    stage.addEventListener("pointerdown", down);
    stage.addEventListener("pointermove", move);
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    return () => {
      window.clearTimeout(t0);
      el.removeEventListener("animationend", onIntroEnd);
      cancelAnimationFrame(st.raf);
      stage.removeEventListener("pointerdown", down);
      stage.removeEventListener("pointermove", move);
      stage.removeEventListener("pointerup", up);
      stage.removeEventListener("pointercancel", up);
    };
  }, [intro]);

  const slices = Array.from({ length: SLICES }, (_, i) => -depth / 2 + ((i + 1) * depth) / (SLICES + 1));
  return (
    <div className="char3d mx-auto select-none" style={{ width: width + depth * 2, height }} role="img" aria-label="Trascina o tocca per girare il personaggio">
      <div className="char3d-stage">
        <div className="char3d-sway">
        <div ref={inner} className="char3d-inner" style={{ width, height }}>
          <div className="char3d-face char3d-back" style={{ transform: `rotateY(180deg) translateZ(${depth / 2}px)` }}>
            <Character id={id} number={number} height={height} back backName={locked ? undefined : name} idle={!locked && face === "back"} />
          </div>
          {thick && slices.map((z) => (
            <div key={z} className="char3d-slice" style={{ transform: `translateZ(${z.toFixed(1)}px)` }}>
              <Character id={id} number={null} height={height} noBall />
            </div>
          ))}
          <div className="char3d-face" style={{ transform: `translateZ(${depth / 2}px)` }}>
            <Character id={id} number={number} height={height} idle={!locked && face === "front"} />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

function StepBar({ step }: { step: GoalStep }) {
  const pct = Math.round((step.have / step.need) * 100);
  return (
    <div className="text-left">
      <div className="flex items-baseline justify-between gap-2">
        <p className={clsx("min-w-0 text-[13.5px] font-bold leading-snug", step.done && "text-ok")}>
          {step.done && <Check size={13} strokeWidth={3} className="-mt-0.5 mr-1 inline" aria-hidden />}
          {step.label}
        </p>
        <p className="tnum shrink-0 text-[12.5px] font-bold text-muted">
          {step.have}/{step.need}
        </p>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-edge bg-surface">
        <div className={clsx("h-full rounded-full transition-[width] duration-700", step.done ? "bg-ok" : "bg-ball")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted">{step.detail}</p>
    </div>
  );
}

/** La scheda di un personaggio: si apre al tocco, sopra a tutto, centrata. */
export function CharacterCard({
  id,
  onClose,
  onUse,
  intro = "peek",
}: {
  id: AvatarPresetId | null;
  onClose: () => void;
  onUse?: (id: AvatarPresetId) => void;
  intro?: "spin" | "peek";
}) {
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
  const shiny = rarity === "mitica" || rarity === "leggendaria";

  return createPortal(
    <div data-over-sheet className="pointer-events-auto fixed inset-0 z-[70] flex items-center justify-center px-5" role="dialog" aria-modal="true" aria-labelledby="char-title">
      <div className={clsx("absolute inset-0 bg-[#1d1a16]/55", leaving ? "fade-out" : "fade-in")} onClick={onClose} />
      <div
        className={clsx("relative w-full max-w-[340px] select-none overflow-hidden rounded-[30px] border-[2.5px] border-edge bg-surface text-center", leaving ? "char-card-out" : "char-card-in")}
        style={{ boxShadow: rarity === "base" ? "6px 6px 0 var(--edge)" : `0 0 0 3px ${RARITY[rarity].ring}, 7px 7px 0 var(--edge)` }}
      >
        <div className={clsx("halftone relative px-4 pb-2 pt-4", shiny && "rarity-shine")} style={{ background: p.bg }}>
          <button onClick={onClose} aria-label="Chiudi" className="press absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border-2 border-edge bg-surface text-text">
            <X size={18} />
          </button>
          <span
            className="absolute left-3 top-3 z-10 rounded-full border-2 border-[#1d1a16] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1d1a16]"
            style={{ background: rarity === "base" ? "#fffaf0" : rarity === "epica" || rarity === "mitica" || rarity === "rara" ? "#fffaf0" : RARITY[rarity].ring }}
          >
            <span className="mr-1 inline-block h-2 w-2 rounded-full border border-[#1d1a16] align-[1px]" style={{ background: RARITY[rarity].ring }} aria-hidden />
            {RARITY[rarity].one}
          </span>
          <div className={clsx(!prog.unlocked && "opacity-45 grayscale")}>
            <Character3D id={shown} number={me.jerseyNumber} name={me.nickname ?? me.firstName} height={190} intro={intro} locked={!prog.unlocked} />
          </div>
          {!prog.unlocked && (
            <span className="pointer-events-none absolute left-1/2 top-[46%] grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[2.5px] border-edge bg-surface text-text">
              <Lock size={24} />
            </span>
          )}
          <p className="mt-1 flex items-center justify-center gap-1 text-[11.5px] font-semibold text-[#fffaf0]/90 [text-shadow:0_1px_0_rgb(0_0_0/0.35)]">
            <RotateCw size={12} aria-hidden /> Trascina o tocca per girarlo
          </p>
        </div>
        <div className="px-5 pb-5 pt-4">
          <h2 id="char-title" className="display text-[28px] leading-[1.1]">
            {p.name}
          </h2>
          <p className="mt-1 text-[14px] text-muted">{CHARACTER_TAGLINE[shown]}</p>

          {rarity !== "base" && (
            <div className="mt-4 rounded-[18px] bg-raised px-4 py-3">
              <p className="text-[12px] font-semibold text-muted">{prog.unlocked ? "Sbloccato con" : prog.steps.length > 1 ? "Si sblocca con tutti e due" : "Si sblocca con"}</p>
              {prog.unlocked ? (
                <>
                  <p className="title text-[15.5px]">{prog.goal}</p>
                  <p className="text-[12.5px] text-muted">{prog.detail}</p>
                </>
              ) : (
                <div className="mt-1.5 flex flex-col gap-2.5">
                  {prog.steps.map((s) => (
                    <StepBar key={s.label} step={s} />
                  ))}
                </div>
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

/** Tutti i personaggi, divisi per rarità, con il prossimo da sbloccare in cima. */
export function CharacterGrid({ onOpen }: { onOpen: (id: AvatarPresetId) => void }) {
  const { me, engine } = useData();
  const states = useMemo(() => (me ? engine.badges(me.id).states : []), [me, engine]);
  const progress = useMemo(() => new Map(AVATAR_PRESETS.map((p) => [p.id, characterProgress(p.id, states)])), [states]);
  // Al tocco solo il pannello; al fotogramma dopo la parte in alto, il resto appena il
  // pannello ha finito di salire: niente scatti all'apertura.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    let t1 = 0;
    const r = requestAnimationFrame(() => (t1 = window.setTimeout(() => setStage((s) => Math.max(s, 1)), 0)));
    const t = window.setTimeout(() => setStage(2), 420);
    return () => {
      cancelAnimationFrame(r);
      window.clearTimeout(t1);
      window.clearTimeout(t);
    };
  }, []);
  const all = stage >= 2;
  if (!me) return null;
  const total = AVATAR_PRESETS.length;
  const open = AVATAR_PRESETS.filter((p) => progress.get(p.id)!.unlocked).length;
  const next = nextCharacter(states);
  const nextP = next && AVATAR_PRESETS.find((p) => p.id === next.id)!;
  const nextStep = next?.progress.steps.find((s) => !s.done) ?? next?.progress.steps[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="text-center">
          <p className="text-[13px] font-bold text-muted">
            Collezione <span className="tnum text-text">{open}</span> di <span className="tnum">{total}</span>
          </p>
          <div className="mx-auto mt-1.5 h-2.5 max-w-[240px] overflow-hidden rounded-full border-2 border-edge bg-surface">
            <div className="h-full rounded-full bg-volt" style={{ width: `${Math.round((open / total) * 100)}%` }} />
          </div>
        </div>
        {next && nextP && nextStep && (
          <button
            onClick={() => {
              haptic(5);
              play("select");
              onOpen(next.id);
            }}
            className="press sticker-sm flex items-center gap-3 rounded-[20px] bg-surface px-3 py-2 text-left"
            aria-label={`Il prossimo da sbloccare: ${nextP.name}`}
          >
            <span className="grid h-[60px] w-11 shrink-0 place-items-end justify-center opacity-60 grayscale">
              <Character id={next.id} height={60} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 text-[12px] font-bold text-court">
                <Sparkles size={13} aria-hidden /> Il prossimo: {nextP.name}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-tight">{nextStep.label}</span>
              <span className="mt-1 flex items-center gap-2">
                <span className="h-2 flex-1 overflow-hidden rounded-full border-[1.5px] border-edge bg-raised">
                  <span className="block h-full rounded-full bg-ball" style={{ width: `${Math.round(next.progress.pct * 100)}%` }} />
                </span>
                <span className="tnum shrink-0 text-[12px] font-bold text-muted">
                  {nextStep.have}/{nextStep.need}
                </span>
              </span>
            </span>
          </button>
        )}
      </div>

      {RARITIES.map((g, gi) => {
        const items = AVATAR_PRESETS.filter((p) => p.rarity === g);
        const got = items.filter((p) => progress.get(p.id)!.unlocked).length;
        if ((gi > 1 && !all) || stage === 0) return <div key={g} style={{ height: Math.ceil(items.length / 4) * 112 + 60 }} aria-hidden />;
        return (
          <section key={g} className="[content-visibility:auto] [contain-intrinsic-size:auto_420px]">
            <h3 className="mb-1 flex items-center justify-center gap-2 text-[13.5px] font-bold">
              <span className="h-3 w-3 rounded-full border-2 border-edge" style={{ background: RARITY[g].ring }} aria-hidden />
              {RARITY[g].label}
              <span className="tnum font-semibold text-muted">
                {got}/{items.length}
              </span>
            </h3>
            <p className="mb-2.5 text-center text-[12px] text-muted">{RARITY[g].rule}</p>
            <div className="grid grid-cols-4 gap-2">
              {items.map((p) => {
                const prog = progress.get(p.id)!;
                const on = me.character === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      haptic(5);
                      play("select");
                      onOpen(p.id);
                    }}
                    aria-label={`${p.name}${prog.unlocked ? "" : ", bloccato"}${on ? ", il tuo" : ""}`}
                    className={clsx(
                      "press relative flex flex-col items-center overflow-hidden rounded-[18px] border-2 border-edge px-0.5 pb-1.5 pt-1.5",
                      on ? "sticker bg-volt" : "bg-surface",
                    )}
                    style={g !== "base" && !on ? { boxShadow: `inset 0 -4px 0 ${RARITY[g].ring}` } : undefined}
                  >
                    <span className={clsx("block", !prog.unlocked && "opacity-30 grayscale dark:opacity-50")}>
                      <Character id={p.id} number={me.jerseyNumber} height={70} />
                    </span>
                    {!prog.unlocked && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-edge bg-surface">
                        <Lock size={10} />
                      </span>
                    )}
                    {!prog.unlocked && prog.pct > 0 && (
                      <span className="absolute inset-x-2.5 bottom-[23px] h-1.5 overflow-hidden rounded-full border border-edge bg-surface" aria-hidden>
                        <span className="block h-full bg-ball" style={{ width: `${Math.round(prog.pct * 100)}%` }} />
                      </span>
                    )}
                    {on && (
                      <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-edge bg-ok text-white">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    )}
                    <span className={clsx("mt-1 w-full truncate px-0.5 text-[11.5px] font-bold", on && "text-volt-ink")}>{p.name}</span>
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
