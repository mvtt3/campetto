"use client";

import clsx from "clsx";
import {
  IconArrowUpRight,
  IconCalendarEvent,
  IconFlag,
  IconTrophy,
} from "@tabler/icons-react";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data/provider";
import { play } from "@/lib/sound";
import { unitOf, type PregameTarget } from "@/lib/stats/pregame";
import { placeLabel, shortName, type Proposal } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { CountUp } from "./ui/basics";

const TZ = "Europe/Rome";
const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

/** "domani", "oggi" o "stasera", rispetto a adesso. */
export function whenWord(startsAt: string, now = new Date()): "domani" | "oggi" | "stasera" {
  const start = new Date(startsAt);
  if (dayKey(start) !== dayKey(now)) return "domani";
  const h = Number(
    start.toLocaleTimeString("it-IT", { hour: "2-digit", hour12: false, timeZone: TZ }),
  );
  return h >= 18 ? "stasera" : "oggi";
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Come si scrive un valore della classifica: media con la virgola, percentuale, totale. */
function formatter(t: PregameTarget) {
  const b = t.board!;
  if (b.kind === "percentuale") return (v: number) => `${Math.round(v * 100)}%`;
  if (b.kind === "totale") return (v: number) => String(Math.round(v));
  // Se con un decimale sembrano uguali (0,7 e 0,7), ne servono due.
  const one = (v: number) => v.toFixed(1);
  const dec =
    one(b.rivalValue) === one(b.myValue) || one(b.rivalValue) === one(b.after) ? 2 : 1;
  return (v: number) => v.toFixed(dec).replace(".", ",");
}

/** Il titolo grande della scheda. */
function title(t: PregameTarget): string {
  if (t.kind === "record") return "Record a un passo";
  if (t.kind === "traguardo") return `Quota ${t.bar!.to} in vista`;
  return t.board!.afterRank === 1 ? "Il primo posto è lì" : "Sorpasso in vista";
}

/** Cosa fare, in poche parole, dopo il numero grande. */
function line(t: PregameTarget, rival: string): string {
  if (t.kind === "record") return "in una partita e il record è tuo";
  if (t.kind === "traguardo")
    return t.stat === "partite"
      ? `e arrivi a ${t.bar!.to} partite giocate`
      : t.stat === "vittorie"
        ? `e arrivi a ${t.bar!.to} vittorie`
        : `e arrivi a ${t.bar!.to} in totale`;
  if (t.stat === "campo") return `al tiro e passi ${rival}`;
  return t.board!.kind === "media" ? `in una partita e passi ${rival}` : `e passi ${rival}`;
}

/** La riga piccola che dice su cosa si basa il conto. */
function note(t: PregameTarget, rival: string, when: string, holder: string): string {
  if (t.kind === "record")
    return `È di ${holder}: con ${t.bar!.record} lo pareggi, con ${t.need} è tuo`;
  if (t.kind === "traguardo") {
    const u = t.bar!.usual;
    if (t.stat === "partite") return "Basta esserci";
    if (t.stat === "vittorie")
      return `Vinci il ${Math.round((u ?? 0) * 100)}% delle partite che giochi`;
    return `Di solito ne fai ${(u ?? 0).toFixed(1).replace(".", ",").replace(",0", "")} a partita`;
  }
  const b = t.board!;
  if (t.stat === "campo")
    return `Di solito prendi ${t.attempts} tiri a partita`;
  if (b.kind === "media")
    return b.rivalPlays
      ? "Gioca anche lui: vale se resta sulla sua media"
      : `${rival} ${when} non gioca: resta a ${formatter(t)(b.rivalValue)}`;
  return b.rivalPlays
    ? t.stat === "vittorie"
      ? "Gioca anche lui: se vince, ne servono di più"
      : "Gioca anche lui: se ne segna, ne servono di più"
    : `${rival} ${when} non gioca`;
}

/** Un numero che passa da un valore all'altro (la media che sale). */
function Morph({ from, to, run, format }: { from: number; to: number; run: boolean; format: (v: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!run || reduce) {
      el.textContent = format(run ? to : from);
      return;
    }
    const c = animate(from, to, {
      duration: 0.7,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => (el.textContent = format(v)),
    });
    return () => c.stop();
  }, [from, to, run, reduce, format]);
  return <span ref={ref}>{format(from)}</span>;
}

/**
 * La mini classifica: tu sotto, lui sopra; dopo un attimo lo passi e salite/scendete di posto.
 * Si muove solo con transform (layout), quindi resta fluida anche sui telefoni economici.
 * Toccandola si rivede.
 */
