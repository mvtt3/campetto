"use client";

import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { defaultPeriod } from "@/components/period-picker";
import { Group, Row, Stat } from "@/components/profile/stats-dashboard";
import { Avatar } from "@/components/ui/avatar";
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

function Partner({
  label,
  playerId,
  n,
}: {
  label: string;
  playerId: string | null;
  n: number;
}) {
  const { data } = useData();
  const p = playerId ? data.players.find((x) => x.id === playerId) : undefined;
  return (
    <div className="flex items-center gap-2 border-b border-line py-2 first:pt-0 last:border-b-0 last:pb-0">
      <Avatar player={p} size={26} href={false} ring="none" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-semibold text-muted">
          {label}
        </span>
        <span className="block truncate text-[13px] font-semibold">
          {p ? shortName(p, data.players) : "—"}
        </span>
      </span>
      {p && <span className="num shrink-0 text-[15px]">{n}</span>}
    </div>
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
  const totalShots = zones.sotto.att + zones.media.att + zones.tre.att;
  const share = totalShots ? z.att / totalShots : null;
  const g = group[zone];
  const gp = g.att ? g.made / g.att : null;
  const has = s.statGames > 0;
  const possessions = s.fga + s.totals.tov;
  const made = split ? split.assisted + split.alone : 0;

  const plus = s.games ? s.plusMinusAvg : null;
  const tiles: Record<Tab, ReactNode> = {
    tiro: (
      <>
        <Group title="Precisione">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-3">
            <Stat
              big
              value={pct(s.fgPct)}
              label="Al tiro"
              sub={`${s.fgm} su ${s.fga}`}
            />
            <Stat value={pct(s.efgPct)} label="Tiro effettivo" />
            <Stat
              value={s.fga ? fmt(s.totals.pts / s.fga, 2) : "—"}
              label="Punti per tiro"
            />
          </div>
        </Group>
        <div className="grid grid-cols-2 gap-2.5">
          <Group title="Volume">
            <Stat
              value={has ? fmt(s.fga / s.statGames) : "—"}
              label="Tiri a partita"
              sub={`${s.fga} in tutto`}
            />
          </Group>
          <Group title="Come segni">
            {split && made ? (
              <>
                <div className="flex h-2 overflow-hidden rounded-full bg-raised">
                  <span
                    className="h-full bg-ball"
                    style={{ width: `${(split.assisted / made) * 100}%` }}
                  />
                  <span className="h-full flex-1 bg-volt" />
                </div>
                <div className="mt-2 flex justify-between gap-2 text-[11.5px] font-semibold">
                  <span>
                    <span className="num block text-[18px] text-ball">
                      {pct(split.assisted / made)}
                    </span>
                    <span className="text-muted">su assist</span>
                  </span>
                  <span className="text-right">
                    <span className="num block text-[18px]">
                      {pct(split.alone / made)}
                    </span>
                    <span className="text-muted">da solo</span>
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-muted">
                Serve una partita raccontata azione per azione
              </p>
            )}
          </Group>
        </div>
      </>
    ),
    gioco: (
      <>
        <Group title="Possesso">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-3">
            <Stat
              big
              value={possessions ? fmt(s.totals.pts / possessions, 2) : "—"}
              label="Punti per possesso"
            />
            <Stat value={has ? fmt(s.avg.ast) : "—"} label="Assist a partita" />
            <Stat
              value={s.astTov !== null ? fmt(s.astTov, 1) : "—"}
              label="Assist per persa"
            />
          </div>
        </Group>
        <div className="grid grid-cols-2 gap-2.5">
          <Group title="Rimbalzi">
            <Row value={has ? fmt(s.avg.oreb) : "—"} label="In attacco" />
            <Row value={has ? fmt(s.avg.dreb) : "—"} label="In difesa" />
          </Group>
          <Group title="Intesa">
            <Partner
              label="Passa di più a"
              playerId={split?.bestTarget?.id ?? null}
              n={split?.bestTarget?.n ?? 0}
            />
            <Partner
              label="Riceve di più da"
              playerId={split?.bestPasser?.id ?? null}
              n={split?.bestPasser?.n ?? 0}
            />
          </Group>
        </div>
      </>
    ),
    impatto: (
      <>
        <Group title="In campo">
          <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-3">
            <Stat
              big
              value={plus === null ? "—" : signed(plus, 1)}
              label="+/− a partita"
            />
            <Stat
              value={s.games ? pct(s.winPct) : "—"}
              label="Vittorie"
              sub={`${s.wins} su ${s.games}`}
            />
            <Stat value={eloOf(engine.elo, id)} label="ELO" />
          </div>
        </Group>
        <Group title="La tua squadra">
          <div className="grid grid-cols-3 gap-3">
            <Stat
              value={s.games ? fmt(s.pointsFor / s.games) : "—"}
              label="Punti fatti"
            />
            <Stat
              value={s.games ? fmt(s.pointsAgainst / s.games) : "—"}
              label="Punti subiti"
            />
            <Stat value={has ? fmt(s.effAvg) : "—"} label="Voto medio" />
          </div>
        </Group>
      </>
    ),
    record: (
      <Group title="Il meglio in una partita">
        <div className="grid grid-cols-3 gap-x-3 gap-y-4">
          <Stat value={best.pts} label="Punti" />
          <Stat value={best.reb} label="Rimbalzi" />
          <Stat value={best.ast} label="Assist" />
          <Stat value={best.fg3m} label="Triple" />
          <Stat value={best.stl} label="Rubate" />
          <Stat value={best.blk} label="Stoppate" />
        </div>
      </Group>
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
                <div className="bg-[#15110d]">
                  <div className="mx-auto w-full short:max-w-[250px]">
                    <ShotChart
                      zones={zones}
                      selected={zone}
                      onSelect={setZone}
                    />
                  </div>
                </div>
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
                  {share !== null && z.att > 0 && (
                    <p className="mt-3 text-[12px] text-muted">
                      Il {Math.round(share * 100)}% dei tuoi tiri arriva da qui
                    </p>
                  )}
                </div>
                {zones.unknown2 > 0 && (
                  <p className="border-t border-line px-4 py-2 text-[11.5px] text-faint">
                    {zones.unknown2} tiri da 2 senza la zona (partite importate
                    o dal video): contano nei totali, non nella mappa
                  </p>
                )}
              </div>
            </section>

            <section className="flex shrink-0 flex-col gap-2.5">
              <Chips value={tab} onChange={setTab} options={TABS} scroll />
              <div key={tab} className="tab-enter-right flex flex-col gap-2.5">
                {tiles[tab]}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
