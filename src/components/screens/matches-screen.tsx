"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Crown, Plus } from "lucide-react";
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
import { EmptyState, ScreenHeader, Segmented } from "@/components/ui/basics";
import { AvatarStack } from "@/components/ui/avatar";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, monthOf } from "@/lib/periods";
import { matchMvp } from "@/lib/stats/match-mvp";
import { teamOf } from "@/lib/stats/player";
import { shortName, winnerOf, type Match } from "@/lib/types";

const WEEKDAY = new Intl.DateTimeFormat("it-IT", { weekday: "short" });

/** Aperta da un'altra schermata (la Home): chiudendo si torna lì, non nella lista. */
const openedFromElsewhere = { current: false };
export function markMatchOpenedFromElsewhere() {
  openedFromElsewhere.current = true;
}

const MatchRow = memo(function MatchRow({
  m,
  onOpen,
  flat,
}: {
  m: Match;
  onOpen: (id: string) => void;
  /** Dentro una serata: senza ombra, per non avere una scheda dentro l'altra. */
  flat?: boolean;
}) {
  const { data, me } = useData();
  // I cambi in fondo, con il "+": "Matteo, Simone + Cande".
  const names = (t: "A" | "B") => {
    const line = m.players.filter((p) => p.team === t);
    const nm = (id: string) =>
      shortName(
        data.players.find((x) => x.id === id),
        data.players,
      );
    // L'ospite si vede come tale: "Matteo, ospite".
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
  const d = new Date(m.playedAt);
  return (
    <button
      onClick={() => onOpen(m.id)}
      data-testid="match-row"
      // Le righe fuori dallo schermo non si impaginano finché non ci arrivi: la lista resta leggera anche con centinaia di partite.
      className={clsx(
        "press flex w-full items-stretch gap-3 overflow-hidden p-0 text-left [contain-intrinsic-size:auto_86px] [content-visibility:auto]",
        flat ? "rounded-[18px] border-2 border-line-strong bg-surface" : "card",
      )}
    >
      <div
        className={clsx(
          "flex w-14 shrink-0 flex-col items-center justify-center border-r-2 border-edge",
          mine
            ? w === mine
              ? "bg-volt text-volt-ink"
              : "bg-raised"
            : "bg-raised",
        )}
      >
        <p className="num text-[24px]">{d.getDate()}</p>
        <p className="text-[11.5px] font-semibold opacity-75">
          {WEEKDAY.format(d)}
        </p>
      </div>
      <div className="min-w-0 flex-1 py-3">
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
                "score w-9 text-right text-[22px]",
                w === t ? "" : "text-faint",
              )}
            >
              {t === "A" ? m.scoreA : m.scoreB}
            </p>
          </div>
        ))}
        <p className="mt-1 flex items-center gap-1 truncate pl-[18px] text-[12px] text-faint">
          <span className="truncate">
            {m.format}
            {mvp ? (
              <>
                {" · "}
                <Crown
                  size={11}
                  className="inline align-[-1px] text-gold"
                  aria-hidden
                />{" "}
                MVP{" "}
                {shortName(
                  data.players.find((x) => x.id === mvp.playerId),
                  data.players,
                )}
              </>
            ) : m.players.some((p) => p.hasStats) ? (
              ", con statistiche"
            ) : (
              ""
            )}
            {mine ? (w === mine ? ". Hai vinto" : ". Hai perso") : ""}
          </span>
        </p>
      </div>
      <span className="w-3 shrink-0" />
    </button>
  );
});

const ONLY_KEY = "campetto:partite-solo-mie";

interface Night {
  key: string;
  items: Match[];
}

const NIGHT_DAY = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Una serata al campetto: il riassunto (giorno, quante partite, chi c'era, il tuo bilancio) e,
 * con un tocco, le partite di quella sera.
 */
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
  const day = NIGHT_DAY.format(new Date(night.items[0].playedAt));
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
  const n = night.items.length;
  return (
    <div className="card overflow-hidden" data-testid="night">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="press flex w-full items-center gap-3 px-3.5 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="title truncate text-[16px] first-letter:uppercase">
            {day}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {n} {n === 1 ? "partita" : "partite"}
            {won + lost > 0 && (
              <>
                {" · "}
                <span className="font-bold text-text">
                  tu {won}V {lost}S
                </span>
              </>
            )}
          </p>
        </div>
        <AvatarStack players={people} size={24} max={3} />
        <ChevronDown
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
            <div className="flex flex-col gap-2 border-t-2 border-dashed border-line-strong px-2.5 pb-2.5 pt-2.5">
              {night.items.map((m) => (
                <MatchRow key={m.id} m={m} onOpen={onOpen} flat />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <ScreenHeader
        title="Partite"
        subtitle={
          data.matches.length
            ? `${data.matches.length} ${data.matches.length === 1 ? "giocata" : "giocate"}`
            : undefined
        }
        action={
          me?.isAdmin ? (
            <Link
              href="/nuova"
              aria-label="Aggiungi partita"
              data-tour="matches-add"
              className="sticker press flex h-11 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-bold text-ball-ink"
            >
              <Plus size={18} strokeWidth={2.6} /> Aggiungi
            </Link>
          ) : undefined
        }
      />
      {data.matches.length > 0 && me && (
        <div className="shrink-0 px-5 pb-2">
          <Segmented
            size="sm"
            value={only}
            onChange={pickOnly}
            options={[
              { value: "tutte" as const, label: "Tutte" },
              { value: "mie" as const, label: "Le mie" },
            ]}
          />
        </div>
      )}
      <PullToRefresh className="px-5 pb-4 pt-1">
        <div data-tour="matches-list">
          {loading && !data.matches.length ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[84px]" />
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
              <section key={g.label} className="mb-4">
                {/* Il mese resta in cima mentre scorri, come nei calendari. */}
                <h2 className="title sticky -top-1 z-10 -mx-1 mb-2 bg-bg/95 px-2 pb-1.5 pt-2.5 text-[16px] backdrop-blur-sm">
                  {g.label}
                </h2>
                <div className="flex flex-col gap-2.5">
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
