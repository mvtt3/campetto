"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconHanger,
  IconLock,
  IconSnowflake,
} from "@tabler/icons-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { Preset } from "@/components/c3d/build";
import { Button, CountUp, ScreenHeader, haptic } from "@/components/ui/basics";
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

  useEffect(() => {
    if (v.playerId && !v.allowed) router.replace("/");
  }, [v.playerId, v.allowed, router]);

  if (!prog || !playerId) return null;
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
    <>
      <ScreenHeader
        title="Pass Campetto"
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
      <div className="scroll-area min-h-0 flex-1 px-5 pb-10 pt-2">
        {/* La season: livello, barra, giorni, Spicchi, boost */}
        <section className="rise court relative overflow-hidden rounded-[28px] px-5 pb-5 pt-4" style={rise(0)} data-testid="pass-hero">
          <span className="snow" aria-hidden />
          <span className="snow slow" aria-hidden />
          <span className="blob hero-drift -right-16 -top-20 h-56 w-56 bg-[radial-gradient(circle,rgb(255_255_255/0.28),transparent_68%)]" aria-hidden />
          <div className="relative flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-semibold">
              <IconSnowflake size={14} aria-hidden /> Season di {prog.season.name}
            </p>
            <SpicchiChip prog={prog} />
          </div>
          <div className="relative mt-4 flex items-end gap-3">
            <p className="score text-[72px]" aria-label={`Livello ${level}`}>
              <CountUp value={level} />
            </p>
            <div className="mb-2 text-[13px] font-medium leading-tight text-white/80">
              livello
              <br />
              <span className="text-white/60">su {LEVELS}</span>
            </div>
            <p className="mb-2 ml-auto rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-semibold">
              {prog.daysLeft === 1 ? "Ultimo giorno" : `${prog.daysLeft} giorni`}
            </p>
          </div>
          {level < LEVELS ? (
            <>
              <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-white/20" aria-hidden>
                <span className="bar-in absolute inset-y-0 left-0 rounded-full bg-volt" style={{ width: `${(prog.bar / POINTS_PER_LEVEL) * 100}%` }} />
              </div>
              <p className="relative mt-1.5 flex justify-between text-[12px] font-semibold text-white/75">
                <span>
                  {prog.bar}/{POINTS_PER_LEVEL} punti
                </span>
                <span>Livello {level + 1}</span>
              </p>
            </>
          ) : (
            <p className="relative mt-2 text-[13.5px] font-semibold text-white/85">
              Pass completato. Ogni {POINTS_PER_LEVEL} punti in più diventano Spicchi
            </p>
          )}
          <div className="relative mt-4 flex items-center gap-3 rounded-[18px] border border-white/15 bg-white/15 px-3 py-2.5 backdrop-blur-md">
            <div className="flex gap-1.5" aria-label={`${st.boosts} boost su ${MAX_BOOSTS}`}>
              {Array.from({ length: MAX_BOOSTS }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setBoostSheet(true)}
                  data-testid={`boost-slot-${i}`}
                  className={clsx(
                    "press grid h-10 w-10 place-items-center rounded-full",
                    i < st.boosts ? "sticker-sm bg-volt text-volt-ink" : "border-2 border-dashed border-white/35 text-white/35",
                  )}
                >
                  <BoostIcon size={19} />
                </button>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[13.5px] font-semibold">
                Boost
                <InfoTip label="Cosa fa il boost" size={13}>
                  Raddoppia i punti di tutta la prossima giornata che giochi: ogni partita vale {POINTS_PER_MATCH * 2} invece di{" "}
                  {POINTS_PER_MATCH}. Ne tieni al massimo {MAX_BOOSTS}
                </InfoTip>
              </p>
              <p className="truncate text-[12px] text-white/75">
                {pending.length ? "Acceso: vale per la prossima giornata" : st.boosts ? "Tocca per accenderlo" : "Si vincono nel pass"}
              </p>
            </div>
            {pending.length > 0 && <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-volt" aria-hidden />}
          </div>
        </section>

        {/* Il prossimo livello: due sfide, oppure i punti */}
        {next && (
          <section className="rise mt-6" style={rise(1)}>
            <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
              <h2 className="title text-[17px]">Per il livello {next.n}</h2>
              <InfoTip label="Come si sale di livello" size={16}>
                Due strade, ne basta una: fai una delle due sfide in una partita e sali subito, oppure accumula{" "}
                {POINTS_PER_LEVEL} punti giocando ({POINTS_PER_MATCH} a partita). Una partita chiude al massimo una sfida, e i
                punti in più passano al livello dopo
              </InfoTip>
            </div>
            <div className="card overflow-hidden" data-testid="next-challenges">
              {next.sfide.map((s, i) => (
                <div key={s.label}>
                  {i === 1 && (
                    <div className="relative flex items-center px-4" aria-hidden>
                      <span className="h-px flex-1 bg-line" />
                      <span className="mx-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">oppure</span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <span
                      className={clsx(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[15px] font-bold",
                        i === 0 ? "bg-ball-soft text-ball" : "bg-court-soft text-court",
                      )}
                      aria-hidden
                    >
                      {i === 0 ? "A" : "B"}
                    </span>
                    <p className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">{s.label}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-2 border-t border-line bg-raised/50 px-4 py-2.5 text-[12.5px] text-muted">
                <span>Oppure gioca: mancano</span>
                <span className="num text-[14px] text-text">{POINTS_PER_LEVEL - prog.bar}</span>
                <span>punti</span>
              </div>
            </div>
          </section>
        )}

        {/* I premi */}
        <section className="rise mt-7" style={rise(2)}>
          <div className="mb-2.5 flex min-h-8 items-center justify-between gap-3 px-1">
            <h2 className="title text-[17px]">Premi</h2>
            {prog.toClaim.length > 1 && (
              <button
                onClick={claimAll}
                data-testid="claim-all"
                className="press sticker-sm rounded-full bg-volt px-3.5 py-1.5 text-[13px] font-bold text-volt-ink"
              >
                Riscatta tutto · {prog.toClaim.length}
              </button>
            )}
          </div>
          <ol className="relative" data-testid="pass-track">
            <span className="absolute bottom-6 left-[19px] top-6 w-[3px] rounded-full bg-line" aria-hidden />
            <span
              className="absolute left-[19px] top-6 w-[3px] rounded-full bg-volt transition-[height] duration-700"
              style={{ height: `calc(${(Math.min(level, LEVELS - 0.5) / LEVELS) * 100}% - 24px)` }}
              aria-hidden
            />
            {collapse && (
              <li className="relative flex items-center gap-3 py-2">
                <Node n={doneUpTo} state="done" />
                <button
                  onClick={() => setShowDone(true)}
                  className="press flex flex-1 items-center justify-between rounded-[18px] bg-surface px-4 py-3 text-left shadow-[var(--shadow)]"
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
              <LevelRow
                key={l.n}
                lv={l}
                state={claimed.has(l.n) ? "claimed" : l.n <= level ? "ready" : l.n === level + 1 ? "next" : "locked"}
                preset={v.preset}
                pop={justClaimed === l.n}
                onClaim={() => claim(l)}
              />
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
    </>
  );
}

function Node({ n, state }: { n: number; state: "done" | "ready" | "next" | "locked" }) {
  return (
    <span
      className={clsx(
        "relative z-[1] grid h-10 w-10 shrink-0 place-items-center rounded-full text-[14px] font-bold",
        state === "done" && "bg-volt text-volt-ink",
        state === "ready" && "claim-glow bg-volt text-volt-ink",
        state === "next" && "border-[3px] border-volt bg-surface text-text",
        state === "locked" && "border-2 border-line bg-bg text-faint",
      )}
    >
      {state === "done" ? <IconCheck size={18} strokeWidth={3} /> : n}
    </span>
  );
}

function LevelRow({
  lv,
  state,
  preset,
  pop,
  onClaim,
}: {
  lv: Level;
  state: "claimed" | "ready" | "next" | "locked";
  preset: Preset;
  pop: boolean;
  onClaim: () => void;
}) {
  const big = CARDINE.includes(lv.n);
  const item = lv.reward.kind === "item" ? ITEM_BY_ID.get(lv.reward.id) : undefined;
  const rarity: Rarity | null = item?.rarity ?? null;
  const tile = big ? "h-[104px] w-[104px] rounded-[24px]" : "h-14 w-14 rounded-[16px]";
  const sub = item
    ? `${RARITY_LABEL[item.rarity]}${item.esclusivo ? " · solo nel pass" : ""}`
    : lv.reward.kind === "boost"
      ? "Punti doppi per un giorno"
      : "Da spendere alla bancarella";
  const action =
    state === "ready" ? (
      <Button size="sm" variant="primary" onClick={onClaim} data-testid={`claim-${lv.n}`} sound={false} className={big ? "mt-2.5 self-start" : "shrink-0 !px-3.5"}>
        Riscatta
      </Button>
    ) : state === "claimed" ? (
      <IconCheck size={20} className={clsx("shrink-0 text-ok", big && "mt-2")} aria-label="Riscattato" />
    ) : null;
  return (
    <li id={`lv-${lv.n}`} className={clsx("relative flex items-center gap-3", big ? "py-3" : "py-1.5")} data-testid={`level-${lv.n}`}>
      <Node n={lv.n} state={state === "claimed" ? "done" : state} />
      <div
        className={clsx(
          "flex min-w-0 flex-1 items-center gap-3 rounded-[24px]",
          big ? "bg-surface p-2 pr-3 shadow-[var(--shadow)]" : "py-0.5",
          state === "locked" && "opacity-75",
        )}
      >
        <span
          className={clsx(
            "relative grid shrink-0 place-items-center overflow-hidden text-white",
            tile,
            rarity ? `rar-${rarity}` : lv.reward.kind === "boost" ? "bg-court" : "bg-gold-soft",
            rarity === "leggendario" && "shine",
            pop && "pop-in",
          )}
        >
          {item ? (
            <ItemPhoto item={item} preset={preset} size={big ? 208 : 112} persist className="absolute inset-0" />
          ) : lv.reward.kind === "boost" ? (
            <BoostIcon size={big ? 40 : 26} className="text-volt" />
          ) : (
            <SpicchioIcon size={big ? 44 : 30} />
          )}
          {item?.esclusivo && (
            <span className="absolute left-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/25 backdrop-blur-sm" aria-label="Esclusivo di Natale">
              <IconSnowflake size={12} />
            </span>
          )}
          {state === "locked" && (
            <span className="absolute bottom-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-black/35" aria-hidden>
              <IconLock size={11} />
            </span>
          )}
        </span>
        <span className={clsx("flex min-w-0 flex-1 flex-col", big && "items-start")}>
          <span className={clsx("line-clamp-2 font-semibold leading-tight", big ? "text-[16.5px]" : "text-[14.5px]")}>{rewardLabel(lv.reward, item)}</span>
          <span className="mt-0.5 line-clamp-1 text-[12.5px] text-muted">{sub}</span>
          {big && action}
        </span>
        {!big && action}
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
