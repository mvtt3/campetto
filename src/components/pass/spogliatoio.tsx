"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconBallBasketball, IconBuildingStore, IconChartBar, IconCrown, IconHanger, IconTicket, IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Statuina } from "@/components/c3d/viewer";
import { CountUp, CourtLines, haptic } from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { markLockerSeen } from "@/lib/pass/actions";
import { ITEM_BY_ID, PASS_LEVELS, SPICCHI_PER_MATCH, type Item } from "@/lib/pass/catalog";
import type { PassMatch } from "@/lib/pass/engine";
import { matchMvp } from "@/lib/stats/match-mvp";
import { dayLabel } from "./pass-screen";
import { BoostIcon, ItemPhoto, SpicchioIcon, rewardLabel } from "./ui";
import { usePass } from "./use-pass";

const DUR = 6000;

const avg = (xs: PassMatch[], k: "pts" | "reb" | "ast") => {
  const withStats = xs.filter((m) => m.ctx.stats);
  return withStats.length ? withStats.reduce((s, m) => s + m.ctx[k], 0) / withStats.length : null;
};
const one = (v: number) => v.toFixed(1).replace(".", ",").replace(",0", "");

/**
 * Lo Spogliatoio: il racconto di una giornata in cinque storie, come quelle dei social.
 * Tocca a destra per andare avanti, a sinistra per tornare, tieni premuto per fermare.
 */
