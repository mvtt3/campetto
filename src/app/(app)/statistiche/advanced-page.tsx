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
import { InfoTip } from "@/components/ui/info";
import { useData } from "@/lib/data/provider";
import { filterMatches, type Period } from "@/lib/periods";
import { eloOf } from "@/lib/stats/elo";
import { computePlayerStats, normalizeBox } from "@/lib/stats/player";
import {
  assistSplit,
  groupZones,
  pctTone,
  shotZones,
  ZONE_MIN_ATT,
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

function Tile({
  value,
  label,
  sub,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-[12px] font-semibold text-muted">
        {label}
      </span>
      <span
        className={clsx(
          "num mt-1 block max-w-full truncate whitespace-nowrap",
          typeof value === "string" && value.length > 6
            ? "text-[16px] leading-[1.5]"
            : "text-[24px] leading-none",
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

const LABEL =
  "flex items-center gap-1.5 px-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

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

const GLOSSARY: Record<Tab, ReactNode> = {
  tiro: (
    <>
      <b>Al tiro</b>: canestri su tiri tentati. <b>Tiro effettivo</b>: come la
      percentuale, ma una tripla segnata vale una volta e mezza, perché porta un
      punto in più. <b>Punti per tiro</b>: quanti punti porti in media ogni
      volta che tiri. <b>Su assist</b>: quanti dei tuoi canestri arrivano da un
      passaggio di un compagno (dalle partite raccontate azione per azione)
    </>
  ),
  gioco: (
    <>
      <b>Punti per possesso</b>: quanti punti porti ogni volta che la palla è
      tua, contando tiri e palle perse. <b>Assist per persa</b>: per ogni
      pallone perso, quanti passaggi decisivi fai. <b>Passa di più a</b> e{" "}
      <b>Riceve di più da</b>: le coppie che si cercano in campo
    </>
  ),
  impatto: (
    <>
      <b>+/−</b>: di quanti punti vince o perde in media la tua squadra quando
      giochi. <b>Voto</b>: punti, rimbalzi, assist, rubate e stoppate, meno tiri
      sbagliati e palle perse. <b>ELO</b>: il punteggio di forza, parte da 1000
    </>
  ),
  record: <>Il meglio che hai fatto in una sola partita, in questo periodo</>,
};

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
  const self = id === me?.id;
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

  const name = (pid: string) =>
    shortName(
      data.players.find((p) => p.id === pid),
      data.players,
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

  const tiles: Record<Tab, ReactNode> = {
    tiro: (
      <>
        <Tile value={pct(s.fgPct)} label="Al tiro" sub={`${s.fgm}/${s.fga}`} />
        <Tile value={pct(s.efgPct)} label="Tiro effettivo" />
        <Tile
          value={s.fga ? fmt(s.totals.pts / s.fga, 2) : "—"}
          label="Punti per tiro"
        />
        <Tile
          value={has ? fmt(s.fga / s.statGames) : "—"}
          label="Tiri a partita"
        />
        <Tile
          value={split && made ? pct(split.assisted / made) : "—"}
          label="Su assist"
          sub={split && made ? `${split.assisted} su ${made}` : undefined}
        />
        <Tile
          value={split && made ? pct(split.alone / made) : "—"}
          label="Da solo"
          sub={split && made ? `${split.alone} su ${made}` : undefined}
        />
      </>
    ),
    gioco: (
      <>
        <Tile
          value={possessions ? fmt(s.totals.pts / possessions, 2) : "—"}
          label="Punti per possesso"
        />
        <Tile value={has ? fmt(s.avg.ast) : "—"} label="Assist a partita" />
        <Tile
          value={s.astTov !== null ? fmt(s.astTov, 1) : "—"}
          label="Assist per persa"
        />
        <Tile
          value={has ? `${fmt(s.avg.oreb)} · ${fmt(s.avg.dreb)}` : "—"}
          label="Rimbalzi"
          sub="in attacco · in difesa"
        />
        <Tile
          value={split?.bestTarget ? name(split.bestTarget.id) : "—"}
          label="Passa di più a"
          sub={split?.bestTarget ? `${split.bestTarget.n} assist` : undefined}
        />
        <Tile
          value={split?.bestPasser ? name(split.bestPasser.id) : "—"}
          label="Riceve di più da"
          sub={split?.bestPasser ? `${split.bestPasser.n} assist` : undefined}
        />
      </>
    ),
    impatto: (
      <>
        <Tile
          value={s.games ? signed(s.plusMinusAvg, 1) : "—"}
          label="+/− a partita"
        />
        <Tile
          value={s.games ? pct(s.winPct) : "—"}
          label="Vittorie"
          sub={`${s.wins} su ${s.games}`}
        />
        <Tile value={eloOf(engine.elo, id)} label="ELO" />
        <Tile
          value={s.games ? fmt(s.pointsFor / s.games) : "—"}
          label="Punti fatti"
          sub="dalla squadra"
        />
        <Tile
          value={s.games ? fmt(s.pointsAgainst / s.games) : "—"}
          label="Punti subiti"
          sub="dalla squadra"
        />
        <Tile value={has ? fmt(s.effAvg) : "—"} label="Voto medio" />
      </>
    ),
    record: (
      <>
        <Tile value={best.pts} label="Punti" />
        <Tile value={best.reb} label="Rimbalzi" />
        <Tile value={best.ast} label="Assist" />
        <Tile value={best.fg3m} label="Triple" />
        <Tile value={best.stl} label="Rubate" />
        <Tile value={best.blk} label="Stoppate" />
      </>
    ),
  };

  return (
    <>
      <ScreenHeader
        title="Statistiche"
        subtitle={self ? "Mappa di tiro e numeri avanzati" : name(id)}
        back={() => router.back()}
      />
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
              <div className="mb-2 flex items-center justify-between">
                <h2 className={LABEL}>
                  Mappa di tiro
                  <InfoTip label="Come si legge la mappa" size={14}>
                    Tocca una zona del campo: si illumina e sotto vedi come tiri
                    da lì. Il numero è la percentuale: verde dal 50%, giallo dal
                    20%, rosso sotto. Il colore della zona illuminata è il
                    livello, come per i badge: bronzo, argento dal 40%, oro dal
                    60%, Hall of Fame dal 90%. Servono almeno {ZONE_MIN_ATT}{" "}
                    tiri
                  </InfoTip>
                </h2>
                <span className="px-1 text-[11.5px] font-semibold text-faint">
                  Tocca una zona
                </span>
              </div>
              <div className={clsx(CARD, "overflow-hidden")}>
                <div className="mx-auto w-full px-3 pt-3 short:max-w-[250px]">
                  <ShotChart zones={zones} selected={zone} onSelect={setZone} />
                </div>
                <div
                  className="flex items-center gap-3.5 border-t border-line px-4 py-3.5"
                  aria-live="polite"
                >
                  <span
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-raised"
                    style={{
                      background: tier ? `${TIER_TINT[tier]}40` : undefined,
                    }}
                    aria-hidden
                  >
                    <span
                      className={clsx(
                        "num text-[22px] leading-none",
                        TONE_TEXT[pctTone(zp)],
                      )}
                    >
                      {zp === null ? "—" : Math.round(zp * 100)}
                      {zp !== null && <span className="text-[12px]">%</span>}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-tight">
                      {ZONE_NAME[zone]} ·{" "}
                      <span className="text-muted">{TIER_LABEL[tier]}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[12.5px] text-muted">
                      {z.att ? `${z.made} su ${z.att}` : "Nessun tiro da qui"}
                      {share !== null && z.att
                        ? ` · ${Math.round(share * 100)}% dei tuoi tiri`
                        : ""}
                      {gp !== null ? ` · gruppo ${Math.round(gp * 100)}%` : ""}
                    </p>
                  </div>
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
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Chips value={tab} onChange={setTab} options={TABS} scroll />
                </div>
                <InfoTip label="Cosa vogliono dire questi numeri" size={16}>
                  {GLOSSARY[tab]}
                </InfoTip>
              </div>
              <div
                key={tab}
                className={clsx(
                  CARD,
                  "tab-enter-right grid grid-cols-3 gap-x-4 gap-y-4 px-4 py-4",
                )}
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
