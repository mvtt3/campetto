"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/basics";
import { play } from "@/lib/sound";
import { DAY_NAMES, dow, fmtEuro, week, xpNeed } from "@/lib/game/economy";
import { teamMood } from "@/lib/game/career";
import { unreadCount } from "@/lib/game/messages";
import { SKILL_NAMES, advanceDay, todayMatch, type Activity } from "@/lib/game/state";
import type { GameState, Skill } from "@/lib/game/types";
import { useGame } from "./store";

/**
 * Il giorno che passa: la pagina del calendario si strappa e sotto c'è il giorno nuovo.
 * Prima però il resoconto di oggi: cosa hai fatto e cosa è cambiato (abilità, energia,
 * umore, soldi, rapporti, messaggi). Così ogni scelta ha un effetto che si vede.
 */

export interface DayRecap {
  before: GameState;
  after: GameState;
  act: Activity;
  note: string;
}

const ACT: Record<Activity["kind"], { emoji: string; title: (a: Activity) => string }> = {
  allenamento: { emoji: "🏋️", title: (a) => (a.kind === "allenamento" ? `Allenamento: ${SKILL_NAMES[a.skill].toLowerCase()}` : "Allenamento") },
  riposo: { emoji: "😴", title: () => "Giornata di riposo" },
  serata: { emoji: "🪩", title: () => "Serata fuori" },
  ragazza: { emoji: "❤️", title: () => "Uscita in due" },
  amici: { emoji: "🍕", title: () => "Pizza con gli amici" },
  campetto: { emoji: "🏀", title: () => "Partitella al campetto" },
  parco: { emoji: "🌳", title: () => "Corsa al parco" },
  squadra: { emoji: "🍕", title: () => "Pizza con la squadra" },
  partita: { emoji: "🏀", title: () => "Giorno di partita" },
};

