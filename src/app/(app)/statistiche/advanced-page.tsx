"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { defaultPeriod } from "@/components/period-picker";
import { ShotChart, TIER_TINT, ZONE_NAME } from "@/components/stats/shot-chart";
import {
  Chips,
  EmptyState,
  fmt,
  pct,
  ScreenHeader,
  signed,
} from "@/components/ui/basics";
import { useData } from "@/lib/data/provider";
import { filterMatches, type Period } from "@/lib/periods";
import { eloOf } from "@/lib/stats/elo";
import { computePlayerStats, normalizeBox } from "@/lib/stats/player";
import {
  assistSplit,
  groupZones,
  pctTone,
  shotZones,
  zoneTier,
  type ZoneKey,
} from "@/lib/stats/zones";
import { shortName, type Match } from "@/lib/types";

type Tab = "tiro" | "gioco" | "impatto" | "record";
type PeriodKind = Period["kind"];

const TIER_LABEL = [
  "Pochi tiri",
  "Bronzo",
  "Argento",
  "Oro",
  "Hall of Fame",
] as const;
const TONE_TEXT = {
  bad: "text-danger",
  mid: "text-[#b07900] dark:text-[#f0b429]",
  good: "text-ok",
  none: "text-faint",
} as const;

/** Il meglio in una sola partita. */
function bests(playerId: string, matches: Match[]) {
  const b = { pts: 0, reb: 0, ast: 0, fg3m: 0, stl: 0, blk: 0 };
  for (const m of matches) {
    const line = m.players.find((p) => p.playerId === playerId && p.hasStats);
    if (!line) continue;
    const x = normalizeBox(line.box);
    b.pts = Math.max(b.pts, x.pts);
    b.reb = Math.max(b.reb, x.oreb + x.dreb);
    b.ast = Math.max(b.ast, x.ast);
    b.fg3m = Math.max(b.fg3m, x.fg3m);
    b.stl = Math.max(b.stl, x.stl);
    b.blk = Math.max(b.blk, x.blk);
  }
  return b;
}

const TONE_BG = {
  bad: "bg-danger",
  mid: "bg-[#f0b429]",
  good: "bg-ok",
  none: "bg-faint",
} as const;

function Compare({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-14 shrink-0 text-[12px] font-semibold text-muted">
        {label}
      </span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
        <span
          className={clsx(
            "block h-full rounded-full transition-[width] duration-500",
            TONE_BG[tone],
          )}
          style={{ width: `${(value ?? 0) * 100}%` }}
        />
      </span>
      <span className="num w-10 shrink-0 text-right text-[14px]">
        {value === null ? "—" : `${Math.round(value * 100)}%`}
      </span>
    </div>
  );
}

interface Item {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
}

function Tile({
  value,
  label,
  sub,
  weight,
}: Item & { weight: "hero" | "main" | "minor" }) {
  const long = typeof value === "string" && value.length > 6;
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-[12px] font-semibold text-muted">
        {label}
      </span>
      <span
        className={clsx(
          "num mt-1 block max-w-full truncate whitespace-nowrap leading-none",
          weight === "hero" && "text-[32px] text-ball",
          weight === "main" && (long ? "text-[17px]" : "text-[24px]"),
          weight === "minor" && (long ? "text-[15px]" : "text-[19px]"),
        )}
      >
        {value}
      </span>
      {sub && (
        <span className="mt-1 truncate text-[11px] text-faint">{sub}</span>
      )}
    </div>
  );
}