function MiniBoard({ t }: { t: PregameTarget }) {
  const { data, me } = useData();
  const b = t.board!;
  const reduce = useReducedMotion();
  const [passed, setPassed] = useState(!!reduce);
  const [round, setRound] = useState(0);
  const fmt = formatter(t);
  const rival = data.players.find((p) => p.id === b.rivalId);

  useEffect(() => {
    if (reduce) return;
    const timer = window.setTimeout(() => {
      setPassed(true);
      play("whoosh");
    }, 1250);
    return () => window.clearTimeout(timer);
  }, [round, reduce]);

  const rows = [
    {
      id: "rival",
      rank: passed ? b.rivalRank + 1 : b.rivalRank,
      player: rival,
      value: <>{fmt(b.rivalValue)}</>,
      mine: false,
    },
    {
      id: "me",
      rank: passed ? b.afterRank : b.myRank,
      player: me ?? undefined,
      value: <Morph from={b.myValue} to={b.after} run={passed} format={fmt} />,
      mine: true,
    },
  ];
  const ordered = passed ? [rows[1], rows[0]] : rows;

  return (
    <button
      type="button"
      className="relative mt-4 block w-full text-left"
      aria-label={`${b.label}, ${b.scope.label}: oggi sei ${b.myRank}°, con ${t.need} passi ${shortName(rival)} e diventi ${b.afterRank}°. Tocca per rivederlo`}
      onClick={() => {
        if (reduce) return;
        setPassed(false);
        setRound((r) => r + 1);
      }}
    >
      <span className="mb-1.5 block text-[12px] font-semibold text-white/70">
        {b.label} · {b.scope.label}
      </span>
      <ul className="space-y-1.5 [perspective:600px]" aria-hidden>
        {ordered.map((r) => (
          <motion.li
            key={r.id}
            layout={!reduce}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            initial={reduce ? false : { opacity: 0, rotateX: -35, y: 10 }}
            animate={{ opacity: 1, rotateX: 0, y: 0, scale: r.mine && passed ? 1.03 : 1 }}
            className={clsx(
              "flex h-11 items-center gap-2.5 rounded-2xl px-3",
              r.mine ? "preview-row-mine" : "preview-row text-white",
            )}
          >
            <span className="tnum w-7 shrink-0 text-[14px] font-bold">{r.rank}°</span>
            <Avatar player={r.player} size={28} href={false} ring="none" />
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
              {r.mine ? "Tu" : shortName(r.player)}
            </span>
            {r.mine && passed && (
              <motion.span
                initial={reduce ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.15 }}
                className="inline-flex items-center rounded-full bg-volt-ink/12 px-1.5 py-0.5 text-[11.5px] font-bold"
              >
                <IconArrowUpRight size={13} stroke={2.6} aria-hidden />
                {b.myRank - b.afterRank}
              </motion.span>
            )}
            <span className="tnum shrink-0 text-[15px] font-bold">{r.value}</span>
          </motion.li>
        ))}
      </ul>
    </button>
  );
}

/** Traguardi e record: la barra si riempie fino a te, poi il pezzo che manca si accende. */
function GoalBar({ t }: { t: PregameTarget }) {
  const reduce = useReducedMotion();
  const { from, to, record } = t.bar!;
  // Il record: la barra arriva al record di adesso (pareggio); il numero grande dice come batterlo.
  const end = t.kind === "record" && record ? record : to;
  const share = Math.max(0.06, Math.min(0.97, from / end));
  const label =
    t.kind === "record"
      ? `Record del gruppo in una partita`
      : t.stat === "partite"
        ? "Partite giocate"
        : t.stat === "vittorie"
          ? "Vittorie, da quando giochi"
          : `${cap(unitOf(t.stat, 2))}, da quando giochi`;
  return (
    <div className="relative mt-4 w-full text-left">
      <span className="mb-1.5 block text-[12px] font-semibold text-white/70">{label}</span>
      <div className="preview-row relative h-3.5 w-full overflow-hidden rounded-full">
        <motion.span
          className="absolute inset-y-0 left-0 origin-left rounded-full bg-white"
          style={{ width: `${share * 100}%` }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
        />
        <motion.span
          className="goal-glow absolute inset-y-0 origin-left rounded-r-full bg-volt"
          style={{ left: `${share * 100}%`, right: 0 }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay: 1.05 }}
        />
      </div>
      <div className="tnum mt-1.5 flex justify-between text-[12.5px] font-semibold text-white/80">
        <span>{t.kind === "record" ? `Tuo massimo ${from}` : from}</span>
        <span className="inline-flex items-center gap-1">
          {t.kind === "record" ? (
            <>
              <IconTrophy size={14} aria-hidden /> Record {record}
            </>
          ) : (
            <>
              <IconFlag size={14} aria-hidden /> {to}
            </>
          )}
        </span>
      </div>
    </div>
  );
}

