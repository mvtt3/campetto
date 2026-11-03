"use client";

import { BookOpen, ChevronLeft, Gift, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Character } from "@/components/character";
import { Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { play, primeAudio } from "@/lib/sound";
import { KING_PRIZE, LEVELS, dailyStatus, fmtEuro } from "@/lib/game/economy";
import { DIFF, ZONE_CENTER, judgeShot, shotZone } from "@/lib/game/match";
import { MINI } from "@/lib/game/minigames";
import { applyAwards, realMatchBonus } from "@/lib/game/state";
import { MINIGAMES, type GameAward, type MiniGame } from "@/lib/game/types";
import type { Player } from "@/lib/types";
import { Career, DailySheet, Guide, Wardrobe } from "./extra";
import { Hub } from "./hub";
import { MatchScreen } from "./match-screen";
import { SoloShot } from "./action";
import { Phone } from "./phone";
import { CourtScene } from "./scene";
import { Sfide } from "./sfide";
import { GameProvider, useGame } from "./store";
import { Tip, ToastProvider, clockNow, useToast, useToday } from "./ui";

/** Dove sei nel gioco: "hub", "telefono:messaggi:mamma", "partita:3", "sfide:triple"… */
export type View = string;

const TITLES: Record<string, string> = {
  sfide: "Sfide",
  guardaroba: "Guardaroba",
  carriera: "Carriera",
  guida: "Guida",
  partita: "Partita",
};

function viewFromUrl(): View {
  if (typeof window === "undefined") return "hub";
  return new URLSearchParams(window.location.search).get("v") || "hub";
}

const noop = () => () => {};

/** Campetto Star a tutto schermo, sopra all'app (anche sopra la barra in basso). */
export function Game({ me }: { me: Player }) {
  // Nel body: così niente animazioni della pagina sotto lo spostano o lo tagliano.
  const client = useSyncExternalStore(noop, () => true, () => false);
  if (!client) return null;
  return createPortal(
    <div className="fixed inset-0 z-[65] bg-bg" data-testid="game">
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <ToastProvider>
          <GameProvider me={me}>
            <GameShell />
          </GameProvider>
        </ToastProvider>
      </div>
    </div>,
    document.body,
  );
}

function GameShell() {
  const router = useRouter();
  const { game, update, syncing, flush } = useGame();
  const [view, setView] = useState<View>(viewFromUrl);
  const depth = useRef(0);
  const [daily, setDaily] = useState(false);
  const today = useToday();

  useEffect(() => {
    const onPop = () => {
      depth.current = Math.max(0, depth.current - 1);
      setView(viewFromUrl());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((v: View) => {
    play("tap");
    depth.current += 1;
    window.history.pushState(null, "", v === "hub" ? "/gioca" : `/gioca?v=${encodeURIComponent(v)}`);
    setView(v);
  }, []);
  const back = useCallback(() => {
    if (depth.current > 0) window.history.back();
    else {
      // Arrivato da un link diretto: si risale di un livello.
      const parts = view.split(":");
      const up = parts.length > 1 ? parts.slice(0, -1).join(":") : "hub";
      window.history.replaceState(null, "", up === "hub" ? "/gioca" : `/gioca?v=${encodeURIComponent(up)}`);
      setView(up);
    }
  }, [view]);
  const exit = useCallback(() => {
    flush();
    router.push("/");
  }, [flush, router]);

  // Il premio del giorno si apre da solo, una volta per apertura, finito il tutorial.
  const offered = useRef(false);
  useEffect(() => {
    if (syncing || offered.current || game.tutorial.step < 4 || view !== "hub") return;
    offered.current = true;
    if (!dailyStatus(game, today).claimed) {
      const t = window.setTimeout(() => setDaily(true), 500);
      return () => window.clearTimeout(t);
    }
  }, [syncing, game, view, today]);

  const [kind, ...rest] = view.split(":");
  const sub = rest.join(":");

  if (game.tutorial.step === 0)
    return (
      <Intro
        onStart={() => update((s) => ({ ...s, tutorial: { ...s.tutorial, step: 1 } }))}
        onSkip={() => update((s) => ({ ...s, tutorial: { ...s.tutorial, step: 4 } }))}
        onExit={exit}
      />
    );
  if (game.tutorial.step === 1)
    return <Practice onDone={() => update((s) => ({ ...s, tutorial: { ...s.tutorial, step: 2 } }))} />;

  return (
    <>
      <OnOpen />
      {kind !== "telefono" && (
        <header className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-[max(10px,env(safe-area-inset-top))]">
          {kind === "hub" ? (
            <button onClick={exit} aria-label="Esci dal gioco" className="press sticker-sm grid h-11 w-11 place-items-center rounded-full bg-surface" data-testid="game-exit">
              <X size={22} />
            </button>
          ) : (
            <button onClick={back} aria-label="Indietro" className="press sticker-sm grid h-11 w-11 place-items-center rounded-full bg-surface">
              <ChevronLeft size={22} />
            </button>
          )}
          {kind === "hub" ? (
            <>
              <h1 className="sr-only">Campetto Star</h1>
              <span className="num sticker-sm rounded-full bg-surface px-3 py-2 text-[16px]" data-testid="game-money">
                {fmtEuro(game.money)}
              </span>
              <span className="flex-1" />
              <button onClick={() => go("guida")} aria-label="Guida" className="press sticker-sm grid h-11 w-11 place-items-center rounded-full bg-surface">
                <BookOpen size={20} />
              </button>
              <button onClick={() => setDaily(true)} aria-label="Premio del giorno" className="press sticker-sm relative grid h-11 w-11 place-items-center rounded-full bg-surface">
                <Gift size={20} />
                {!dailyStatus(game, today).claimed && <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-edge bg-danger" />}
              </button>
            </>
          ) : (
            <>
              <h1 className="display min-w-0 flex-1 truncate text-[24px]">{TITLES[kind] ?? ""}</h1>
              <span className="num sticker-sm rounded-full bg-surface px-3 py-2 text-[15px]">{fmtEuro(game.money)}</span>
            </>
          )}
        </header>
      )}
      {kind === "hub" && <Hub go={go} openDaily={() => setDaily(true)} />}
      {kind === "telefono" && <Phone app={sub || null} go={go} back={back} />}
      {kind === "partita" && <MatchView index={Number(sub)} onExit={back} />}
      {kind === "sfide" && (
        <Sfide
          playing={(MINIGAMES as readonly string[]).includes(sub) ? (sub as MiniGame) : null}
          setPlaying={(g) => (g ? go(`sfide:${g}`) : back())}
        />
      )}
      {kind === "guardaroba" && <Wardrobe />}
      {kind === "carriera" && <Career />}
      {kind === "guida" && (
        <Guide
          onTutorial={() => {
            update((s) => ({ ...s, tutorial: { step: 0, seen: [] } }));
            back();
          }}
        />
      )}
      <DailySheet open={daily} onClose={() => setDaily(false)} />
    </>
  );
}

function MatchView({ index, onExit }: { index: number; onExit: () => void }) {
  return (
    <>
      <div className="px-4 pb-2">
        <Tip id="partita" />
      </div>
      <MatchScreen index={index} onExit={onExit} />
    </>
  );
}

/** All'apertura: le partite vere giocate e i premi di mezzanotte vinti. */
function OnOpen() {
  const { game, update, realIds, syncing } = useGame();
  const { backend } = useData();
  const toast = useToast();
  const [awards, setAwards] = useState<GameAward[] | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (syncing || done.current) return;
    done.current = true;
    const r = realMatchBonus(game, realIds, clockNow(), Math.random);
    if (r.count) {
      update(() => r.s);
      toast(
        r.count === 1 ? "Partita vera al campetto: bonus, energia piena e un gettone!" : `${r.count} partite vere: bonus, energia piena e gettoni!`,
        "ok",
      );
    }
    backend.claimGameAwards().then(
      (a) => {
        if (!a.length) return;
        update((s) => applyAwards(s, a));
        setAwards(a);
        play("win");
      },
      () => {
        /* riproverà alla prossima apertura */
      },
    );
  }, [syncing, game, realIds, update, backend, toast]);
  if (!awards) return null;
  const mult = LEVELS[game.contract.level].mult;
  const crown = awards.length >= 3;
  return (
    <div className="fade-in fixed inset-0 z-[67] grid place-items-center bg-[#1d1a16]/75 px-8" role="dialog" aria-modal>
      <div className="card w-full max-w-sm px-5 pb-5 pt-4 text-center">
        <Mascot pose="esulta" size={110} className="mx-auto" />
        <p className="display mt-2 text-[30px] leading-tight">Sei il re del campetto!</p>
        <p className="mt-2 text-[15px]">
          A mezzanotte eri primo in {awards.map((a) => MINI[a.game].name.toLowerCase()).join(", ")}.
        </p>
        <p className="num mt-3 text-[34px] text-ok">+{fmtEuro(KING_PRIZE * mult * awards.length)}</p>
        {crown && <p className="mt-1 text-[15px] font-bold">👑 E la corona: la indossi già</p>}
        <Button variant="primary" size="lg" block className="mt-4" onClick={() => setAwards(null)}>
          Grande!
        </Button>
      </div>
    </div>
  );
}

function Intro({ onStart, onSkip, onExit }: { onStart: () => void; onSkip: () => void; onExit: () => void }) {
  const { me, charId, game } = useGame();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))]">
      <button onClick={onExit} aria-label="Esci" className="press sticker-sm grid h-11 w-11 place-items-center self-start rounded-full bg-surface">
        <X size={22} />
      </button>
      <div className="court relative mt-3 flex items-end justify-center gap-2 rounded-[28px] px-4 pb-3 pt-5">
        <Mascot pose="ciao" size={96} className="short:h-[64px] short:w-auto" />
        <Character id={charId} outfit={game.outfit} number={me.jerseyNumber} height={170} idle className="short:h-[118px] short:w-auto" />
      </div>
      <h1 className="display mt-5 text-center text-[38px] leading-none short:mt-3 short:text-[32px]">Campetto Star</h1>
      <p className="mt-3 text-center text-[16px] leading-snug">
        Sei tu, con il personaggio del tuo profilo. Parti dal campetto e arriva in Serie A: partite, soldi, telefono, e le sfide con gli amici del gruppo.
      </p>
      <ul className="mx-auto mt-4 flex max-w-xs flex-col gap-1.5 text-[15px]">
        <li>🏀 Partite da 2 minuti: tiri, passaggi, difesa</li>
        <li>📱 Messaggi, banca, contratti, shopping</li>
        <li>🎯 Tre sfide con classifiche del gruppo</li>
        <li>👕 Quello che compri lo vedi anche nell&apos;app</li>
      </ul>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button variant="primary" size="lg" block className="display !h-16 !text-[24px]" onClick={onStart} data-testid="intro-start">
          Iniziamo
        </Button>
        <Button variant="ghost" block onClick={onSkip} data-testid="intro-skip">
          Salta il tutorial
        </Button>
      </div>
    </div>
  );
}

