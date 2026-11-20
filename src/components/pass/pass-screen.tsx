"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconGift,
  IconHanger,
  IconLock,
  IconSnowflake,
} from "@tabler/icons-react";
import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Outfit, Preset } from "@/components/c3d/build";
import { Photo } from "@/components/c3d/viewer";
import { Button, ScreenHeader, haptic } from "@/components/ui/basics";
import { InfoTip } from "@/components/ui/info";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { play } from "@/lib/sound";
import {
  activateBoost,
  claimLevel,
  equip,
  keepBoostForLater,
  swapBoost,
} from "@/lib/pass/actions";
import {
  CARDINE,
  ITEM_BY_ID,
  LEVELS,
  MAX_BOOSTS,
  PASS_LEVELS,
  POINTS_PER_LEVEL,
  POINTS_PER_MATCH,
  RARITY_LABEL,
  SWAP_ODDS,
  duplicateRefund,
  type Item,
  type Level,
  type Rarity,
} from "@/lib/pass/catalog";
import type { PassProgress } from "@/lib/pass/engine";
import { resetPass, type PassState } from "@/lib/pass/store";
import { CappelloBabbo, Fiocco, Lucine, Pupazzo } from "./natale";
import { RewardReveal } from "./reveal";
import { BoostIcon, ItemPhoto, SpicchiChip, SpicchioIcon, rewardLabel } from "./ui";
import { usePass } from "./use-pass";

const rise = (i: number) => ({ "--i": i }) as CSSProperties;

export const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

/** I boost accesi che aspettano la prossima giornata. */
export function pendingBoosts(st: PassState, prog: PassProgress) {
  return st.boostActivations.filter((a) => !prog.matches.some((m) => Date.parse(m.match.playedAt) >= Date.parse(a)));
}