function Board({ main, minor }: { main: Item[]; minor: Item[] }) {
  return (
    <>
      <div className="grid grid-cols-3 items-end gap-3">
        {main.map((it, i) => (
          <Tile key={it.label} {...it} weight={i === 0 ? "hero" : "main"} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
        {minor.map((it) => (
          <Tile key={it.label} {...it} weight="minor" />
        ))}
      </div>
    </>
  );
}

const CARD = "rounded-[22px] bg-surface shadow-[var(--shadow)]";

const PERIODS: { value: PeriodKind; label: string }[] = [
  { value: "month", label: "Questo mese" },
  { value: "season", label: "Stagione" },
  { value: "all", label: "Sempre" },
];

const TABS: { value: Tab; label: string }[] = [
  { value: "tiro", label: "Tiro" },
  { value: "gioco", label: "Gioco" },
  { value: "impatto", label: "Impatto" },
  { value: "record", label: "Record" },
];

/**
 * Le statistiche avanzate di un giocatore: la mappa di tiro da toccare (da sotto, dalla
 * media, da tre) e, sotto, i numeri divisi in quattro gruppi. Tutto in una schermata.
 */
export function AdvancedPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, me, engine } = useData();
  const id = params.get("id") ?? me?.id ?? "";
  const player = data.players.find((p) => p.id === id);
  const [kind, setKind] = useState<PeriodKind>("all");
  const [zone, setZone] = useState<ZoneKey>("sotto");
  const [tab, setTab] = useState<Tab>("tiro");

  const period = useMemo(() => defaultPeriod(kind), [kind]);
  const scoped = useMemo(
    () => filterMatches(data.matches, { period, format: "all" }),
    [data.matches, period],
  );
  const s = useMemo(() => computePlayerStats(id, scoped), [id, scoped]);
  const zones = useMemo(() => shotZones(id, scoped), [id, scoped]);
  const group = useMemo(() => groupZones(scoped), [scoped]);
  const split = useMemo(() => assistSplit(id, scoped), [id, scoped]);
  const best = useMemo(() => bests(id, scoped), [id, scoped]);

  if (!player)
    return (
      <EmptyState
        title="Giocatore non trovato"
        text="Forse è stato tolto dal gruppo"
      />
    );

  const z = zones[zone];
  const zp = z.att ? z.made / z.att : null;
  const tier = zoneTier(z);
  const g = group[zone];
  const gp = g.att ? g.made / g.att : null;
  const has = s.statGames > 0;
  const possessions = s.fga + s.totals.tov;
  const made = split ? split.assisted + split.alone : 0;

  const name = (pid: string) =>
    shortName(
      data.players.find((p) => p.id === pid),
      data.players,
    );
  const tiles: Record<Tab, ReactNode> = {
    tiro: (
      <Board
        main={[
          {
            value: pct(s.fgPct),
            label: "Al tiro",
            sub: `${s.fgm} su ${s.fga}`,
          },
          { value: pct(s.efgPct), label: "Tiro effettivo" },
          {
            value: s.fga ? fmt(s.totals.pts / s.fga, 2) : "—",
            label: "Punti per tiro",
          },
        ]}
        minor={[
          {
            value: has ? fmt(s.fga / s.statGames) : "—",
            label: "Tiri a partita",
          },
          {
            value: split && made ? pct(split.assisted / made) : "—",
            label: "Su assist",
            sub: split && made ? `${split.assisted} su ${made}` : undefined,
          },
          {
            value: split && made ? pct(split.alone / made) : "—",
            label: "Da solo",
            sub: split && made ? `${split.alone} su ${made}` : undefined,
          },
        ]}
      />
    ),
    gioco: (
      <Board
        main={[
          {
            value: possessions ? fmt(s.totals.pts / possessions, 2) : "—",
            label: "Punti per possesso",
          },
          { value: has ? fmt(s.avg.ast) : "—", label: "Assist a partita" },
          {
            value: s.astTov !== null ? fmt(s.astTov, 1) : "—",
            label: "Assist per persa",
          },
        ]}
        minor={[
          {
            value: has ? `${fmt(s.avg.oreb)} · ${fmt(s.avg.dreb)}` : "—",
            label: "Rimbalzi",
            sub: "attacco · difesa",
          },
          {
            value: split?.bestTarget ? name(split.bestTarget.id) : "—",
            label: "Passa di più a",
            sub: split?.bestTarget ? `${split.bestTarget.n} assist` : undefined,
          },
          {
            value: split?.bestPasser ? name(split.bestPasser.id) : "—",
            label: "Riceve di più da",
            sub: split?.bestPasser ? `${split.bestPasser.n} assist` : undefined,
          },
        ]}
      />
    ),
    impatto: (
      <Board
        main={[
          {
            value: s.games ? signed(s.plusMinusAvg, 1) : "—",
            label: "+/− a partita",
          },
          {
            value: s.games ? pct(s.winPct) : "—",
            label: "Vittorie",
            sub: `${s.wins} su ${s.games}`,
          },
          { value: eloOf(engine.elo, id), label: "ELO" },
        ]}
        minor={[
          {
            value: s.games ? fmt(s.pointsFor / s.games) : "—",
            label: "Punti fatti",
            sub: "dalla squadra",
          },
          {
            value: s.games ? fmt(s.pointsAgainst / s.games) : "—",
            label: "Punti subiti",
            sub: "dalla squadra",
          },
          { value: has ? fmt(s.effAvg) : "—", label: "Voto medio" },
        ]}
      />
    ),
    record: (
      <Board
        main={[
          { value: best.pts, label: "Punti" },
          { value: best.reb, label: "Rimbalzi" },
          { value: best.ast, label: "Assist" },
        ]}
        minor={[
          { value: best.fg3m, label: "Triple" },
          { value: best.stl, label: "Rubate" },
          { value: best.blk, label: "Stoppate" },
        ]}
      />
    ),
  };

  return (
    <>
      <ScreenHeader title="Statistiche" back={() => router.back()} />
      <main className="scroll-area flex min-h-0 flex-1 flex-col gap-5 px-5 pb-6 pt-1">
        <div className="shrink-0">
          <Chips value={kind} onChange={setKind} options={PERIODS} scroll />
        </div>

        {!has ? (
          <EmptyState
            title="Ancora nessun tiro"
            text="La mappa si colora con le partite che hanno il tabellino"
          />
        ) : (
          <>
            <section className="shrink-0" data-tour="stats-court">
              <div className={clsx(CARD, "overflow-hidden")}>
                <ShotChart zones={zones} selected={zone} onSelect={setZone} />
                <div className="px-4 pb-4 pt-3.5" aria-live="polite">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold">
                      {ZONE_NAME[zone]} ·{" "}
                      <span className="text-muted">
                        {z.att ? `${z.made} su ${z.att}` : "nessun tiro"}
                      </span>
                    </p>
                    <span
                      className="shrink-0 rounded-full bg-raised px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
                      style={{
                        background: tier ? `${TIER_TINT[tier]}40` : undefined,
                      }}
                    >
                      {TIER_LABEL[tier]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <span
                      className={clsx(
                        "num shrink-0 text-[44px] leading-none",
                        TONE_TEXT[pctTone(zp)],
                      )}
                    >
                      {zp === null ? "—" : Math.round(zp * 100)}
                      {zp !== null && <span className="text-[20px]">%</span>}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Compare label="Tu" value={zp} tone={pctTone(zp)} />
                      <Compare label="Gruppo" value={gp} tone="none" />
                    </div>
                  </div>
                </div>
                {zones.unknown2 > 0 && (
                  <p className="border-t border-line px-4 py-2 text-[11.5px] text-faint">
                    {zones.unknown2} tiri da 2 senza zona, fuori dalla mappa
                  </p>
                )}
              </div>
            </section>

            <section className="flex shrink-0 flex-col gap-2.5">
              <Chips value={tab} onChange={setTab} options={TABS} scroll />
              <div
                key={tab}
                className={clsx(CARD, "tab-enter-right px-4 py-4")}
              >
                {tiles[tab]}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
