"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Court } from "@/components/c3d/court";
import { Button, haptic } from "@/components/ui/basics";
import { Sheet } from "@/components/ui/sheet";
import { play } from "@/lib/sound";
import { shotPrize } from "@/lib/pass/actions";
import { ITEM_BY_ID, RARITIES, RARITY_LABEL, SHOT_ODDS, duplicateRefund, type Item } from "@/lib/pass/catalog";
import { todayKey, updatePass } from "@/lib/pass/store";
import { RewardReveal } from "./reveal";
import { ItemPhoto, SpicchioIcon } from "./ui";
import { usePass } from "./use-pass";

/** Ogni tiro un po' più difficile: la barra corre più veloce e il verde si sposta. */
const ROUNDS = [
  { period: 1.25, center: 0.62, width: 0.17 },
  { period: 1.15, center: 0.45, width: 0.16 },
  { period: 1.05, center: 0.7, width: 0.15 },
  { period: 0.97, center: 0.54, width: 0.14 },
  { period: 0.9, center: 0.66, width: 0.13 },
];

/** Gli stessi cinque punti del campetto 3D (qui solo i nomi, per non caricare il 3D prima del tempo). */
const SPOT_NAMES = ["Angolo sinistro", "Ala sinistra", "Centro", "Ala destra", "Angolo destro"];

type Phase = "loading" | "intro" | "aim" | "flying" | "done" | "already";

const nowMs = () => performance.now();

/** La posizione del cursore: avanti e indietro, morbida agli estremi. */
const cursorAt = (elapsed: number, period: number) => {
  const x = (elapsed / period) % 2;
  const tri = x < 1 ? x : 2 - x;
  return 0.5 - Math.cos(tri * Math.PI) / 2;
};

