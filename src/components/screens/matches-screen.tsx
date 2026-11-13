"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  IconChevronDown,
  IconChevronRight,
  IconCrown,
  IconPlus,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import {
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MatchSheet } from "@/components/match-sheet";
import { NightHighlightsButton } from "@/components/highlights/entry";
import { StudioShowLoader } from "@/components/studio/studio-show";
import {
  setStudioSeen,
  StudioNightBadge,
  studioSeen,
  useStudioEpisode,
} from "@/components/studio/studio-entry";
import { EmptyState, Segmented } from "@/components/ui/basics";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, monthOf } from "@/lib/periods";
import { matchMvp } from "@/lib/stats/match-mvp";
import { teamOf } from "@/lib/stats/player";
import { shortName, winnerOf, type Match } from "@/lib/types";

const WEEKDAY = new Intl.DateTimeFormat("it-IT", { weekday: "short" });
const MONTH = new Intl.DateTimeFormat("it-IT", { month: "long" });

/** Aperta da un'altra schermata (la Home): chiudendo si torna lì, non nella lista. */
const openedFromElsewhere = { current: false };
export function markMatchOpenedFromElsewhere() {
  openedFromElsewhere.current = true;
}

const countLabel = (n: number) => `${n} ${n === 1 ? "partita" : "partite"}`;

const PILL = "rounded-full px-2 py-0.5 text-[11.5px] font-semibold";

const MatchRow = memo(function MatchRow({
  m,
  onOpen,
}: {
  m: Match;
  onOpen: (id: string) => void;
}) {
  const { data, me } = useData();
  const nm = (id: string) =>
    shortName(
      data.players.find((x) => x.id === id),
      data.players,
    );
  const names = (t: "A" | "B") => {
    const line = m.players.filter((p) => p.team === t);
    const guests = (m.guests ?? []).filter((p) => p.team === t).length;
    const base = [
      ...line.filter((p) => !p.sub).map((p) => nm(p.playerId)),
      ...Array.from({ length: guests }, () => "ospite"),
    ].join(", ");
    const subs = line.filter((p) => p.sub).map((p) => nm(p.playerId));
    return subs.length ? `${base} + ${subs.join(", ")}` : base;
  };
  const w = winnerOf(m);
  const mine = me ? teamOf(m, me.id) : null;
  const mvp = matchMvp(m);
  const mvpPlayer = mvp
    ? data.players.find((x) => x.id === mvp.playerId)
    : undefined;
  return (
    <button
      onClick={() => onOpen(m.id)}
      data-testid="match-row"
      className="press flex w-full items-center gap-2 rounded-[18px] bg-raised px-3.5 py-3 text-left [contain-intrinsic-size:auto_96px] [content-visibility:auto]"
    >
      <div className="min-w-0 flex-1">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span
              className={clsx(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                t === "A" ? "bg-court" : "bg-ball",
              )}
            />
            <p
              className={clsx(
                "min-w-0 flex-1 truncate text-[14.5px]",
                w === t ? "font-bold" : "text-muted",
              )}
            >
              {names(t)}
            </p>
            <p
              className={clsx(
                "score w-10 text-right text-[24px] leading-tight",
                w !== t && "text-faint",
              )}
            >
              {t === "A" ? m.scoreA : m.scoreB}
            </p>
          </div>
        ))}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {mine && (
            <span
              className={clsx(
                PILL,
                w === mine ? "bg-ok/15 text-ok" : "bg-danger/12 text-danger",
              )}
            >
              {w === mine ? "Hai vinto" : "Hai perso"}
            </span>
          )}
          <span className={clsx(PILL, "bg-surface text-muted")}>
            {m.format}
          </span>
          {mvp ? (
            <span className="flex items-center gap-1.5 rounded-full bg-gold-soft py-0.5 pl-0.5 pr-2.5">
              <span className="relative">
                <Avatar player={mvpPlayer} size={20} href={false} ring="none" />
                <IconCrown
                  size={11}
                  className="absolute -right-1 -top-1.5 rotate-12 fill-gold text-gold"
                  aria-hidden
                />
              </span>
              <span className="text-[11.5px] font-bold">
                {nm(mvp.playerId)}
              </span>
              <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-gold">
                MVP
              </span>
            </span>
          ) : (
            m.players.some((p) => p.hasStats) && (
              <span className={clsx(PILL, "bg-surface text-muted")}>
                Con statistiche
              </span>
            )
          )}
        </div>
      </div>
    </button>
  );
});

const ONLY_KEY = "campetto:partite-solo-mie";

