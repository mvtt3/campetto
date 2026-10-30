"use client";

import { MoveDown, MoveHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useIntroDone } from "@/components/intro";
import { Mascot } from "@/components/mascot";
import { Button, haptic } from "@/components/ui/basics";
import { SWIPE_DEMO } from "@/components/tab-swipe";
import { displayName, type Player } from "@/lib/types";
import {
  readTour,
  saveTour,
  SECTION_IDS,
  sections,
  tourKey,
  type SectionId,
  type TourState,
} from "./model";

interface Active {
  mode: "welcome" | "steps";
  section: SectionId;
  step: number;
  run: SectionId[];
}

interface TourApi {
  state: TourState;
  begin: (section?: SectionId) => void;
  restart: () => void;
}

const Ctx = createContext<TourApi | null>(null);
export const useTutorial = () => useContext(Ctx);

const TABS = ["/", "/classifiche", "/partite", "/profilo"];

function targetFor(id: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)].find(
      (el) => el.getClientRects().length > 0,
    ) ?? null
  );
}

async function waitFor(id: string, ms = 1400): Promise<HTMLElement | null> {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    const el = targetFor(id);
    if (el) return el;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return null;
}

/**
 * Guida all'app con Spicchio, come in Mysoft: un benvenuto, poi una sezione per
 * scheda con il punto evidenziato. Ogni scheda si può saltare e la guida si
 * riapre dalle impostazioni.
 */