export function TiroDelGiorno() {
  const router = useRouter();
  const v = usePass();
  const { prog, st, playerId } = v;
  const canvas = useRef<HTMLCanvasElement>(null);
  const court = useRef<Court | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [flash, setFlash] = useState<"made" | "miss" | null>(null);
  const [odds, setOdds] = useState(false);
  const [prize, setPrize] = useState<{ item: Item; refund?: number; coins: number; made: number } | null>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const aimStart = useRef(0);
  const raf = useRef(0);
  const today = todayKey();
  const played = st.shot?.day === today;
  const close = useCallback(() => (window.history.length > 1 ? router.back() : router.push("/")), [router]);

  useEffect(() => {
    if (v.playerId && !v.allowed) router.replace("/");
  }, [v.playerId, v.allowed, router]);

  // Il campetto 3D: si carica una volta, col tuo personaggio e quello che indossa.
  const presetRef = useRef({ preset: v.preset, outfit: v.outfit, number: v.number });
  useLayoutEffect(() => {
    presetRef.current = { preset: v.preset, outfit: v.outfit, number: v.number };
  });
  useEffect(() => {
    let dead = false;
    void import("@/components/c3d/court").then(async (m) => {
      await m.preloadTextures();
      if (dead || !canvas.current) return;
      const c = new m.Court(canvas.current);
      const p = presetRef.current;
      c.setCharacter(p.preset, p.outfit, p.number);
      c.goTo(0, true);
      c.onFirstFrame = () => setPhase((ph) => (ph === "loading" ? "intro" : ph));
      // La barra segue il personaggio: sta sempre al suo fianco destro.
      c.onAnchor = (x, top, bottom) => {
        const el = meter.current;
        if (!el) return;
        const hgt = Math.min(240, Math.max(130, bottom - top));
        const mid = (top + bottom) / 2;
        const left = Math.min(window.innerWidth - 40, Math.max(12, x));
        el.style.transform = `translate(${left}px, ${mid - hgt / 2}px)`;
        el.style.height = `${hgt}px`;
      };
      court.current = c;
    });
    return () => {
      dead = true;
      court.current?.dispose();
      court.current = null;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // La barra: il cursore si muove in un rAF leggero (solo transform, niente React).
  useEffect(() => {
    if (phase !== "aim") return;
    aimStart.current = nowMs();
    const r = ROUNDS[round];
    const step = (now: number) => {
      const x = cursorAt((now - aimStart.current) / 1000, r.period);
      if (cursor.current) cursor.current.style.transform = `translateY(${-x * 100}cqh)`;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [phase, round]);

  const shoot = () => {
    if (phase !== "aim" || !court.current) return;
    cancelAnimationFrame(raf.current);
    const r = ROUNDS[round];
    const x = cursorAt((nowMs() - aimStart.current) / 1000, r.period);
    const made = Math.abs(x - r.center) <= r.width / 2;
    haptic(14);
    play("tap");
    setPhase("flying");
    court.current.shoot(made ? "made" : "miss", () => {
      play(made ? "swish" : "rim");
      haptic(made ? [10, 30, 10] : 30);
      setFlash(made ? "made" : "miss");
      const next = [...results, made];
      setResults(next);
      window.setTimeout(() => {
        setFlash(null);
        if (next.length >= ROUNDS.length) return finish(next.filter(Boolean).length);
        setRound(next.length);
        court.current?.goTo(next.length);
        window.setTimeout(() => setPhase("aim"), 650);
      }, 650);
    });
  };

  const finish = (made: number) => {
    if (!prog || !playerId) return;
    const res = shotPrize(playerId, made, SHOT_ODDS[made], prog.owned);
    setPhase("done");
    court.current?.setPaused(true);
    setPrize({ item: res.item, refund: res.duplicate ? duplicateRefund(res.item.rarity) : undefined, coins: res.coins, made });
  };

  if (!prog || !playerId) return null;
  const r = ROUNDS[round];
  const made = results.filter(Boolean).length;
  const shownPhase: Phase = played && phase !== "done" && !prize ? "already" : phase;
  const lastPrize = st.shot?.prize ? ITEM_BY_ID.get(st.shot.prize) : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[75] mx-auto flex max-w-lg flex-col bg-[#1b2a5c] text-white" data-testid="tiro">
      <canvas
        ref={canvas}
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={() => shownPhase === "aim" && shoot()}
        aria-label="Il campetto: tocca per tirare"
      />
      {/* La barra del tiro, in verticale accanto al personaggio (come nei giochi di basket). */}
      <div
        ref={meter}
        aria-hidden
        data-testid="tiro-meter"
        className={clsx(
          "pointer-events-none absolute left-0 top-0 w-[18px] transition-opacity duration-200 [container-type:size]",
          shownPhase === "aim" || shownPhase === "flying" ? "opacity-100" : "opacity-0",
        )}
        style={{ height: 160, transform: "translate(-100px, -100px)" }}
      >
        <span className="absolute inset-0 rounded-full border-2 border-white/70 bg-black/35 shadow-[0_4px_14px_rgb(0_0_0/0.35)]" />
        <span
          className={clsx("absolute inset-x-[3px] rounded-full bg-ok shadow-[0_0_12px_rgb(76_199_125/0.9)]", flash === "made" && "bg-volt")}
          style={{ bottom: `${(r.center - r.width / 2) * 100}%`, height: `${r.width * 100}%` }}
        />
        <span ref={cursor} className="absolute inset-x-0 bottom-0 h-0">
          <span className="absolute -left-[5px] -right-[5px] -top-[3px] h-[6px] rounded-full bg-white shadow-[0_0_8px_rgb(0_0_0/0.6)]" />
        </span>
      </div>
      <header className="safe-top relative flex items-center gap-3 px-4 pt-4">
        <button
          onClick={close}
          aria-label="Chiudi"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/15 backdrop-blur-md"
        >
          <IconX size={20} strokeWidth={2.4} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="display truncate text-[20px] drop-shadow">Tiro del giorno</h1>
        </div>
        <div className="flex gap-1" aria-label={`${made} canestri su ${results.length}`}>
          {ROUNDS.map((_, i) => (
            <span
              key={i}
              className={clsx(
                "grid h-[22px] w-[22px] place-items-center rounded-full border-2",
                i >= results.length && (i === round && shownPhase !== "already" ? "border-volt bg-white/10" : "border-white/35"),
                results[i] === true && "pop-in border-volt bg-volt text-volt-ink",
                results[i] === false && "pop-in border-white/40 bg-white/20 text-white/70",
              )}
            >
              {results[i] === true ? <IconCheck size={13} strokeWidth={3.2} /> : results[i] === false ? <IconX size={12} strokeWidth={3} /> : null}
            </span>
          ))}
        </div>
      </header>

      {flash && (
        <p
          className={clsx(
            "pop-in pointer-events-none absolute inset-x-0 top-[30%] text-center",
            "display text-[44px] drop-shadow-[0_4px_12px_rgb(0_0_0/0.35)]",
            flash === "made" ? "text-volt" : "text-white/85",
          )}
        >
          {flash === "made" ? "Dentro!" : "Fuori"}
        </p>
      )}

      <div className="relative mt-auto px-4 pb-6 safe-bottom">
        {shownPhase === "loading" && (
          <p className="mx-auto mb-10 w-fit rounded-full bg-white/15 px-4 py-2 text-[14px] font-semibold backdrop-blur-md">Si scende in campo…</p>
        )}

        {shownPhase === "intro" && (
          <div className="fade-in rounded-[28px] border border-white/20 bg-white/15 p-5 backdrop-blur-md" data-testid="tiro-intro">
            <p className="title text-[19px]">Cinque tiri da tre</p>
            <p className="mt-1.5 text-[14px] leading-snug text-white/85">
              Uno per ogni punto giallo. Ferma la barra quando il cursore è nel verde: più canestri fai, più è raro il premio
            </p>
            <button onClick={() => setOdds(true)} className="press mt-2 text-[13px] font-semibold text-volt underline underline-offset-2">
              Le probabilità dei premi
            </button>
            <Button variant="primary" block className="mt-4" onClick={() => setPhase("aim")} data-testid="tiro-start">
              Inizia
            </Button>
          </div>
        )}

        {(shownPhase === "aim" || shownPhase === "flying") && (
          <div className="flex items-center gap-3 rounded-[24px] border border-white/20 bg-white/15 p-2 pl-4 backdrop-blur-md" data-testid="tiro-bar">
            <p className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-semibold">{SPOT_NAMES[round]}</span>
              <span className="block text-[12px] text-white/75">Ferma la barra nel verde</span>
            </p>
            <Button variant="primary" size="lg" className="!px-9" onClick={shoot} disabled={shownPhase !== "aim"} sound={false} data-testid="tiro-shoot">
              Tira
            </Button>
          </div>
        )}

        {shownPhase === "already" && (
          <div className="fade-in rounded-[28px] border border-white/20 bg-white/15 p-5 backdrop-blur-md" data-testid="tiro-already">
            <p className="title text-[19px]">Per oggi hai tirato</p>
            <p className="mt-1 text-[14px] text-white/85">
              {st.shot?.made ?? 0} canestri su 5. Domani si riapre il campo
            </p>
            {lastPrize && (
              <div className="mt-3 flex items-center gap-3 rounded-[20px] bg-black/20 p-2 pr-3">
                <span className={clsx("relative block h-14 w-14 shrink-0 overflow-hidden rounded-[16px]", `rar-${lastPrize.rarity}`)}>
                  <ItemPhoto item={lastPrize} preset={v.preset} size={112} className="absolute inset-0" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[14.5px] font-semibold">{lastPrize.name}</span>
                  <span className="block text-[12.5px] text-white/75">{RARITY_LABEL[lastPrize.rarity]}</span>
                </span>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                variant="light"
                className="flex-1 whitespace-nowrap text-text"
                onClick={() => {
                  // Solo per le prove dell'amministratore: si ritira subito.
                  updatePass(playerId, (s) => ({ ...s, shot: null }));
                  setResults([]);
                  setRound(0);
                  setPrize(null);
                  court.current?.goTo(0);
                  setPhase("intro");
                }}
              >
                Rigioca (prova)
              </Button>
              <Button variant="primary" className="flex-1" onClick={close}>
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </div>

      <Sheet open={odds} onOpenChange={setOdds} title="Probabilità dei premi" description="Il premio è sempre un oggetto: i canestri decidono quanto è raro">
        <div className="card overflow-hidden text-[13.5px] text-text" data-testid="tiro-odds">
          <div className="grid grid-cols-5 gap-1 bg-raised px-3 py-2 text-[11.5px] font-semibold text-muted">
            <span>Canestri</span>
            {RARITIES.map((x) => (
              <span key={x} className="text-right">
                {RARITY_LABEL[x]}
              </span>
            ))}
          </div>
          {[5, 4, 3, 2, 1, 0].map((n) => (
            <div key={n} className="grid grid-cols-5 gap-1 border-t border-line px-3 py-2.5">
              <span className="num text-[15px]">{n}</span>
              {RARITIES.map((x) => (
                <span key={x} className="num text-right text-[14px]">
                  {SHOT_ODDS[n][x]}%
                </span>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-3 px-1 text-[12.5px] text-muted">
          Prima esce un oggetto che non hai; se di quella rarità li hai tutti, il doppione torna in Spicchi. In più, 2 Spicchi per ogni
          canestro
        </p>
      </Sheet>

      {prize && (
        <RewardReveal
          item={prize.item}
          kicker={`Tiro del giorno · ${prize.made} su 5`}
          refund={prize.refund}
          preset={v.preset}
          outfit={v.outfit}
          number={v.number}
          owned
          extra={
            prize.coins > 0 ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-white/90">
                E per i canestri <SpicchioIcon size={16} /> +{prize.coins}
              </p>
            ) : null
          }
          onClose={() => {
            setPrize(null);
            setPhase("already");
            court.current?.setPaused(false);
          }}
          onEquip={() => {
            updatePass(playerId, (s) => ({ ...s, outfit: { ...s.outfit, [prize.item.slot]: prize.item.id } }));
            setPrize(null);
            close();
          }}
        />
      )}
    </div>,
    document.body,
  );
}