export function Spogliatoio() {
  const router = useRouter();
  const params = useSearchParams();
  const v = usePass();
  const { me } = useData();
  const { prog, playerId } = v;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // La prima storia aspetta il personaggio 3D: il tempo parte quando si vede.
  const [ready3d, setReady3d] = useState(false);
  useEffect(() => {
    // Se il 3D non parte (telefono senza WebGL), dopo un po' si va avanti lo stesso.
    const t = window.setTimeout(() => setReady3d(true), 4000);
    return () => window.clearTimeout(t);
  }, []);
  const pressAt = useRef(0);
  const close = () => (window.history.length > 1 ? router.back() : router.push("/pass"));

  useEffect(() => {
    if (v.playerId && !v.allowed) router.replace("/");
  }, [v.playerId, v.allowed, router]);

  const g = useMemo(() => {
    if (!prog) return null;
    const want = params.get("giorno");
    return prog.giornate.find((x) => x.day === want) ?? prog.giornate[0] ?? null;
  }, [prog, params]);

  const day = g?.day;
  useEffect(() => {
    if (playerId && day) markLockerSeen(playerId, day);
  }, [playerId, day]);

  const slides = useMemo(() => (g && prog && me ? buildSlides(g, prog.matches, me.id, v, () => setReady3d(true)) : []), [g, prog, me, v]);

  if (!prog || !playerId || !g) return null;
  const s = slides[Math.min(i, slides.length - 1)];

  return createPortal(
    <div
      className={clsx("fixed inset-0 z-[75] mx-auto flex max-w-lg select-none flex-col overflow-hidden text-white", s.bg, (paused || (i === 0 && !ready3d)) && "story-paused")}
      data-testid="spogliatoio"
      onPointerDown={() => {
        pressAt.current = performance.now();
        setPaused(true);
      }}
      onPointerUp={(e) => {
        setPaused(false);
        if (performance.now() - pressAt.current > 280) return;
        // Sui bottoni, sui link e sul personaggio 3D (che si gira col dito) non si cambia storia.
        if ((e.target as Element).closest("a,button,[data-no-nav]")) return;
        haptic(5);
        const right = e.clientX > window.innerWidth * 0.33;
        if (right) {
          if (i < slides.length - 1) setI(i + 1);
          else close();
        } else if (i > 0) setI(i - 1);
      }}
      onPointerCancel={() => setPaused(false)}
    >
      <CourtLines className="pointer-events-none absolute inset-0 h-full w-full opacity-25" />
      <div className="safe-top relative px-3 pt-3">
        <div className="flex gap-1">
          {slides.map((_, k) => (
            <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              {k < i && <span className="block h-full w-full bg-white" />}
              {k === i && (
                // La barretta che si riempie decide anche quando si passa alla storia dopo (e si ferma col dito).
                <span
                  key={i}
                  className="story-fill block h-full w-full bg-white"
                  style={{ ["--dur" as string]: `${DUR}ms` }}
                  onAnimationEnd={() => i < slides.length - 1 && setI(i + 1)}
                />
              )}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[13px] font-semibold">Spogliatoio</span>
          <button
            onClick={close}
            aria-label="Chiudi"
            className="press ml-auto grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur-md"
          >
            <IconX size={19} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <div key={i} className="fade-in relative flex min-h-0 flex-1 flex-col px-6 pb-8 safe-bottom">
        {s.body}
      </div>
    </div>,
    document.body,
  );
}

/** Il rimando dalla storia al punto dell'app dove c'è quella cosa. */
function Go({ href, icon, children, dark }: { href: string; icon: ReactNode; children: ReactNode; dark?: boolean }) {
  return (
    <Link
      href={href}
      className={clsx(
        "press rise inline-flex h-11 w-fit items-center gap-2 rounded-full px-4 text-[14px] font-semibold backdrop-blur-md",
        dark ? "bg-[#1d1a16]/85 text-white" : "bg-white/20 text-white",
      )}
      style={{ ["--i" as string]: 6 }}
    >
      {icon}
      {children}
    </Link>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="rise text-[13px] font-bold uppercase tracking-[0.1em] text-volt">{children}</p>;
}

function buildSlides(
  g: { day: string; matches: PassMatch[]; ups: { level: number; via: "sfida" | "punti"; alt?: 0 | 1 }[]; points: number },
  all: PassMatch[],
  meId: string,
  v: ReturnType<typeof usePass>,
  onReady3d: () => void,
): { bg: string; body: ReactNode }[] {
  const won = g.matches.filter((m) => m.ctx.won).length;
  const lost = g.matches.length - won;
  const boosted = g.matches.some((m) => m.boosted);
  const mvps = g.matches.filter((m) => matchMvp(m.match)?.playerId === meId).length;
  const best = [...g.matches].sort((a, b) => b.ctx.pts + b.ctx.reb + b.ctx.ast - (a.ctx.pts + a.ctx.reb + a.ctx.ast))[0];
  const before = all.filter((m) => m.day < g.day);
  const items: Item[] = g.ups
    .map((u) => PASS_LEVELS[u.level - 1].reward)
    .flatMap((r) => (r.kind === "item" ? [ITEM_BY_ID.get(r.id)!] : []))
    .filter(Boolean);
  const coins = g.matches.length * SPICCHI_PER_MATCH;
  const balance = v.prog?.spicchi ?? 0;
  const rows: { label: string; day: number | null; season: number | null }[] = [
    { label: "Punti", day: avg(g.matches, "pts"), season: avg(before, "pts") },
    { label: "Rimbalzi", day: avg(g.matches, "reb"), season: avg(before, "reb") },
    { label: "Assist", day: avg(g.matches, "ast"), season: avg(before, "ast") },
  ];
  const hasStats = rows.some((r) => r.day != null);

  const slides: { bg: string; body: ReactNode }[] = [
    {
      bg: "court",
      body: (
        <div className="flex flex-1 flex-col">
          <div className="mt-6">
            <Kicker>La tua giornata</Kicker>
            <h1 className="display rise mt-2 text-[40px] leading-[1.02] first-letter:uppercase" style={{ ["--i" as string]: 1 }}>
              {dayLabel(g.day)}
            </h1>
          </div>
          {/* Il personaggio vero in 3D (nitido, e si gira col dito), non una foto ingrandita. */}
          <div className="relative mx-auto mt-2 w-full max-w-[320px] flex-1" data-no-nav>
            <Statuina preset={v.preset} outfit={v.outfit} number={v.number} framing="full" spin={0.45} className="absolute inset-0" onReady={onReady3d} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [g.matches.length, g.matches.length === 1 ? "partita" : "partite"],
              [won, won === 1 ? "vinta" : "vinte"],
              [lost, lost === 1 ? "persa" : "perse"],
            ].map(([n, l], k) => (
              <div key={String(l)} className="rise rounded-[18px] border border-white/15 bg-white/15 px-3 py-3 backdrop-blur-md" style={{ ["--i" as string]: k + 2 }}>
                <p className="score text-[34px]">
                  <CountUp value={Number(n)} />
                </p>
                <p className="mt-1 text-[12.5px] font-medium text-white/75">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Go href={g.matches.length === 1 ? `/partite?m=${g.matches[0].match.id}` : "/partite"} icon={<IconBallBasketball size={18} aria-hidden />}>
              {g.matches.length === 1 ? "Apri la partita" : "Vedi le partite"}
            </Go>
          </div>
        </div>
      ),
    },
  ];

  if (hasStats)
    slides.push({
      bg: "bg-[linear-gradient(160deg,#f26a1b,#c2410c)]",
      body: (
        <div className="flex flex-1 flex-col justify-center">
          <Kicker>I tuoi numeri</Kicker>
          <h2 className="display rise mt-2 text-[30px] leading-tight" style={{ ["--i" as string]: 1 }}>
            A partita, contro la tua media
          </h2>
          <div className="mt-8 flex flex-col gap-6">
            {rows.map((r, k) => {
              const max = Math.max(1, r.day ?? 0, r.season ?? 0);
              const up = r.day != null && r.season != null && r.day > r.season + 0.05;
              return (
                <div key={r.label} className="rise" style={{ ["--i" as string]: k + 2 }}>
                  <div className="flex items-end justify-between">
                    <span className="text-[15px] font-semibold">{r.label}</span>
                    <span className="score text-[38px]">{r.day != null ? one(r.day) : "—"}</span>
                  </div>
                  <div className="relative mt-2 h-3 rounded-full bg-black/20">
                    <span className="bar-in absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${((r.day ?? 0) / max) * 100}%` }} />
                    {r.season != null && (
                      <span className="absolute -inset-y-1 w-[3px] rounded-full bg-volt" style={{ left: `${(r.season / max) * 100}%` }} aria-hidden />
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-white/80">
                    {r.season == null ? "Prima giornata della season" : up ? `Sopra la tua media (${one(r.season)})` : `La tua media: ${one(r.season)}`}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="mt-8">
            <Go href="/profilo" icon={<IconChartBar size={18} aria-hidden />}>
              Le tue statistiche
            </Go>
          </div>
        </div>
      ),
    });

  slides.push({
    bg: "bg-[linear-gradient(160deg,#3d6af0,#1b2a5c)]",
    body: (
      <div className="flex flex-1 flex-col justify-center">
        <Kicker>Il pass</Kicker>
        <p className="score rise mt-3 text-[84px]" style={{ ["--i" as string]: 1 }}>
          +<CountUp value={g.points} />
        </p>
        <p className="rise text-[16px] font-semibold text-white/85" style={{ ["--i" as string]: 2 }}>
          punti pass{boosted ? " · col boost, valevano doppio" : ""}
        </p>
        {boosted && (
          <span className="rise mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-volt px-3 py-1 text-[13px] font-bold text-volt-ink" style={{ ["--i" as string]: 3 }}>
            <BoostIcon size={15} /> Boost usato
          </span>
        )}
        <div className="mt-7 flex flex-col gap-2">
          {g.ups.length ? (
            g.ups.map((u, k) => {
              const lv = PASS_LEVELS[u.level - 1];
              return (
                <Link
                  key={u.level}
                  href={`/pass?livello=${u.level}`}
                  className="press rise flex items-center gap-3 rounded-[18px] border border-white/15 bg-white/15 px-3.5 py-3 backdrop-blur-md"
                  style={{ ["--i" as string]: k + 3 }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-volt text-[15px] font-bold text-volt-ink">{u.level}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold">
                      {u.via === "sfida" ? lv.sfide[u.alt ?? 0].label : "Livello coi punti"}
                    </span>
                    <span className="block truncate text-[12.5px] text-white/75">Premio: {rewardLabel(lv.reward, lv.reward.kind === "item" ? ITEM_BY_ID.get(lv.reward.id) : undefined)}</span>
                  </span>
                  <IconTicket size={18} className="shrink-0 text-white/70" aria-hidden />
                </Link>
              );
            })
          ) : (
            <p className="rounded-[18px] border border-white/15 bg-white/15 px-4 py-3 text-[14px] text-white/85 backdrop-blur-md">
              Nessun livello oggi, ma i punti restano: il prossimo è più vicino
            </p>
          )}
        </div>
        <div className="mt-6">
          <Go href={g.ups.length ? `/pass?livello=${g.ups[g.ups.length - 1].level}` : "/pass"} icon={<IconTicket size={18} aria-hidden />}>
            Vai al pass
          </Go>
        </div>
      </div>
    ),
  });

  slides.push({
    bg: "bg-[linear-gradient(160deg,#ffc531,#f26a1b)] !text-[#1d1a16]",
    body: (
      <div className="flex flex-1 flex-col justify-center">
        <p className="rise text-[13px] font-bold uppercase tracking-[0.1em] text-[#1d1a16]/70">Il bottino</p>
        <div className="rise mt-3 flex items-center gap-3" style={{ ["--i" as string]: 1 }}>
          <SpicchioIcon size={64} />
          <p className="score text-[72px]">
            +<CountUp value={coins} />
          </p>
        </div>
        <p className="rise text-[16px] font-semibold text-[#1d1a16]/75" style={{ ["--i" as string]: 2 }}>
          Spicchi per le partite giocate
        </p>
        <p className="rise mt-5 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/45 px-3.5 py-1.5 text-[14px] font-semibold" style={{ ["--i" as string]: 3 }}>
          Nel salvadanaio: <SpicchioIcon size={17} /> <span className="num">{balance}</span>
        </p>
        {items.length > 0 && (
          <>
            <p className="rise mt-7 text-[15px] font-semibold" style={{ ["--i" as string]: 3 }}>
              {items.length === 1 ? "E un oggetto nuovo da riscattare" : `E ${items.length} oggetti nuovi da riscattare`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {items.slice(0, 3).map((it, k) => (
                // Tocca l'oggetto: si apre la sua carta nel camerino, in 3D, da provare.
                <Link key={it.id} href={`/camerino?carta=${it.id}`} className="press pop-in block" style={{ animationDelay: `${200 + k * 90}ms` }}>
                  <span className={clsx("relative block aspect-square overflow-hidden rounded-[20px]", `rar-${it.rarity}`)}>
                    <ItemPhoto item={it} preset={v.preset} size={240} className="absolute inset-0" />
                    <span className="rw-glint" aria-hidden />
                  </span>
                  <span className="mt-1.5 block truncate text-[12.5px] font-semibold">{it.name}</span>
                </Link>
              ))}
            </div>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {items.length > 0 && (
            <Go href={`/camerino?carta=${items[0].id}`} icon={<IconHanger size={18} aria-hidden />} dark>
              Provalo nel camerino
            </Go>
          )}
          <Go href="/camerino?scheda=bancarella" icon={<IconBuildingStore size={18} aria-hidden />} dark>
            Spendili alla bancarella
          </Go>
        </div>
      </div>
    ),
  });

  if (best)
    slides.push({
      bg: "court",
      body: (
        <div className="flex flex-1 flex-col justify-center">
          <Kicker>{mvps ? "Il migliore in campo" : g.matches.length === 1 ? "La partita" : "La partita migliore"}</Kicker>
          <p className="score rise mt-3 text-[64px]" style={{ ["--i" as string]: 1 }}>
            {best.ctx.teamPts}
            <span className="mx-1 text-white/40">–</span>
            {best.ctx.won ? best.ctx.teamPts - best.ctx.margin : best.ctx.teamPts + best.ctx.margin}
          </p>
          <p className="rise text-[16px] font-semibold text-white/85" style={{ ["--i" as string]: 2 }}>
            {best.ctx.won ? "Vinta" : "Persa"} · {best.match.format}
            {best.ctx.stats ? ` · ${best.ctx.pts} punti, ${best.ctx.reb} rimbalzi, ${best.ctx.ast} assist` : ""}
          </p>
          {mvps > 0 && (
            <span className="rise mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-volt px-3 py-1.5 text-[14px] font-bold text-volt-ink" style={{ ["--i" as string]: 3 }}>
              <IconCrown size={16} /> MVP {mvps > 1 ? `in ${mvps} partite` : "della partita"}
            </span>
          )}
          <div className="mt-10 flex gap-2">
            <Link
              href={`/partite?m=${best.match.id}`}
              className="press sticker flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-court"
            >
              <IconBallBasketball size={18} aria-hidden /> Apri la partita
            </Link>
            <Link
              href="/pass"
              className="press flex h-12 flex-1 items-center justify-center rounded-full bg-white/20 text-[15px] font-semibold backdrop-blur-md"
            >
              Vai al pass
            </Link>
          </div>
        </div>
      ),
    });

  return slides;
}