export function TutorialProvider({
  me,
  children,
}: {
  me: Player;
  children: ReactNode;
}) {
  const key = tourKey(me.id);
  const [state, setState] = useState<TourState>(() => readTour(key));
  const [active, setActive] = useState<Active | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const path = usePathname();
  const moving = useRef(false);
  const all = sections(me.isAdmin);

  const update = useCallback(
    (patch: Partial<TourState>) =>
      setState((old) => {
        const next = { ...old, ...patch };
        saveTour(key, next);
        return next;
      }),
    [key],
  );

  const go = useCallback(async (id: SectionId) => {
    const target = sections(false)[id].path;
    moving.current = true;
    if (window.location.pathname !== target)
      window.history.pushState(null, "", target);
    await new Promise((r) => setTimeout(r, 60));
    moving.current = false;
  }, []);

  const start = useCallback(
    async (run: SectionId[], section: SectionId, step = 0) => {
      update({ status: "in_progress", section, step });
      await go(section);
      setActive({ mode: "steps", section, step, run });
    },
    [go, update],
  );

  // Sempre lo stesso finché la guida non cambia: chi la usa non si ridisegna a ogni cambio di pagina.
  const api = useMemo<TourApi>(
    () => ({
      state,
      begin: (section) =>
        void (section ? start([section], section) : start(SECTION_IDS, "home")),
      restart: () => void start(SECTION_IDS, "home"),
    }),
    [state, start],
  );

  const introDone = useIntroDone();
  // Al primo ingresso: il benvenuto, appena non c'è altro sullo schermo (né l'apertura, né una festa).
  useEffect(() => {
    if (state.status !== "new" || active || !TABS.includes(path) || !introDone)
      return;
    const t = window.setInterval(() => {
      if (document.querySelector('[role="dialog"]') || document.hidden) return;
      window.clearInterval(t);
      setActive({
        mode: "welcome",
        section: "home",
        step: 0,
        run: SECTION_IDS,
      });
    }, 900);
    return () => window.clearInterval(t);
  }, [state.status, active, path, introDone]);

  // Il tasto indietro del telefono chiude la guida.
  useEffect(() => {
    if (!active) return;
    const back = () => !moving.current && setActive(null);
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [active]);

  const close = () => {
    if (active?.mode === "welcome") update({ status: "dismissed" });
    setActive(null);
  };

  const finish = (whole: boolean) => {
    update({ status: "completed", section: null, step: 0 });
    setActive(null);
    setDone(whole ? Date.now() : -Date.now());
    if (whole) void go("home");
  };

  const next = async (skip = false) => {
    if (!active) return;
    haptic(6);
    const sec = all[active.section];
    if (!skip && active.step + 1 < sec.steps.length) {
      const s = active.step + 1;
      setActive({ ...active, step: s });
      update({ step: s });
      return;
    }
    const nextId = active.run[active.run.indexOf(active.section) + 1];
    if (!nextId) return finish(active.run.length > 1);
    update({ section: nextId, step: 0 });
    // Dalla Home alla Classifica la guida mostra il gesto: la scheda scorre da sola, un attimo.
    if (active.section === "home" && nextId === "classifica") {
      setActive(null);
      // Prima il gesto per aggiornare (tira giù), poi quello per cambiare scheda.
      await showHint("pull");
      await showHint("swipe");
      if (window.location.pathname !== sections(false)[nextId].path)
        await go(nextId);
    } else await go(nextId);
    setActive({ ...active, section: nextId, step: 0 });
  };

  const [hint, setHint] = useState<"swipe" | "pull" | null>(null);
  const showHint = async (kind: "swipe" | "pull") => {
    setHint(kind);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    await new Promise((r) => setTimeout(r, 240));
    if (!reduce) {
      if (kind === "swipe") window.dispatchEvent(new Event(SWIPE_DEMO));
      else {
        // La schermata scende un attimo e torna su, come quando la tiri giù col dito.
        const page = document.querySelector<HTMLElement>(
          ".tab-page:not(.tab-off)",
        );
        page?.classList.add("pull-demo");
        window.setTimeout(() => page?.classList.remove("pull-demo"), 1150);
      }
    }
    await new Promise((r) => setTimeout(r, 1100));
    setHint(null);
  };

  const prev = async () => {
    if (!active) return;
    if (active.step > 0) {
      setActive({ ...active, step: active.step - 1 });
      update({ step: active.step - 1 });
      return;
    }
    const p = active.run[active.run.indexOf(active.section) - 1];
    if (!p) return;
    const s = all[p].steps.length - 1;
    update({ section: p, step: s });
    await go(p);
    setActive({ ...active, section: p, step: s });
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {active && (
        <Coach
          active={active}
          all={all}
          onClose={close}
          onNext={next}
          onPrev={prev}
          onStart={() => void start(SECTION_IDS, "home")}
        />
      )}
      {hint && <GestureHint kind={hint} />}
      {done !== null && (
        <Completion
          key={done}
          whole={done > 0}
          name={displayName(me)}
          onClose={() => setDone(null)}
        />
      )}
    </Ctx.Provider>
  );
}

interface Geo {
  card: { left: number; top: number; width: number };
  hole: { x: number; y: number; w: number; h: number } | null;
}

function Coach({
  active,
  all,
  onClose,
  onNext,
  onPrev,
  onStart,
}: {
  active: Active;
  all: ReturnType<typeof sections>;
  onClose: () => void;
  onNext: (skip?: boolean) => void;
  onPrev: () => void;
  onStart: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const sec = all[active.section];
  const item = active.mode === "steps" ? sec.steps[active.step] : null;
  const total = active.run.length;

  useLayoutEffect(() => {
    let cancelled = false;
    const place = () => {
      if (cancelled) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(344, vw - 24);
      const left = (vw - width) / 2;
      const h = card.current?.offsetHeight ?? 220;
      const el = item ? targetFor(item.target) : null;
      const r = el?.getBoundingClientRect();
      if (!r)
        return setGeo({
          card: { left, top: Math.max(12, (vh - h) / 2), width },
          hole: null,
        });
      // Elementi molto alti (un elenco): si evidenzia solo la parte in alto.
      const hole = {
        x: Math.max(6, r.left - 6),
        y: Math.max(6, r.top - 6),
        w: Math.min(vw - 12, r.width + 12),
        h: Math.min(vh * 0.42, r.height + 12),
      };
      const below = hole.y + hole.h + 14 + h <= vh - 12;
      const above = hole.y - 14 - h >= 12;
      // Senza spazio né sopra né sotto, la scheda va dal lato opposto e copre il punto il meno possibile.
      const top = below
        ? hole.y + hole.h + 14
        : above
          ? hole.y - 14 - h
          : hole.y + hole.h / 2 < vh / 2
            ? vh - h - 12
            : 12;
      setGeo({ card: { left, top, width }, hole });
    };
    void (async () => {
      const el = item ? await waitFor(item.target) : null;
      el?.scrollIntoView({ block: "nearest" });
      place();
    })();
    const ro = new ResizeObserver(place);
    if (card.current) ro.observe(card.current);
    window.addEventListener("resize", place);
    return () => {
      cancelled = true;
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [item]);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);

  const hole = geo?.hole && geo.hole.h > 0 ? geo.hole : null;
  const lastStep =
    active.mode === "steps" && active.step === sec.steps.length - 1;
  const lastSection = active.run[total - 1] === active.section;
  const first = active.step === 0 && active.run[0] === active.section;

  return createPortal(
    <div
      className="fixed inset-0 z-[80]"
      data-tour-overlay=""
      onPointerDown={(e) => e.stopPropagation()}
    >
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                className="tour-rect"
                style={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
                rx="22"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(29,26,22,0.62)"
          mask="url(#tour-hole)"
        />
        {hole && (
          <rect
            className="tour-rect"
            style={{ x: hole.x, y: hole.y, width: hole.w, height: hole.h }}
            rx="22"
            fill="none"
            stroke="#FFC531"
            strokeWidth="3.5"
            strokeDasharray="8 6"
          />
        )}
      </svg>
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className="tour-card absolute rounded-[26px] border-[2.5px] border-edge bg-surface px-5 pb-4 pt-4 text-center text-text"
        style={{
          left: geo?.card.left ?? 12,
          top: geo?.card.top ?? -999,
          width: geo?.card.width ?? 320,
          boxShadow: "5px 5px 0 #1d1a16",
          visibility: geo ? "visible" : "hidden",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={active.mode === "welcome" ? "Ora no" : "Chiudi la guida"}
          className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full text-muted"
        >
          <X size={19} />
        </button>
        <div
          key={`${active.mode}-${active.section}-${active.step}`}
          className="tour-step"
        >
          <div className="mx-auto -mt-1 w-fit">
            <Mascot
              pose={
                active.mode === "welcome"
                  ? "ciao"
                  : lastStep && lastSection
                    ? "esulta"
                    : "ciao"
              }
              size={active.mode === "welcome" ? 82 : 44}
              animate={active.mode === "welcome"}
            />
          </div>
          {active.mode === "steps" && (
            <p
              className="mt-1 text-[12px] font-bold uppercase tracking-wide text-muted"
              aria-live="polite"
            >
              {sec.title} · {active.step + 1} di {sec.steps.length}
            </p>
          )}
          <h2
            id="tour-title"
            ref={title}
            tabIndex={-1}
            className="display mt-1 text-[22px] leading-tight outline-none"
          >
            {active.mode === "welcome" ? "Iniziamo?" : item?.title}
          </h2>
          <p
            id="tour-text"
            className="mx-auto mt-1.5 max-w-[30ch] text-[14.5px] text-muted"
          >
            {active.mode === "welcome"
              ? "Ti mostro il Campetto in un minuto"
              : item?.text}
          </p>
          {active.mode === "welcome" ? (
            <>
              <p className="mt-2 text-[12.5px] font-semibold text-faint">
                {total} schede · circa un minuto
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="court" block onClick={onStart}>
                  Inizia
                </Button>
                <Button variant="ghost" block onClick={onClose}>
                  Ora no
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
                {sec.steps.map((s, i) => (
                  <i
                    key={s.target}
                    className={`h-2 rounded-full border-[1.5px] border-edge transition-all duration-200 ${i <= active.step ? "w-5 bg-ball" : "w-2 bg-surface"}`}
                  />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button size="md" disabled={first} onClick={onPrev}>
                  Indietro
                </Button>
                <Button size="md" variant="court" onClick={() => onNext()}>
                  {lastStep && lastSection ? "Fine" : "Avanti"}
                </Button>
              </div>
              {!(lastStep && lastSection) && (
                <button
                  type="button"
                  onClick={() => onNext(true)}
                  className="mt-2.5 text-[13.5px] font-bold text-court underline decoration-2 underline-offset-4"
                >
                  {total > 1 ? `Salta ${sec.title}` : "Salta la guida"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Un attimo solo: un dito che fa il gesto e una scritta. "swipe": scorre di lato mentre la
 * scheda passa a quella dopo; "pull": scende dall'alto mentre la schermata si abbassa e
 * torna su, come quando si aggiorna. Durante il gesto i tocchi aspettano.
 */
function GestureHint({ kind }: { kind: "swipe" | "pull" }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[80]"
      onPointerDown={(e) => e.preventDefault()}
    >
      <span
        className={kind === "swipe" ? "swipe-finger" : "pull-finger"}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[112px] flex justify-center px-4"
        role="status"
      >
        <p
          className="swipe-pill flex items-center gap-2 rounded-full border-[2.5px] border-edge bg-volt py-2 pl-3 pr-4 text-[14.5px] font-bold text-volt-ink"
          style={{ boxShadow: "3px 3px 0 #1d1a16" }}
        >
          {kind === "swipe" ? (
            <>
              <MoveHorizontal size={18} aria-hidden /> Scorri di lato per
              cambiare scheda
            </>
          ) : (
            <>
              <MoveDown size={18} aria-hidden /> Tira giù per aggiornare
            </>
          )}
        </p>
      </div>
    </div>,
    document.body,
  );
}

function Completion({
  whole,
  name,
  onClose,
}: {
  whole: boolean;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 4200);
    return () => window.clearTimeout(t);
  }, [onClose]);
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[104px] z-[80] flex justify-center px-4"
      role="status"
    >
      <div
        className="ptr-done pointer-events-auto flex max-w-sm items-center gap-3 rounded-[22px] border-[2.5px] border-edge bg-volt py-2 pl-2 pr-3 text-volt-ink"
        style={{ boxShadow: "4px 4px 0 #1d1a16", animationDuration: "4.2s" }}
      >
        <Mascot pose="esulta" size={46} />
        <div className="min-w-0 text-left">
          <p className="display text-[18px] leading-none">
            {whole ? "Tutto pronto" : "Scheda fatta"}
          </p>
          <p className="mt-1 truncate text-[13px] font-semibold">
            {whole
              ? `Buone partite, ${name}`
              : "La guida resta nelle impostazioni"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        >
          <X size={17} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