/** Il primo tiro, con Spicchio che spiega: il tuo personaggio da solo in campo. */
function Practice({ onDone }: { onDone: () => void }) {
  const { game } = useGame();
  const zone = shotZone({ ...game, energy: 100 }, "facile", "media", true);
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState("Tieni premuto Tira: il tuo personaggio carica e la barra sale. Lascia quando è sul verde.");
  const [ok, setOk] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(14px,env(safe-area-inset-top))]">
      <p className="display text-[26px]">Il tiro</p>
      <div className="mb-2 mt-1 flex items-end gap-2">
        <Mascot pose={ok ? "esulta" : "ciao"} size={64} />
        <p className="sticker-sm mb-2 flex-1 rounded-2xl rounded-bl-sm bg-surface px-3 py-2 text-[15px] font-semibold leading-snug" aria-live="polite">
          {msg}
        </p>
      </div>
      <CourtScene className="min-h-0 flex-1">
        <SoloShot
          spot={{ x: 42, y: 84 }}
          sweep={DIFF.facile.sweep}
          zone={zone}
          disabled={ok}
          label="Dalla media · prova"
          judge={(pos) => {
            primeAudio();
            return judgeShot(pos, zone, game.skills.tiro, Math.random);
          }}
          onShot={(j) => {
            const n = tries + 1;
            setTries(n);
            if (j.made || n >= 4) {
              setOk(true);
              setMsg(
                j.outcome === "verde"
                  ? "Verde perfetto! Sul verde entra quasi sempre."
                  : j.made
                    ? "Dentro! Sul verde pieno entra quasi sempre."
                    : "Ci vuole un po' di mano: in partita il verde è lì che ti aspetta.",
              );
            } else setMsg(j.pos < ZONE_CENTER ? "Troppo presto: aspetta che la barra arrivi al verde" : "Troppo tardi: lascia appena tocca il verde");
          }}
        />
      </CourtScene>
      {ok && (
        <Button variant="primary" size="lg" block className="mt-3 !h-16" onClick={onDone} data-testid="practice-done">
          Avanti
        </Button>
      )}
    </div>
  );
}