function Page({ day, match }: { day: number; match: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden rounded-[22px] border-[3px] border-[#1d1a16] bg-[#FFF8EA] text-[#1d1a16]">
      <div className="relative flex h-12 items-center justify-center bg-[#E5412D] text-[15px] font-bold text-[#FFF8EA]">
        Settimana {week(day)}
        {/* gli anelli del calendario */}
        <span className="absolute -top-2 left-[28%] h-5 w-2.5 rounded-full border-2 border-[#1d1a16] bg-[#d9d2c4]" />
        <span className="absolute -top-2 right-[28%] h-5 w-2.5 rounded-full border-2 border-[#1d1a16] bg-[#d9d2c4]" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="score text-[88px] leading-none">{day}</p>
        <p className="display mt-1 text-[24px]">{DAY_NAMES[dow(day)]}</p>
        {match && <p className="mt-2 rounded-full bg-[#1d1a16] px-3 py-1 text-[13px] font-bold text-volt">🏀 Partita</p>}
      </div>
    </div>
  );
}

function Delta({ label, from, to, unit = "", money = false }: { label: string; from: number; to: number; unit?: string; money?: boolean }) {
  const d = to - from;
  if (!d) return null;
  return (
    <li className="flex items-center justify-between gap-3 text-[15px]">
      <span>{label}</span>
      <span className={clsx("num", d > 0 ? "text-ok" : "text-danger")}>
        {d > 0 ? "+" : "−"}
        {money ? fmtEuro(Math.abs(d)) : `${Math.abs(d)}${unit}`}
      </span>
    </li>
  );
}

export function DayFlip({ recap, onClose }: { recap: DayRecap; onClose: () => void }) {
  const { before, after, act, note } = recap;
  const [torn, setTorn] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setTorn(true);
      play("shuffle");
    }, 1100);
    return () => window.clearTimeout(t);
  }, []);
  const info = ACT[act.kind];
  const trained = act.kind === "allenamento" ? act.skill : null;
  const skillUps = (Object.keys(after.skills) as Skill[]).filter((k) => after.skills[k] !== before.skills[k]);
  const rels = after.contacts
    .map((c) => ({ c, d: c.rel - (before.contacts.find((b) => b.id === c.id)?.rel ?? c.rel) }))
    .filter((x) => x.d !== 0);
  const msgs = Math.max(0, unreadCount(after) - unreadCount(before));
  const salary = after.bank.slice(before.bank.length).find((t) => t.label.startsWith("Stipendio"));
  const match = !!todayMatch(after);

  return (
    <div
      className="fade-in fixed inset-0 z-[68] bg-[#0d1124]/92"
      // Un tocco strappa subito la pagina, il secondo chiude.
      onClick={() => (torn ? onClose() : setTorn(true))}
      role="dialog"
      aria-modal
      aria-label="Il giorno dopo"
      data-testid="day-flip"
    >
      <div className="mx-auto flex h-full max-w-lg flex-col items-center gap-4 overflow-y-auto px-5 pb-[max(20px,var(--sab))] pt-[max(24px,var(--sat))]">
        {/* Il calendario: sotto il giorno nuovo, sopra la pagina di oggi che si strappa. */}
        <div className="relative h-[210px] w-[190px] shrink-0 [perspective:700px]">
          <Page day={after.day} match={match} />
          <div
            className="absolute inset-0 origin-top transition-[transform,opacity] duration-[650ms] ease-in"
            style={{ transform: torn ? "rotateX(-105deg) translateY(-6px)" : "none", opacity: torn ? 0 : 1, transitionTimingFunction: "cubic-bezier(.6,.05,.9,.5)" }}
          >
            <Page day={before.day} match={false} />
          </div>
        </div>

        <div className="card w-full px-4 pb-4 pt-3 text-text">
          <p className="text-[13px] font-bold text-muted">{DAY_NAMES[dow(before.day)]}, com&apos;è andata</p>
          <p className="display mt-1 flex items-center gap-2 text-[22px] leading-tight">
            <span aria-hidden>{info.emoji}</span>
            {info.title(act)}
          </p>
          {note && <p className="mt-1 text-[14.5px] font-semibold">{note}</p>}

          {trained && (
            <div className="mt-3">
              <div className="flex items-baseline justify-between text-[14px] font-semibold">
                <span>{SKILL_NAMES[trained]}</span>
                <span className="num">
                  {before.skills[trained] !== after.skills[trained] ? `${before.skills[trained]} → ${after.skills[trained]}` : after.skills[trained]}
                </span>
              </div>
              <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-edge bg-surface">
                <div
                  className="h-full rounded-full bg-court transition-[width] delay-500 duration-700"
                  style={{ width: torn ? `${Math.min(100, (after.xp[trained] / xpNeed(after.skills[trained])) * 100)}%` : `${Math.min(100, (before.xp[trained] / xpNeed(before.skills[trained])) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-[12.5px] text-muted">Esperienza verso il prossimo punto</p>
            </div>
          )}

          <ul className="mt-3 flex flex-col gap-1.5 border-t-2 border-dashed border-line pt-3">
            {skillUps
              .filter((k) => k !== trained)
              .map((k) => (
                <Delta key={k} label={SKILL_NAMES[k]} from={before.skills[k]} to={after.skills[k]} />
              ))}
            <Delta label="⚡ Energia" from={before.energy} to={after.energy} />
            <Delta label="🙂 Umore" from={before.happiness} to={after.happiness} />
            <Delta label="⭐ Fama" from={before.fame} to={after.fame} />
            <Delta label="💶 Soldi" from={before.money} to={after.money} money />
            <Delta label="🤝 Morale squadra" from={teamMood(before)} to={teamMood(after)} />
            <Delta label="🏢 Società" from={before.club} to={after.club} />
            <Delta label="📸 Follower" from={before.social.followers} to={after.social.followers} />
            {rels.map(({ c, d }) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-[15px]">
                <span>{c.name}</span>
                <span className={clsx("num", d > 0 ? "text-ok" : "text-danger")}>
                  {d > 0 ? "♥ +" : "♥ −"}
                  {Math.abs(d)}
                </span>
              </li>
            ))}
            {salary && (
              <li className="flex items-center justify-between gap-3 text-[15px] font-semibold">
                <span>💶 È lunedì: stipendio</span>
                <span className="num text-ok">+{fmtEuro(salary.amount)}</span>
              </li>
            )}
            {msgs > 0 && <li className="text-[15px] font-semibold">📱 {msgs === 1 ? "Un messaggio nuovo" : `${msgs} messaggi nuovi`}</li>}
          </ul>
        </div>

        <Button variant="primary" size="lg" block className="!h-14 shrink-0" onClick={onClose} data-testid="day-flip-ok">
          {match ? "Si gioca!" : `Vai a ${DAY_NAMES[dow(after.day)].toLowerCase()}`}
        </Button>
      </div>
    </div>
  );
}

/** Passa al giorno dopo con un'attività, e mostra il resoconto col calendario. */
export function useDayAdvance(onClosed?: () => void) {
  const { game, update } = useGame();
  const [recap, setRecap] = useState<DayRecap | null>(null);
  const run = (a: Activity) => {
    const r = advanceDay(game, a, Math.random);
    if (r.s === game) return false;
    update(() => r.s);
    play(a.kind === "partita" ? "whoosh" : "success");
    setRecap({ before: game, after: r.s, act: a, note: r.note });
    return true;
  };
  const node = recap ? (
    <DayFlip
      recap={recap}
      onClose={() => {
        setRecap(null);
        onClosed?.();
      }}
    />
  ) : null;
  return { run, node };
}