interface Night {
  key: string;
  items: Match[];
}

function NightCard({
  night,
  open,
  onToggle,
  onOpen,
}: {
  night: Night;
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const { data, me } = useData();
  const at = new Date(night.items[0].playedAt);
  // La puntata dello Studio di questa serata, se c'è: si apre dal bollino e si richiude da sola.
  const day = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
  const episode = useStudioEpisode(day);
  const [studio, setStudio] = useState(false);
  const ids = new Set(
    night.items.flatMap((m) => m.players.map((l) => l.playerId)),
  );
  const people = data.players.filter((p) => ids.has(p.id));
  let won = 0;
  let lost = 0;
  if (me)
    for (const m of night.items) {
      const t = teamOf(m, me.id);
      if (!t) continue;
      if (winnerOf(m) === t) won++;
      else lost++;
    }
  return (
    <div
      className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow)]"
      data-testid="night"
    >
      <button
        type="button"
        onClick={(e) => {
          if (episode && (e.target as HTMLElement).closest("[data-studio-badge]")) {
            setStudioSeen(episode.id);
            setStudio(true);
            return;
          }
          onToggle();
        }}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="flex h-[58px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[16px] bg-raised">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] opacity-70">
            {WEEKDAY.format(at)}
          </span>
          <span className="num text-[22px] leading-none">{at.getDate()}</span>
          <span className="sr-only">{MONTH.format(at)}</span>
        </div>
        <div className="min-w-0 flex-1">
          {episode ? (
            <div className="flex min-w-0 items-center gap-2">
              <p className="title truncate text-[16px]">
                {countLabel(night.items.length)}
              </p>
              <StudioNightBadge fresh={!studio && !studioSeen(episode.id)} />
            </div>
          ) : (
            <p className="title truncate text-[16px]">
              {countLabel(night.items.length)}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1.5">
            {won + lost > 0 && (
              <span
                aria-label={`Tu: ${won} ${won === 1 ? "vinta" : "vinte"}, ${lost} ${lost === 1 ? "persa" : "perse"}`}
                className={clsx(
                  PILL,
                  "tnum shrink-0 whitespace-nowrap",
                  won > lost
                    ? "bg-ok/15 text-ok"
                    : won < lost
                      ? "bg-danger/12 text-danger"
                      : "bg-raised text-muted",
                )}
              >
                Tu {won}V {lost}S
              </span>
            )}
            <span className="truncate text-[12.5px] text-muted">
              {people.length} giocatori
            </span>
          </div>
        </div>
        <AvatarStack players={people} size={26} max={3} />
        <IconChevronDown
          size={18}
          className={clsx(
            "shrink-0 text-faint transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 border-t border-line p-3">
              {night.items.map((m) => (
                <MatchRow key={m.id} m={m} onOpen={onOpen} />
              ))}
              <NightHighlightsButton matchIds={night.items.map((m) => m.id)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {studio && episode && (
        <StudioShowLoader id={episode.id} onClose={() => setStudio(false)} />
      )}
    </div>
  );
}

function MatchesInner() {
  const { data, loading, me } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const path = usePathname();
  // La scheda resta montata anche quando è nascosta: il dettaglio si apre solo qui.
  const openId = path === "/partite" ? params.get("m") : null;

  // "Tutte" o solo "Le mie": si ricorda la scelta.
  const [only, setOnly] = useState<"tutte" | "mie">("tutte");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(ONLY_KEY) === "mie") setOnly("mie");
    } catch {
      /* ignore */
    }
  }, []);
  const pickOnly = (v: "tutte" | "mie") => {
    setOnly(v);
    try {
      localStorage.setItem(ONLY_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const shown = useMemo(
    () =>
      only === "mie" && me
        ? data.matches.filter((m) => teamOf(m, me.id))
        : data.matches,
    [data.matches, only, me],
  );
  // Mese → serate (un giorno al campetto) → partite.
  const groups = useMemo(() => {
    const out: { label: string; nights: Night[] }[] = [];
    for (const m of shown) {
      const { year, month } = monthOf(m.playedAt);
      const label = monthLabel(year, month);
      let g = out[out.length - 1];
      if (g?.label !== label) out.push((g = { label, nights: [] }));
      const key = new Date(m.playedAt).toDateString();
      const n = g.nights[g.nights.length - 1];
      if (n?.key === key) n.items.push(m);
      else g.nights.push({ key, items: [m] });
    }
    return out;
  }, [shown]);
  // Aperta di partenza: la serata più recente. Le altre si aprono con un tocco.
  const latest = groups[0]?.nights[0]?.key ?? null;
  const [openNights, setOpenNights] = useState<Set<string> | null>(null);
  const isOpen = (key: string) =>
    openNights ? openNights.has(key) : key === latest;
  const toggleNight = (key: string) =>
    setOpenNights((cur) => {
      const next = new Set(cur ?? (latest ? [latest] : []));
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const open = data.matches.find((m) => m.id === openId) ?? null;
  // Aperto da qui: chiudere torna indietro, così il tasto "indietro" del telefono non ripassa dalla stessa pagina.
  const pushed = useRef(false);
  const openMatch = useCallback(
    (id: string) => {
      pushed.current = true;
      router.push(`/partite?m=${id}`, { scroll: false });
    },
    [router],
  );
  const closeMatch = useCallback(() => {
    // Già chiuso (per esempio col tasto indietro): non fare niente.
    if (!new URLSearchParams(window.location.search).has("m")) {
      pushed.current = false;
      return;
    }
    if (pushed.current || openedFromElsewhere.current) {
      pushed.current = false;
      openedFromElsewhere.current = false;
      router.back();
    } else router.replace("/partite", { scroll: false });
  }, [router]);

  return (
    <>
      <div className="safe-top shrink-0 px-5 pb-3 pt-5">
        <h1 className="sr-only">Partite</h1>
        {data.matches.length > 0 && me && (
          <Segmented
            value={only}
            onChange={pickOnly}
            options={[
              { value: "tutte" as const, label: "Tutte" },
              { value: "mie" as const, label: "Le mie" },
            ]}
          />
        )}
      </div>
      <PullToRefresh className="px-5 pb-4 pt-1">
        {me?.isAdmin && (
          <Link
            href="/nuova"
            data-tour="matches-add"
            className="card press mb-4 flex w-full items-center gap-3.5 p-3"
          >
            <span className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-[18px] bg-ball text-ball-ink">
              <IconPlus size={24} strokeWidth={2.6} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="title block text-[16px]">
                Aggiungi una partita
              </span>
              <span className="block truncate text-[13px] text-muted">
                Squadre e risultato
              </span>
            </span>
            <IconChevronRight
              size={20}
              className="shrink-0 text-faint"
              aria-hidden
            />
          </Link>
        )}
        <div data-tour="matches-list">
          {loading && !data.matches.length ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[82px] rounded-[22px]" />
              ))}
            </div>
          ) : groups.length === 0 && data.matches.length > 0 ? (
            <EmptyState
              title="Non hai ancora giocato"
              text="Le partite in cui giochi le trovi qui. Intanto guarda tutte quelle del gruppo"
              action={
                <button
                  onClick={() => pickOnly("tutte")}
                  className="sticker press inline-flex h-12 items-center rounded-full bg-ball px-6 font-bold text-ball-ink"
                >
                  Vedi tutte
                </button>
              }
            />
          ) : groups.length === 0 ? (
            <EmptyState
              title="Ancora nessuna partita"
              text={
                me?.isAdmin
                  ? "Aggiungi la prima: bastano squadre e risultato"
                  : "Appena Matteo inserisce le partite, le trovi qui con tutte le statistiche"
              }
              action={
                me?.isAdmin ? (
                  <Link
                    href="/nuova"
                    className="sticker press inline-flex h-12 items-center rounded-full bg-ball px-6 font-bold text-ball-ink"
                  >
                    Aggiungi partita
                  </Link>
                ) : undefined
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mb-5">
                <h2 className="sticky top-1 z-10 mb-2.5 flex">
                  <span className="flex items-center gap-2 rounded-full bg-surface py-1.5 pl-3.5 pr-1.5 shadow-[var(--shadow)]">
                    <span className="title text-[14px] first-letter:uppercase">
                      {g.label}
                    </span>
                    <span className="tnum rounded-full bg-raised px-2 py-0.5 text-[11.5px] font-semibold text-muted">
                      {countLabel(
                        g.nights.reduce((t, x) => t + x.items.length, 0),
                      )}
                    </span>
                  </span>
                </h2>
                <div className="flex flex-col gap-3">
                  {g.nights.map((n) => (
                    <NightCard
                      key={n.key}
                      night={n}
                      open={isOpen(n.key)}
                      onToggle={() => toggleNight(n.key)}
                      onOpen={openMatch}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </PullToRefresh>
      <MatchSheet match={open} onClose={closeMatch} />
    </>
  );
}

export function MatchesScreen() {
  return (
    <Suspense>
      <MatchesInner />
    </Suspense>
  );
}