/** Le altre cose alla portata, in una riga ciascuna. */
function Extra({ t, i }: { t: PregameTarget; i: number }) {
  const { data } = useData();
  const reduce = useReducedMotion();
  const rival = shortName(data.players.find((p) => p.id === t.board?.rivalId));
  const Icon = t.kind === "record" ? IconTrophy : t.kind === "traguardo" ? IconFlag : IconArrowUpRight;
  const what =
    t.stat === "campo" ? `${t.need} su ${t.attempts}` : `${t.need} ${unitOf(t.stat, t.need)}`;
  const rest =
    t.kind === "record"
      ? "e il record è tuo"
      : t.kind === "traguardo"
        ? `e arrivi a ${t.bar!.to}`
        : t.stat === "campo"
          ? `al tiro e passi ${rival}`
          : `e passi ${rival}`;
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, rotateX: -40, y: 14 }}
      animate={{ opacity: 1, rotateX: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: 1.5 + i * 0.12 }}
      className="preview-row flex items-center gap-2.5 rounded-2xl px-3 py-2 text-[13.5px] leading-snug"
    >
      <Icon size={17} className="shrink-0 text-volt" aria-hidden />
      {/* I nomi lunghissimi (anche senza spazi) vanno a capo invece di uscire. */}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        <span className="block">
          <b className="font-bold">{what}</b> {rest}
        </span>
        <span className="block text-[12px] text-white/65">
          {t.board
            ? `${t.board.label} · ${t.board.scope.label}`
            : t.kind === "record"
              ? "Record del gruppo in una partita"
              : "Da quando giochi"}
        </span>
      </span>
    </motion.li>
  );
}

/**
 * L'anteprima della partita, nel popup delle feste: quando si gioca, l'obiettivo più bello
 * alla portata con il numero preciso, la mini classifica che si muove, e fino a due altri.
 */
export function PregameBody({ proposal, targets }: { proposal: Proposal; targets: PregameTarget[] }) {
  const { data } = useData();
  const [main, ...others] = targets;
  const when = whenWord(proposal.startsAt);
  const name = (id?: string) => shortName(data.players.find((p) => p.id === id));
  const rival = name(main.board?.rivalId);
  const holder = (main.bar?.holderIds ?? []).map((id) => name(id)).join(" e ");
  // Il posto: per l'indoor il nome scritto nella proposta (es. "CH4"), come nella scheda della partita.
  const place = proposal.place
    ? proposal.place === "indoor" && proposal.address
      ? proposal.address.split(",")[0].trim()
      : placeLabel(proposal.place)
    : null;

  return (
    <>
      <p className="preview-row relative mx-auto inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[13.5px] font-semibold text-white">
        <IconCalendarEvent size={15} className="shrink-0 text-volt" aria-hidden />
        <span className="truncate">
          {cap(when)} alle {hhmm(proposal.startsAt)}
          {place && ` · ${place}`}
        </span>
      </p>
      <h2 id="party-title" className="display relative mt-1 text-[26px] leading-tight">
        {title(main)}
      </h2>
      <p className="relative mt-3 flex items-baseline justify-center gap-2">
        <span className="preview-num">
          <CountUp value={main.need} className="score text-[64px] leading-none" />
        </span>
        <span className="text-[20px] font-bold">
          {main.stat === "campo" ? `su ${main.attempts}` : unitOf(main.stat, main.need)}
        </span>
      </p>
      <p className="relative mt-1.5 text-[15px] font-semibold leading-snug text-white/90 [overflow-wrap:anywhere]">
        {line(main, rival)}
      </p>
      {main.kind === "sorpasso" ? <MiniBoard t={main} /> : <GoalBar t={main} />}
      <p className="relative mt-2 text-[12.5px] leading-snug text-white/70 [overflow-wrap:anywhere]">
        {note(main, rival, when, holder)}
      </p>
      {others.length > 0 && (
        <div className="relative mt-4 w-full text-left">
          <p className="mb-1.5 text-[12px] font-semibold text-white/70">Anche alla portata</p>
          <ul className="space-y-1.5 [perspective:600px]">
            {others.map((t, i) => (
              <Extra key={t.id} t={t} i={i} />
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