export function PassScreen() {
  const router = useRouter();
  const v = usePass();
  const { prog, st, playerId } = v;
  const toast = useToast();
  const [reveal, setReveal] = useState<{ item: Item; kicker: string; refund?: number } | null>(null);
  const [boostFull, setBoostFull] = useState<Level | null>(null);
  const [boostSheet, setBoostSheet] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [justClaimed, setJustClaimed] = useState<number | null>(null);
  const [haul, setHaul] = useState<{ spicchi: number; boosts: number; items: Item[]; left: number } | null>(null);
  // Mentre scorri le decorazioni si fermano un attimo (neve, lucine, bagliori): lo scorrimento
  // resta fluido anche sui telefoni lenti, e a dito fermo ripartono.
  const shell = useRef<HTMLDivElement>(null);
  const stickSpy = useRef<HTMLSpanElement>(null);
  const [stuck, setStuck] = useState(false);
  const claimable = (v.prog?.toClaim.length ?? 0) > 0;
  useEffect(() => {
    const el = stickSpy.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 1), {
      root: el.closest(".scroll-area"),
    });
    io.observe(el);
    return () => io.disconnect();
  }, [claimable]);
  const still = useRef<number | null>(null);
  const onScroll = () => {
    const el = shell.current;
    if (!el) return;
    if (still.current === null) el.dataset.scrolling = "";
    else window.clearTimeout(still.current);
    still.current = window.setTimeout(() => {
      still.current = null;
      delete el.dataset.scrolling;
    }, 180);
  };

  useEffect(() => {
    if (v.playerId && !v.allowed) router.replace("/");
  }, [v.playerId, v.allowed, router]);

  if (!prog || !playerId) return null;
  const natale = prog.season.theme === "natale";
  const level = prog.level;
  const next = level < LEVELS ? PASS_LEVELS[level] : null;
  const claimed = new Set(st.claimed);
  const pending = pendingBoosts(st, prog);
  let doneUpTo = 0;
  while (doneUpTo < level && claimed.has(doneUpTo + 1)) doneUpTo++;
  const collapse = doneUpTo >= 2 && !showDone;

  const claim = (lv: Level) => {
    haptic(12);
    if (lv.reward.kind === "boost" && claimLevel(playerId, lv.n, st.boosts) === "boost-full") {
      setBoostFull(lv);
      return;
    }
    if (lv.reward.kind !== "boost") claimLevel(playerId, lv.n, st.boosts);
    setJustClaimed(lv.n);
    if (lv.reward.kind === "item") {
      const it = ITEM_BY_ID.get(lv.reward.id);
      if (it) setReveal({ item: it, kicker: `Livello ${lv.n}` });
    } else {
      play(lv.reward.kind === "spicchi" ? "coins" : "unlock");
      toast(lv.reward.kind === "spicchi" ? `+${lv.reward.amount} Spicchi` : "Boost in tasca");
    }
  };

  /** Tutto in un colpo: Spicchi, boost (finché c'è posto) e oggetti, poi il riepilogo. */
  const claimAll = () => {
    let boosts = st.boosts;
    const got = { spicchi: 0, boosts: 0, items: [] as Item[], left: 0 };
    for (const n of prog.toClaim) {
      const lv = PASS_LEVELS[n - 1];
      if (lv.reward.kind === "boost") {
        if (boosts >= MAX_BOOSTS) {
          got.left++;
          continue;
        }
        boosts++;
        got.boosts++;
      } else if (lv.reward.kind === "spicchi") got.spicchi += lv.reward.amount;
      else {
        const it = ITEM_BY_ID.get(lv.reward.id);
        if (it) got.items.push(it);
      }
      claimLevel(playerId, n, boosts - (lv.reward.kind === "boost" ? 1 : 0));
    }
    play(got.items.length ? "unlock" : "coins");
    haptic([12, 40, 18]);
    setHaul(got);
  };

  return (
    <div ref={shell} className="relative isolate flex min-h-0 flex-1 flex-col">
      {/* A Natale il cielo d'inverno in cima alla pagina, con la neve che scende dietro a tutto. */}
      {natale && (
        <div className="cielo-natale" aria-hidden>
          <span className="snow" />
        </div>
      )}
      <ScreenHeader
        center
        title={natale ? "Pass di Natale" : "Pass Campetto"}
        subtitle={
          <span className="inline-flex items-center gap-1" data-testid="pass-days">
            {natale && <IconSnowflake size={13} className="text-court" aria-hidden />}
            {prog.daysLeft === 1 ? "Ultimo giorno" : `Finisce tra ${prog.daysLeft} giorni`}
          </span>
        }
        back="/"
        action={
          <Link
            href="/camerino"
            aria-label="Camerino"
            data-testid="to-camerino"
            className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface shadow-[var(--shadow)]"
          >
            <IconHanger size={21} />
          </Link>
        }
      />
      <div className="scroll-area min-h-0 flex-1 px-5 pb-10 pt-2" onScroll={onScroll}>
        {/* La season, come la testata del Pass Royale: il tabellone col livello, la barra dei punti,
            il prossimo premio in fondo alla barra e i boost. A Natale: neve sul bordo, le lucine,
            il pupazzo seduto sopra. */}
        <div className={clsx("rise relative", natale && "mt-14")} style={rise(0)}>
          {natale && <Pupazzo className="absolute -top-[74px] right-7 z-[2] w-[70px]" />}
        <section className="court relative overflow-hidden rounded-[28px] px-4 pb-4 pt-3.5" data-testid="pass-hero">
          <span className="snow" aria-hidden />
          <span className="snow slow" aria-hidden />
          <span className="blob hero-drift -right-16 -top-20 h-56 w-56 bg-[radial-gradient(circle,rgb(255_255_255/0.28),transparent_68%)]" aria-hidden />
          {natale && (
            <>
              <span className="neve-tetto" aria-hidden />
              <Lucine className="absolute inset-x-3 top-[9px]" perFestone={3} />
            </>
          )}
          <div className={clsx("relative flex items-center gap-3.5", natale && "mt-8")}>
            <Tabellone n={level} size={78} state="hero" natale={natale} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-white/80">
                  {level < LEVELS ? (
                    <>
                      Livello <span className="text-white">{level}</span> di {LEVELS}
                    </>
                  ) : (
                    "Pass completato"
                  )}
                </p>
                <SpicchiChip prog={prog} />
              </div>
              {level < LEVELS ? (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="relative h-[22px] flex-1 overflow-hidden rounded-full bg-black/25" aria-label={`${prog.bar} punti su ${POINTS_PER_LEVEL}`}>
                    <span className="bar-in absolute inset-y-0 left-0 rounded-full bg-volt" style={{ width: `${Math.max(6, (prog.bar / POINTS_PER_LEVEL) * 100)}%` }} />
                    <span className="num absolute inset-0 grid place-items-center text-[12.5px] text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.45)]">
                      {prog.bar}/{POINTS_PER_LEVEL}
                    </span>
                  </div>
                  {next && <RewardThumb lv={next} preset={v.preset} />}
                </div>
              ) : (
                <p className="mt-1 text-[13px] font-semibold text-white/85">Ogni {POINTS_PER_LEVEL} punti in più diventano Spicchi</p>
              )}
              <p className="mt-1.5 text-[12px] text-white/70">
                {POINTS_PER_MATCH} punti a partita
                {pending.length > 0 ? " · boost acceso: doppi" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => setBoostSheet(true)}
            className="press relative mt-3.5 flex w-full items-center gap-3 rounded-[18px] bg-white/15 px-3 py-2 text-left backdrop-blur-md"
            data-testid="boost-row"
          >
            <span className="flex gap-1.5" aria-label={`${st.boosts} boost su ${MAX_BOOSTS}`}>
              {Array.from({ length: MAX_BOOSTS }, (_, i) => (
                <span
                  key={i}
                  data-testid={`boost-slot-${i}`}
                  className={clsx(
                    "grid h-8 w-8 place-items-center rounded-full",
                    i < st.boosts ? "sticker-sm bg-volt text-volt-ink" : "border-2 border-dashed border-white/35 text-white/35",
                  )}
                >
                  <BoostIcon size={15} />
                </span>
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">Boost</span>
              <span className="block truncate text-[12px] text-white/75">
                {pending.length ? "Acceso: la prossima giornata vale doppio" : st.boosts ? "Tocca per accenderlo" : "Si vincono nel pass"}
              </span>
            </span>
            {pending.length > 0 ? (
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-volt" aria-hidden />
            ) : (
              <IconChevronRight size={18} className="shrink-0 text-white/60" aria-hidden />
            )}
          </button>
          {natale && <span className="neve-terra" aria-hidden />}
        </section>
        </div>

        {/* Premi da prendere: un bottone solo, sempre in vista mentre scorri il percorso. */}
        {prog.toClaim.length > 0 && <span ref={stickSpy} className="block h-px" aria-hidden />}
        {prog.toClaim.length > 0 && (
          <div
            className={clsx(
              "sticky top-0 z-10 -mx-1 px-1 pb-3 pt-3 transition-colors duration-200",
              // Lo sfondo solo quando resta attaccato in cima: da fermo non fa una fascia sopra la grana della pagina.
              stuck && "bg-gradient-to-b from-bg via-bg to-transparent",
            )}
          >
            <button
              onClick={() => (prog.toClaim.length === 1 ? claim(PASS_LEVELS[prog.toClaim[0] - 1]) : claimAll())}
              data-testid="claim-all"
              className="press claim-cta sticker flex h-14 w-full items-center justify-center gap-2 rounded-full bg-volt text-[16px] font-bold text-volt-ink"
            >
              <IconGift size={21} aria-hidden />
              {prog.toClaim.length === 1 ? "Riscatta il premio" : `Riscatta ${prog.toClaim.length} premi`}
            </button>
          </div>
        )}

        {/* Il percorso: un livello per riga, sul binario. Il segnaposto "Sei qui" sta tra
            l'ultimo livello fatto e il prossimo, con le due sfide per salire. */}
        <section className={clsx("rise", prog.toClaim.length ? "mt-1" : "mt-6")} style={rise(1)}>
          <div className="mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
            <h2 className="title text-[17px]">Percorso</h2>
            <InfoTip label="Come si sale di livello" size={16}>
              Due strade, ne basta una: fai una delle due sfide del livello in una partita e sali subito, oppure accumula{" "}
              {POINTS_PER_LEVEL} punti giocando ({POINTS_PER_MATCH} a partita). Una partita chiude al massimo una sfida, e i punti in
              più passano al livello dopo
            </InfoTip>
          </div>
          <ol className={clsx("road relative", natale && "natale")} data-testid="pass-track">
            {collapse && (
              <li className="road-row relative flex items-center gap-3 py-1.5" data-rail="done">
                <Tabellone n={doneUpTo} state="done" natale={natale} />
                <button
                  onClick={() => setShowDone(true)}
                  className="press flex flex-1 items-center justify-between rounded-[20px] bg-surface px-4 py-3 text-left shadow-[var(--shadow)]"
                >
                  <span>
                    <span className="block text-[14.5px] font-semibold">Livelli 1–{doneUpTo}</span>
                    <span className="text-[12.5px] text-muted">Tutto riscattato</span>
                  </span>
                  <IconChevronDown size={18} className="text-muted" />
                </button>
              </li>
            )}
            {PASS_LEVELS.filter((l) => !collapse || l.n > doneUpTo).map((l) => (
              <Fragment key={l.n}>
                {next && l.n === next.n && (
                  <YouAreHere
                    level={level}
                    next={next}
                    bar={prog.bar}
                    preset={v.preset}
                    outfit={v.outfit}
                  />
                )}
                <LevelRow
                  lv={l}
                  natale={natale}
                  lively={l.n === prog.toClaim[0]}
                  state={claimed.has(l.n) ? "claimed" : l.n <= level ? "ready" : "locked"}
                  preset={v.preset}
                  pop={justClaimed === l.n}
                  onClaim={() => claim(l)}
                />
              </Fragment>
            ))}
          </ol>
        </section>

        {/* Le giornate: lo spogliatoio di ognuna */}
        {prog.giornate.length > 0 && (
          <section className="rise mt-7" style={rise(3)}>
            <h2 className="title mb-2.5 px-1 text-[17px]">Spogliatoio</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {prog.giornate.map((g) => {
                const fresh = !st.lockerSeen.includes(g.day);
                return (
                  <Link
                    key={g.day}
                    href={`/spogliatoio?giorno=${g.day}`}
                    className="press flex items-center gap-3 px-4 py-3"
                    data-testid="giornata"
                  >
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-court text-court-ink">
                      <span className="num text-[16px]">{new Date(`${g.day}T12:00:00`).getDate()}</span>
                      {fresh && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-danger" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold first-letter:uppercase">{dayLabel(g.day)}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {g.matches.length} {g.matches.length === 1 ? "partita" : "partite"} · +{g.points} punti
                        {g.ups.length ? ` · ${g.ups.length} ${g.ups.length === 1 ? "livello" : "livelli"}` : ""}
                      </span>
                    </span>
                    <IconChevronRight size={18} className="shrink-0 text-faint" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <button
          onClick={() => {
            if (window.confirm("Ricominci la prova del pass da capo? Livelli riscattati, oggetti e Spicchi spesi tornano a zero")) {
              resetPass(playerId);
              toast("Prova ricominciata da capo");
            }
          }}
          className="press mx-auto mt-8 block rounded-full px-4 py-2 text-[12.5px] font-semibold text-faint"
        >
          Ricomincia la prova da capo
        </button>
      </div>

      <BoostSheet
        open={boostSheet}
        onOpenChange={setBoostSheet}
        boosts={st.boosts}
        pending={pending.length > 0}
        onActivate={() => {
          activateBoost(playerId);
          play("unlock");
          haptic([10, 30, 10]);
          setBoostSheet(false);
          toast("Boost acceso: la prossima giornata vale doppio");
        }}
      />
      <BoostFullSheet
        level={boostFull}
        onClose={() => setBoostFull(null)}
        onKeep={() => {
          if (boostFull) keepBoostForLater(playerId, boostFull.n);
          setBoostFull(null);
          toast("Lo trovi qui quando liberi un posto");
        }}
        onSwap={() => {
          if (!boostFull) return;
          const res = swapBoost(playerId, boostFull.n, SWAP_ODDS, prog.owned);
          const n = boostFull.n;
          setBoostFull(null);
          setJustClaimed(n);
          setReveal({ item: res.item, kicker: "Scambio del boost", refund: res.duplicate ? duplicateRefund(res.item.rarity) : undefined });
        }}
      />
      <Sheet
        open={!!haul}
        onOpenChange={(o) => !o && setHaul(null)}
        title="Premi riscattati"
        description={haul?.left ? `${haul.left === 1 ? "Un boost resta" : `${haul.left} boost restano`} nel pass: i posti sono pieni` : undefined}
        footer={
          haul?.items.length ? (
            <Link href="/camerino" className="press sticker flex h-12 w-full items-center justify-center rounded-full bg-ball text-[15px] font-semibold text-ball-ink">
              Provali nel camerino
            </Link>
          ) : (
            <Button block onClick={() => setHaul(null)}>
              Fatto
            </Button>
          )
        }
      >
        {haul && (
          <div data-testid="haul">
            <div className="flex justify-center gap-3 pb-1 pt-1">
              {haul.spicchi > 0 && (
                <span className="pop-in inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3.5 py-2 text-[15px] font-bold">
                  <SpicchioIcon size={20} /> +{haul.spicchi}
                </span>
              )}
              {haul.boosts > 0 && (
                <span className="pop-in inline-flex items-center gap-1.5 rounded-full bg-court px-3.5 py-2 text-[15px] font-bold text-court-ink [animation-delay:80ms]">
                  <BoostIcon size={18} className="text-volt" /> {haul.boosts} boost
                </span>
              )}
            </div>
            {haul.items.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-x-2.5 gap-y-3">
                {haul.items.map((it, i) => (
                  <div key={it.id} className="pop-in min-w-0" style={{ animationDelay: `${120 + i * 70}ms` }}>
                    <span className={clsx("relative block aspect-square overflow-hidden rounded-[20px]", `rar-${it.rarity}`, it.rarity === "leggendario" && "shine")}>
                      <ItemPhoto item={it} preset={v.preset} size={192} className="absolute inset-0" />
                    </span>
                    <span className="mt-1.5 block truncate px-0.5 text-[12.5px] font-semibold">{it.name}</span>
                    <span className="block truncate px-0.5 text-[11.5px] text-muted">{RARITY_LABEL[it.rarity]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>

      {reveal && (
        <RewardReveal
          item={reveal.item}
          kicker={reveal.kicker}
          refund={reveal.refund}
          preset={v.preset}
          outfit={v.outfit}
          number={v.number}
          owned
          onClose={() => setReveal(null)}
          onEquip={() => {
            equip(playerId, reveal.item.slot, reveal.item.id);
            setReveal(null);
            toast(`${reveal.item.name} addosso`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Il tabellone del livello sul binario: tabellone col quadrato di tiro (il numero ci sta dentro),
 * ferro arancione e retina. Al posto dei gradini del Pass Royale, ma da campetto.
 */
function Tabellone({
  n,
  state,
  size = 46,
  glow,
  natale,
}: {
  n: number;
  state: "hero" | "done" | "ready" | "locked";
  size?: number;
  glow?: boolean;
  /** Neve sopra (e il cappello di Babbo Natale su quello della testata). */
  natale?: boolean;
}) {
  const locked = state === "locked";
  const ink = "#1d1a16";
  const board = locked ? "var(--bg)" : state === "hero" ? "#fffaf0" : "var(--volt)";
  const edge = locked ? "var(--line-strong)" : ink;
  const square = locked ? "var(--line-strong)" : state === "hero" ? "#F26A1B" : "rgb(29 26 22 / 0.4)";
  const rim = locked ? "var(--line-strong)" : "#F26A1B";
  const net = state === "hero" ? "rgb(255 255 255 / 0.85)" : locked ? "var(--line-strong)" : "var(--muted)";
  return (
    <span
      className={clsx("relative z-[1] block shrink-0", state === "ready" && glow && "claim-glow rounded-[12px]", state === "hero" && "tab-3d")}
      style={{ width: size, height: size }}
      aria-label={`Livello ${n}`}
    >
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full drop-shadow-[0_3px_4px_rgb(29_26_22/0.22)]" aria-hidden>
        {/* retina */}
        <path d="M15 35.5 18.5 46.5M33 35.5 29.5 46.5M19.5 35.5 21.5 46.5M28.5 35.5 26.5 46.5M24 35.5V46.5M16.3 40H31.7M18 44.5H30" fill="none" stroke={net} strokeWidth={1.3} strokeLinecap="round" />
        {/* tabellone */}
        <rect x="2" y="2" width="44" height="31" rx="7" fill={board} stroke={edge} strokeWidth={state === "hero" ? 2.8 : 2.4} />
        {!locked && state !== "hero" && <rect x="5.5" y="5" width="37" height="7" rx="3.5" fill="#fff" opacity={0.3} />}
        {/* quadrato di tiro */}
        <rect x="12" y="8" width="24" height="20" rx="3" fill="none" stroke={square} strokeWidth={2} />
        {natale && (
          <path
            d="M5 7.6C3.6 3.6 6.6 1.2 11.6 1.3c3-1.3 7-.9 10.2-.4 4-1.3 9-.6 12 0 4-.9 8.6-.2 10.6 2.6 1.3 1.9.4 4.1-1.4 4.2-1.3 1.5-3.9 1.5-5 .1-2.6.6-5 .3-6.3-.3-3 .7-6.3.5-8.2 0-2 1.8-5.2 1.9-6.5-.1-3.4.6-7.4.4-9-.2-1.5 1.1-3.8 1-4.9.4Z"
            fill="#fff"
            stroke={locked ? "var(--line-strong)" : ink}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        )}
        {/* ferro */}
        <path d="M24 33v2.2" stroke={edge} strokeWidth={2.4} />
        <path d="M13.5 35.6h21" stroke={rim} strokeWidth={3.4} strokeLinecap="round" />
      </svg>
      <span
        className={clsx("num absolute inset-x-0 text-center leading-none", locked ? "text-faint" : "text-[#1d1a16]")}
        style={{ top: size * 0.375, transform: "translateY(-50%)", fontSize: Math.round(size * (n >= 10 ? 0.3 : 0.34)) }}
      >
        {n}
      </span>
      {natale && state === "hero" && <CappelloBabbo className="absolute -left-[13%] -top-[19%] w-[50%] -rotate-[22deg]" />}
    </span>
  );
}

/** Il prossimo premio, piccolo, in fondo alla barra della testata. */
function RewardThumb({ lv, preset }: { lv: Level; preset: Preset }) {
  const item = lv.reward.kind === "item" ? ITEM_BY_ID.get(lv.reward.id) : undefined;
  return (
    <span
      className={clsx(
        "relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[13px] border-2 border-white/70",
        item ? `rar-${item.rarity}` : lv.reward.kind === "boost" ? "bg-court" : "bg-gold-soft",
      )}
      aria-label={`Prossimo premio: ${rewardLabel(lv.reward, item)}`}
    >
      {item ? (
        <ItemPhoto item={item} preset={preset} size={88} persist className="absolute inset-0" />
      ) : lv.reward.kind === "boost" ? (
        <BoostIcon size={20} className="text-volt" />
      ) : (
        <SpicchioIcon size={22} />
      )}
    </span>
  );
}

/**
 * "Sei qui": il tuo personaggio sul binario tra l'ultimo livello fatto e il prossimo, con le
 * due sfide per salire e i punti che mancano. Il percorso si apre già qui.
 */
function YouAreHere({
  level,
  next,
  bar,
  preset,
  outfit,
}: {
  level: number;
  next: Level;
  bar: number;
  preset: Preset;
  outfit: Outfit;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    // All'apertura il percorso scorre fino a qui (se non ci sono premi da prendere più su).
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (el && !document.querySelector("[data-claimable]")) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 450);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <li ref={ref} className="road-row relative flex items-start gap-3 py-2" data-rail="here" id="sei-qui" data-testid="you-are-here">
      <span className="relative z-[1] mt-1 grid h-[46px] w-[46px] shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-volt bg-court shadow-[0_0_0_4px_rgb(255_197_49/0.3)]">
        <Photo preset={preset} outfit={outfit} framing="testa" size={96} persist className="absolute inset-0 scale-[1.35]" alt="Tu" />
      </span>
      <div className="card min-w-0 flex-1 overflow-hidden ring-2 ring-volt" data-testid="next-challenges">
        <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
          <p className="title text-[16px]">Sei qui</p>
          <span className="rounded-full bg-volt px-2.5 py-0.5 text-[12px] font-bold text-volt-ink">
            {level ? `Livello ${level} → ${next.n}` : `Verso il livello ${next.n}`}
          </span>
        </div>
        <p className="px-4 text-[12.5px] text-muted">Per salire fai una di queste in una partita</p>
        <div className="mt-1.5">
          {next.sfide.map((c, i) => (
            <div key={c.label} className={clsx("flex items-center gap-3 px-4 py-2", i === 1 && "border-t border-line")}>
              <span
                className={clsx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold",
                  i === 0 ? "bg-ball-soft text-ball" : "bg-court-soft text-court",
                )}
                aria-hidden
              >
                {i === 0 ? "A" : "B"}
              </span>
              <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2.5 border-t border-line bg-raised/50 px-4 py-2.5">
          <span className="shrink-0 text-[12.5px] text-muted">oppure gioca</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-volt" style={{ width: `${(bar / POINTS_PER_LEVEL) * 100}%` }} />
          </span>
          <span className="shrink-0 text-[12.5px] text-muted">
            mancano <span className="num text-[14px] text-text">{POINTS_PER_LEVEL - bar}</span> punti
          </span>
        </div>
      </div>
    </li>
  );
}

function LevelRow({
  lv,
  natale,
  state,
  lively,
  preset,
  pop,
  onClaim,
}: {
  lv: Level;
  natale?: boolean;
  /** Il primo premio da prendere: solo lui si muove (con tanti premi insieme sui telefoni lenti scatterebbe). */
  lively?: boolean;
  state: "claimed" | "ready" | "locked";
  preset: Preset;
  pop: boolean;
  onClaim: () => void;
}) {
  const big = CARDINE.includes(lv.n);
  const item = lv.reward.kind === "item" ? ITEM_BY_ID.get(lv.reward.id) : undefined;
  const rarity: Rarity | null = item?.rarity ?? null;
  const sub = item
    ? `${RARITY_LABEL[item.rarity]}${item.esclusivo ? " · solo nel pass" : ""}`
    : lv.reward.kind === "boost"
      ? "Punti doppi per un giorno"
      : "Da spendere alla bancarella";
  return (
    <li
      id={`lv-${lv.n}`}
      className="road-row relative flex items-center gap-3 py-1.5"
      data-rail={state === "locked" ? "todo" : "done"}
      data-testid={`level-${lv.n}`}
      {...(state === "ready" ? { "data-claimable": "" } : {})}
    >
      <Tabellone n={lv.n} state={state === "claimed" ? "done" : state} glow={lively} natale={natale} />
      <div
        className={clsx(
          "relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-[22px] p-2 pr-3",
          big ? "road-big court text-white" : "bg-surface shadow-[var(--shadow)]",
          state === "ready" && "ring-2 ring-volt",
          state === "locked" && !big && "opacity-85",
        )}
      >
        {/* I premi speciali a Natale sono regali: neve sopra e il fiocco rosso. */}
        {big && natale && (
          <>
            <span className="neve-tetto small" aria-hidden />
            <Fiocco className="absolute left-[76px] top-[3px] z-[2] w-[30px] rotate-[14deg]" />
          </>
        )}
        <span
          className={clsx(
            "relative grid shrink-0 place-items-center overflow-hidden text-white",
            big ? "h-[92px] w-[92px] rounded-[18px]" : "h-[62px] w-[62px] rounded-[16px]",
            rarity ? `rar-${rarity}` : lv.reward.kind === "boost" ? "bg-court" : "bg-gold-soft",
            big && "border-2 border-white/60",
            rarity === "leggendario" && "shine",
            pop && "pop-in",
          )}
        >
          {item ? (
            <ItemPhoto item={item} preset={preset} size={big ? 184 : 124} persist className="absolute inset-0" />
          ) : lv.reward.kind === "boost" ? (
            <BoostIcon size={big ? 38 : 27} className="text-volt" />
          ) : (
            <span className="flex flex-col items-center">
              <SpicchioIcon size={big ? 36 : 26} />
              <span className="num mt-0.5 text-[13px] text-[#7a4a12] dark:text-gold">{lv.reward.kind === "spicchi" ? lv.reward.amount : null}</span>
            </span>
          )}
          {state === "locked" && (
            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/40" aria-hidden>
              <IconLock size={11} />
            </span>
          )}
        </span>
        <span className="relative flex min-w-0 flex-1 flex-col items-start">
          {big && (
            <span className="mb-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
              <IconSnowflake size={12} aria-hidden /> Speciale
            </span>
          )}
          <span className={clsx("line-clamp-2 font-semibold leading-tight", big ? "text-[16px]" : "text-[14.5px]")}>{rewardLabel(lv.reward, item)}</span>
          <span className={clsx("mt-0.5 line-clamp-1 text-[12.5px]", big ? "text-white/75" : "text-muted")}>{sub}</span>
          {/* Il bottone sotto al nome, come "Riscuoti" sotto ai premi: il nome resta intero. */}
          {state === "ready" && (
            <Button size="sm" variant="primary" onClick={onClaim} data-testid={`claim-${lv.n}`} sound={false} className={clsx("mt-1.5 !h-8 !px-3.5 !text-[13.5px]", lively && "claim-bob")}>
              Riscatta
            </Button>
          )}
        </span>
        {state === "ready" ? null : state === "claimed" ? (
          <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ok text-white" aria-label="Riscattato">
            <IconCheck size={17} strokeWidth={3} />
          </span>
        ) : (
          <span className={clsx("relative grid h-8 w-8 shrink-0 place-items-center rounded-full", big ? "bg-white/15 text-white/70" : "bg-raised text-faint")} aria-label="Da raggiungere">
            <IconLock size={15} />
          </span>
        )}
      </div>
    </li>
  );
}

function BoostSheet({
  open,
  onOpenChange,
  boosts,
  pending,
  onActivate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  boosts: number;
  pending: boolean;
  onActivate: () => void;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Boost"
      description={`Raddoppia i punti della prossima giornata che giochi: ${POINTS_PER_MATCH * 2} a partita invece di ${POINTS_PER_MATCH}`}
      footer={
        <Button variant="court" block disabled={!boosts || pending} onClick={onActivate} data-testid="boost-activate">
          {pending ? "Ne hai già uno acceso" : boosts ? "Accendi un boost" : "Non hai boost"}
        </Button>
      }
    >
      <div className="flex justify-center gap-3 py-4">
        {Array.from({ length: MAX_BOOSTS }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "grid h-16 w-16 place-items-center rounded-full",
              i < boosts ? "sticker bg-volt text-volt-ink" : "border-2 border-dashed border-line-strong text-line-strong",
            )}
          >
            <BoostIcon size={30} />
          </span>
        ))}
      </div>
      <p className="px-2 pb-2 text-center text-[13.5px] text-muted">
        Accendilo prima di andare al campetto: vale per tutte le partite di quel giorno. Ne tieni al massimo {MAX_BOOSTS}
      </p>
    </Sheet>
  );
}

function BoostFullSheet({
  level,
  onClose,
  onKeep,
  onSwap,
}: {
  level: Level | null;
  onClose: () => void;
  onKeep: () => void;
  onSwap: () => void;
}) {
  return (
    <Sheet
      open={!!level}
      onOpenChange={(o) => !o && onClose()}
      title="Hai già 3 boost"
      description="Il quarto non entra: scambialo con un oggetto a sorpresa o tienilo qui per dopo"
      footer={
        <div className="flex gap-2">
          <Button block onClick={onKeep}>
            Tienilo
          </Button>
          <Button block variant="primary" onClick={onSwap} data-testid="boost-swap">
            Scambia
          </Button>
        </div>
      }
    >
      <p className="mb-2 px-1 text-[13px] font-semibold text-muted">Cosa può uscire</p>
      <div className="grid grid-cols-4 gap-2 pb-2">
        {(Object.keys(SWAP_ODDS) as Rarity[]).map((r) => (
          <div key={r} className={clsx("rounded-[16px] px-2 py-2.5 text-center text-white", `rar-${r}`)}>
            <p className="num text-[18px]">{SWAP_ODDS[r]}%</p>
            <p className="mt-0.5 text-[11px] font-semibold opacity-85">{RARITY_LABEL[r]}</p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
