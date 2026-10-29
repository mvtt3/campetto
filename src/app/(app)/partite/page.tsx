"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { Suspense, useMemo } from "react";
import { MatchSheet } from "@/components/match-sheet";
import { EmptyState, ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, monthOf } from "@/lib/periods";
import { teamOf } from "@/lib/stats/player";
import { shortName, winnerOf, type Match } from "@/lib/types";

function MatchRow({ m, onOpen, index }: { m: Match; onOpen: () => void; index: number }) {
  const { data, me } = useData();
  const names = (t: "A" | "B") =>
    m.players
      .filter((p) => p.team === t)
      .map((p) => shortName(data.players.find((x) => x.id === p.playerId), data.players))
      .join(", ");
  const w = winnerOf(m);
  const mine = me ? teamOf(m, me.id) : null;
  const d = new Date(m.playedAt);
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.035 }}
      onClick={onOpen}
      data-testid="match-row"
      className="card press flex w-full items-stretch gap-3 overflow-hidden p-0 text-left"
    >
      <div className={clsx("flex w-14 shrink-0 flex-col items-center justify-center border-r-2 border-edge", mine ? (w === mine ? "bg-volt text-volt-ink" : "bg-raised") : "bg-raised")}>
        <p className="num text-[24px]">{d.getDate()}</p>
        <p className="text-[11.5px] font-semibold opacity-75">{d.toLocaleDateString("it-IT", { weekday: "short" })}</p>
      </div>
      <div className="min-w-0 flex-1 py-3">
        {(["A", "B"] as const).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className={clsx("h-2.5 w-2.5 shrink-0 rounded-full", t === "A" ? "bg-court" : "bg-ball")} />
            <p className={clsx("min-w-0 flex-1 truncate text-[14.5px]", w === t ? "font-bold" : "text-muted")}>{names(t)}</p>
            <p className={clsx("score w-9 text-right text-[22px]", w === t ? "" : "text-faint")}>{t === "A" ? m.scoreA : m.scoreB}</p>
          </div>
        ))}
        <p className="mt-1 pl-[18px] text-[12px] text-faint">
          {m.format}
          {m.players.some((p) => p.hasStats) ? ", con statistiche" : ""}
          {mine ? (w === mine ? ". Hai vinto" : ". Hai perso") : ""}
        </p>
      </div>
      <span className="w-3 shrink-0" />
    </motion.button>
  );
}

function MatchesInner() {
  const { data, loading, me } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("m");

  const groups = useMemo(() => {
    const out: { label: string; items: Match[] }[] = [];
    for (const m of data.matches) {
      const { year, month } = monthOf(m.playedAt);
      const label = monthLabel(year, month);
      const g = out[out.length - 1];
      if (g?.label === label) g.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [data.matches]);

  const open = data.matches.find((m) => m.id === openId) ?? null;
  let idx = 0;

  return (
    <>
      <ScreenHeader
        title="Partite"
        subtitle={data.matches.length ? `${data.matches.length} ${data.matches.length === 1 ? "giocata" : "giocate"}` : undefined}
        action={
          me?.isAdmin ? (
            <Link href="/nuova" aria-label="Aggiungi partita" className="sticker press flex h-11 items-center gap-1.5 rounded-full bg-ball px-4 text-[14px] font-bold text-ball-ink">
              <Plus size={18} strokeWidth={2.6} /> Aggiungi
            </Link>
          ) : undefined
        }
      />
      <PullToRefresh className="px-5 pb-4 pt-1">
        {loading && !data.matches.length ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[84px]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="Ancora nessuna partita"
            text={me?.isAdmin ? "Aggiungi la prima: bastano squadre e risultato." : "Appena Matteo inserisce le partite, le trovi qui con tutte le statistiche."}
            action={
              me?.isAdmin ? (
                <Link href="/nuova" className="sticker press inline-flex h-12 items-center rounded-full bg-ball px-6 font-bold text-ball-ink">
                  Aggiungi partita
                </Link>
              ) : undefined
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-5">
              <h2 className="title mb-2 px-1 text-[16px]">{g.label}</h2>
              <div className="flex flex-col gap-2">
                {g.items.map((m) => (
                  <MatchRow key={m.id} m={m} index={idx++} onOpen={() => router.push(`/partite?m=${m.id}`, { scroll: false })} />
                ))}
              </div>
            </section>
          ))
        )}
      </PullToRefresh>
      <MatchSheet match={open} onClose={() => router.replace("/partite", { scroll: false })} />
    </>
  );
}

export default function MatchesPage() {
  return (
    <Suspense>
      <MatchesInner />
    </Suspense>
  );
}
