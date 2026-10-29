"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, ClipboardPaste, Video } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { MatchSheet } from "@/components/match-sheet";
import { Chips, EmptyState, ScreenHeader } from "@/components/ui/basics";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useData } from "@/lib/data/provider";
import { monthLabel, monthOf } from "@/lib/periods";
import { teamOf } from "@/lib/stats/player";
import { FORMATS, shortName, winnerOf, type Format, type Match } from "@/lib/types";

function MatchRow({ m, onOpen }: { m: Match; onOpen: () => void }) {
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
    <button
      onClick={onOpen}
      data-testid="match-row"
      className="flex w-full items-center gap-3 rounded-[18px] bg-surface px-3.5 py-3 text-left ring-1 ring-line ring-inset active:bg-raised"
    >
      <div className="w-11 shrink-0 text-center">
        <p className="num text-[22px]">{d.getDate()}</p>
        <p className="text-[11px] text-muted">{d.toLocaleDateString("it-IT", { weekday: "short" })}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className={clsx("truncate text-[14px]", w === "A" ? "font-semibold" : "text-muted")}>{names("A")}</p>
        <p className={clsx("truncate text-[14px]", w === "B" ? "font-semibold" : "text-muted")}>{names("B")}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-faint">
          {m.format}
          {m.players.some((p) => p.hasStats) && <span>con tabellino</span>}
          {m.confirmedBy && <BadgeCheck size={13} className="text-ok" aria-label="Confermata" />}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-[20px]">
          <span className={w === "A" ? "" : "text-muted"}>{m.scoreA}</span>
        </p>
        <p className="num text-[20px]">
          <span className={w === "B" ? "" : "text-muted"}>{m.scoreB}</span>
        </p>
      </div>
      {mine && (
        <span
          className={clsx(
            "ml-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold",
            w === mine ? "bg-ok/15 text-ok" : "bg-raised text-faint",
          )}
          aria-label={w === mine ? "Vinta" : "Persa"}
        >
          {w === mine ? "V" : "S"}
        </span>
      )}
    </button>
  );
}

function MatchesInner() {
  const { data, loading } = useData();
  const router = useRouter();
  const params = useSearchParams();
  const openId = params.get("m");
  const [format, setFormat] = useState<Format | "all">("all");

  const groups = useMemo(() => {
    const list = data.matches.filter((m) => format === "all" || m.format === format);
    const out: { label: string; items: Match[] }[] = [];
    for (const m of list) {
      const { year, month } = monthOf(m.playedAt);
      const label = monthLabel(year, month);
      const g = out[out.length - 1];
      if (g?.label === label) g.items.push(m);
      else out.push({ label, items: [m] });
    }
    return out;
  }, [data.matches, format]);

  const open = data.matches.find((m) => m.id === openId) ?? null;

  return (
    <>
      <ScreenHeader
        title="Partite"
        action={
          <div className="flex gap-1">
            <Link href="/video" aria-label="Segna dal video" className="grid h-11 w-11 place-items-center rounded-full text-text active:bg-raised">
              <Video size={22} />
            </Link>
            <Link href="/importa" aria-label="Importa statistiche" className="grid h-11 w-11 place-items-center rounded-full text-text active:bg-raised">
              <ClipboardPaste size={21} />
            </Link>
          </div>
        }
      />
      <div className="shrink-0 px-4 pb-3">
        <Chips
          value={format}
          onChange={setFormat}
          options={[{ value: "all" as const, label: "Tutte" }, ...FORMATS.map((f) => ({ value: f, label: f }))]}
        />
      </div>
      <PullToRefresh className="px-4 pb-4">
        {loading && !data.matches.length ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[76px]" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title={format === "all" ? "Ancora nessuna partita" : `Nessuna partita in ${format}`}
            text="Gioca la prima e segna il risultato: bastano pochi secondi."
            action={
              <Link href="/nuova" className="inline-flex h-12 items-center rounded-[14px] bg-ball px-5 font-semibold text-ball-ink">
                Nuova partita
              </Link>
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-4">
              <h2 className="mb-2 px-1 text-[13px] font-semibold text-muted">
                {g.label}, {g.items.length} {g.items.length === 1 ? "partita" : "partite"}
              </h2>
              <div className="flex flex-col gap-2">
                {g.items.map((m) => (
                  <MatchRow key={m.id} m={m} onOpen={() => router.push(`/partite?m=${m.id}`, { scroll: false })} />
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
