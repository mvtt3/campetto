"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import { useData } from "@/lib/data/provider";
import type { BadgeCategory, BadgeState } from "@/lib/badges";
import { BadgeMedal, BadgeTile, TIER_STYLE } from "./badge-medal";
import { Button, Segmented, haptic } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { say } from "@/lib/voice";
import { play, playAt } from "@/lib/sound";
import { useNewRewards } from "./rewards";

const TIERS = [1, 2, 3, 4, 5] as const;

const CATS: { value: BadgeCategory | "tutti"; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "carriera", label: "Carriera" },
  { value: "partita", label: "Partita" },
  { value: "speciali", label: "Speciali" },
];

export function BadgeCollection({
  playerId,
  editable,
}: {
  playerId: string;
  editable?: boolean;
}) {
  const { engine, data, backend, mutate } = useData();
  const toast = useToast();
  const player = data.players.find((p) => p.id === playerId);
  const states = engine.badges(playerId).states;
  const [cat, setCat] = useState<BadgeCategory | "tutti">("tutti");
  const [open, setOpen] = useState<BadgeState | null>(null);
  const showcase = player?.showcase ?? [];
  const unlocked = states.filter((s) => s.tier > 0).length;
  const tierCount = [0, 0, 0, 0, 0, 0];
  for (const s of states) tierCount[s.tier]++;

  const progress = (s: BadgeState) => (s.next ? s.value / s.next : 1);
  // Nella propria collezione, i badge appena guadagnati stanno in cima con "Nuovo" finché non li apri.
  const rewards = useNewRewards();
  const fresh = editable ? rewards.badges : new Set<string>();
  const [claimed, setClaimed] = useState<string | null>(null);
  // "Riscatta tutti": i nuovi si aprono uno dopo l'altro (done), restando al loro posto in cima
  // (pinned) finché non cambi categoria o pagina: niente caselle che saltano mentre si accendono.
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [phase, setPhase] = useState<"idle" | "claiming" | "done">("idle");
  const [batch, setBatch] = useState<BadgeState[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const top = (s: BadgeState) => fresh.has(s.def.key) || pinned.has(s.def.key);
  const list = states
    .filter((s) => cat === "tutti" || s.def.category === cat)
    .sort(
      (a, b) =>
        Number(top(b)) - Number(top(a)) ||
        b.tier - a.tier ||
        progress(b) - progress(a),
    );

  const claimAll = () => {
    if (phase !== "idle" || !fresh.size) return;
    // Prima quelli che si vedono (nell'ordine della griglia), poi gli altri delle altre categorie.
    const shown = list.filter((s) => fresh.has(s.def.key));
    const rest = states.filter(
      (s) => fresh.has(s.def.key) && !shown.includes(s),
    );
    const all = [...shown, ...rest];
    const keys = all.map((s) => s.def.key);
    setBatch(all);
    setPinned(new Set(keys));
    setDone(new Set());
    setPhase("claiming");
    haptic(10);
    play("unlock");
    const still =
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Una cascata breve anche con tanti badge: al massimo un secondo e mezzo.
    const step = still ? 0 : Math.min(120, 1500 / Math.max(1, shown.length));
    shown.forEach((st, i) => {
      const at = 180 + i * step;
      playAt("tick", at / 1000);
      timers.current.push(
        window.setTimeout(() => {
          setDone((d) => new Set(d).add(st.def.key));
          haptic(6);
        }, at),
      );
    });
    const end = 180 + shown.length * step + 380;
    timers.current.push(
      window.setTimeout(() => {
        setDone(new Set(keys));
        rewards.claimBadges(keys);
        setPhase("done");
        play("success");
        haptic([8, 40, 12]);
      }, end),
      window.setTimeout(() => setPhase("idle"), end + 2200),
    );
  };
  const openBadge = (s: BadgeState) => {
    if (fresh.has(s.def.key)) {
      // Riscattato: via l'etichetta, un piccolo salto e il suono dello sblocco.
      rewards.claimBadge(s.def.key);
      setClaimed(s.def.key);
      play("unlock");
    }
    setOpen(s);
  };

  const toggleShowcase = async (key: string) => {
    if (!player) return;
    let next = showcase.includes(key)
      ? showcase.filter((k) => k !== key)
      : [...showcase, key];
    if (next.length > 3) next = next.slice(-3);
    mutate((d) => ({
      ...d,
      players: d.players.map((p) =>
        p.id === player.id ? { ...p, showcase: next } : p,
      ),
    }));
    try {
      await backend.updateMe({ showcase: next });
      toast(
        showcase.includes(key)
          ? "L'ho tolto dalla vetrina"
          : "L'ho messo in vetrina",
      );
    } catch (e) {
      toast(say(e), "error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="m-3 rounded-[22px] bg-surface p-4 shadow-[var(--shadow)]">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
              Sbloccati
            </p>
            <p className="num mt-1 leading-none">
              <span className="text-[40px] text-ball">{unlocked}</span>
              <span className="text-[18px] text-faint"> / {states.length}</span>
            </p>
          </div>
          <div className="flex gap-1.5">
            {TIERS.map((t) => (
              <span
                key={t}
                className={clsx(
                  "flex flex-col items-center gap-1",
                  !tierCount[t] && "opacity-35",
                )}
                title={TIER_STYLE[t].label}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{
                    background: `linear-gradient(135deg, ${TIER_STYLE[t].a}, ${TIER_STYLE[t].b})`,
                  }}
                  aria-hidden
                />
                <span className="tnum text-[12px] font-bold">
                  <span className="sr-only">{TIER_STYLE[t].label} </span>
                  {tierCount[t]}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-ball"
            style={{ width: `${(unlocked / states.length) * 100}%` }}
          />
        </div>
        {editable && !fresh.size && phase === "idle" && (
          <p className="mt-2.5 text-[12.5px] text-muted">
            Tocca un badge per metterlo in vetrina
          </p>
        )}
      </div>
      {editable && (fresh.size > 0 || phase !== "idle") && (
        <ClaimBanner
          items={
            phase === "idle"
              ? [
                  ...list.filter((s) => fresh.has(s.def.key)),
                  ...states.filter(
                    (s) => fresh.has(s.def.key) && !list.includes(s),
                  ),
                ]
              : batch
          }
          phase={phase}
          opened={done.size}
          onClaim={claimAll}
        />
      )}
      <Segmented
        value={cat}
        onChange={(c) => {
          setCat(c);
          if (phase === "idle") setPinned(new Set());
        }}
        size="sm"
        options={CATS}
      />
      <div className="grid grid-cols-3 gap-2">
        {list.map((s) => (
          <BadgeTile
            key={s.def.key}
            state={s}
            selected={editable && showcase.includes(s.def.key)}
            fresh={fresh.has(s.def.key) && !done.has(s.def.key)}
            popped={claimed === s.def.key || done.has(s.def.key)}
            shine={done.has(s.def.key)}
            onClick={() => openBadge(s)}
          />
        ))}
      </div>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.def.name ?? ""}
        description={open?.def.description}
        footer={
          editable && open && open.tier > 0 ? (
            <Button
              variant={
                showcase.includes(open.def.key) ? "secondary" : "primary"
              }
              block
              onClick={() => {
                void toggleShowcase(open.def.key);
                setOpen(null);
              }}
            >
              {showcase.includes(open.def.key)
                ? "Togli dalla vetrina"
                : "Metti in vetrina"}
            </Button>
          ) : undefined
        }
      >
        {open && (
          <div className="flex flex-col items-center gap-4 pb-2">
            <BadgeMedal icon={open.def.icon} tier={open.tier} size={92} />
            <p className="text-[15px] font-semibold">
              {TIER_STYLE[open.tier].label}
            </p>
            <p className="tnum text-[14px] text-muted">
              {open.value} {open.def.unit}
              {open.next
                ? `, prossimo livello a ${open.next}`
                : ", livello massimo"}
            </p>
            <ol className="flex w-full justify-between gap-1">
              {open.def.thresholds.map((t, i) => (
                <li
                  key={t}
                  className="flex flex-1 flex-col items-center gap-1.5"
                >
                  <BadgeMedal
                    icon={open.def.icon}
                    tier={(open.tier > i ? i + 1 : 0) as 0 | 1 | 2 | 3 | 4 | 5}
                    size={34}
                  />
                  {/* Su una riga: "Hall of Fame" andava a capo e spostava il suo numero più in basso degli altri. */}
                  <span className="whitespace-nowrap text-[10.5px] tracking-tight text-muted">
                    {TIER_STYLE[(i + 1) as 1].label}
                  </span>
                  <span className="tnum text-[12px] font-semibold">{t}</span>
                </li>
              ))}
            </ol>
            {open.unlockedAt && (
              <p className="text-[12.5px] text-faint">
                Ultimo livello sbloccato il{" "}
                {new Date(open.unlockedAt).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

/**
 * In cima alla collezione quando ci sono badge nuovi: tre medaglie a ventaglio e "Riscatta tutti",
 * sul blu del campo con il vetro chiaro della Home. Mentre si aprono conta quanti ne mancano,
 * poi dice "fatto" e sparisce da solo.
 */
function ClaimBanner({
  items,
  phase,
  opened,
  onClaim,
}: {
  items: BadgeState[];
  phase: "idle" | "claiming" | "done";
  opened: number;
  onClaim: () => void;
}) {
  const n = items.length;
  if (!n) return null;
  const fan = items.slice(0, 3);
  const extra = n - fan.length;
  return (
    // Il contenitore si chiude in altezza dopo il "Fatto": la griglia sale piano, senza salti.
    <div
      className={clsx("claim-wrap", phase === "done" && "claim-wrap-closing")}
    >
      <div
        className={clsx("min-h-0 px-3", phase === "done" && "overflow-hidden")}
      >
        <section
          className={clsx(
            "claim-banner court relative overflow-hidden rounded-[22px] px-4 pb-4 pt-3.5 text-white",
            phase === "done" && "claim-banner-done",
          )}
          aria-live="polite"
        >
          <span
            className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(255_197_49/0.42),transparent_68%)]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgb(242_106_27/0.3),transparent_70%)]"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <div
              className="relative h-[54px] shrink-0"
              style={{ width: 46 + (fan.length - 1) * 20 }}
              aria-hidden
            >
              {fan.map((s, i) => (
                <span
                  key={s.def.key}
                  className={clsx(
                    "claim-fan absolute top-1 drop-shadow-[0_6px_10px_rgb(0_0_0/0.3)]",
                    phase !== "idle" && "claim-fan-go",
                  )}
                  style={
                    {
                      left: i * 20,
                      zIndex: 3 - i,
                      "--r": `${(i - (fan.length - 1) / 2) * 9}deg`,
                      animationDelay: `${i * 70}ms`,
                    } as React.CSSProperties
                  }
                >
                  <BadgeMedal icon={s.def.icon} tier={s.tier} size={46} />
                </span>
              ))}
              {extra > 0 && (
                <span className="tnum absolute -bottom-1 -right-2 z-10 rounded-full bg-volt px-1.5 py-px text-[11px] font-bold text-volt-ink">
                  +{extra}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold leading-tight">
                {phase === "done"
                  ? n === 1
                    ? "Eccolo nella collezione"
                    : "Tutti nella collezione"
                  : n === 1
                    ? "Un badge nuovo"
                    : `${n} badge nuovi`}
              </p>
              <p className="mt-0.5 text-[12.5px] text-white/70">
                {phase === "done"
                  ? n === 1
                    ? "Riscattato"
                    : `${n} riscattati in un colpo`
                  : n === 1
                    ? "Pronto da prendere"
                    : "Prendili tutti con un tocco"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClaim}
            disabled={phase !== "idle"}
            className="press relative mt-3.5 flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-white/20 bg-white/16 text-[14.5px] font-semibold backdrop-blur-md disabled:opacity-100"
          >
            {phase === "claiming" && (
              <span
                className="claim-fill absolute inset-y-0 left-0 bg-white/18"
                style={{ width: `${(opened / n) * 100}%` }}
                aria-hidden
              />
            )}
            {phase === "done" ? (
              <>
                <IconCheck
                  size={18}
                  stroke={2.6}
                  className="relative text-volt"
                />
                <span className="relative">Fatto</span>
              </>
            ) : phase === "claiming" ? (
              <span className="tnum relative">
                Apro {Math.min(opened + 1, n)} di {n}
              </span>
            ) : (
              <>
                <IconSparkles size={18} className="relative text-volt" />
                <span className="relative">
                  {n === 1 ? "Riscatta" : "Riscatta tutti"}
                </span>
              </>
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
