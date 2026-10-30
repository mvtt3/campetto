"use client";

import clsx from "clsx";
import { Crown, RefreshCw } from "lucide-react";
import { useState } from "react";
import { InfoTip } from "@/components/ui/info";
import { Segmented } from "@/components/ui/basics";
import { doubleDigits, normalizeBox } from "@/lib/stats/player";
import { shortName, type Match, type Player } from "@/lib/types";

type Tab = "tiro" | "gioco";

const shot = (m: number, a: number) => (a ? `${m}/${a}` : "—");

/** "DD" o "TD" accanto al nome, come un timbro: doppia o tripla doppia in un colpo d'occhio. */
export function DoubleStamp({ n }: { n: number }) {
  if (n < 2) return null;
  const label = n >= 3 ? "Tripla doppia" : "Doppia doppia";
  return (
    <span
      className={clsx(
        "ml-1 inline-grid h-[17px] place-items-center rounded-[5px] border-[1.5px] px-1 align-[1px] font-[family-name:var(--font-ultra)] text-[9.5px] leading-none tracking-wide",
        n >= 3
          ? "border-[#6b46b8] bg-[#6b46b8] text-white"
          : "border-gold text-gold",
      )}
      title={label}
      aria-label={label}
    >
      {n >= 3 ? "TD" : "DD"}
    </span>
  );
}

/**
 * Il tabellino in due viste, per stare sempre nello schermo: Tiro (punti, da sotto, dalla
 * media, da tre) e Gioco (rimbalzi, assist, rubate, stoppate, perse e falli se contati).
 * Le voci arrivate a 10 sono evidenziate; doppie e triple doppie hanno il loro timbro.
 */
export function BoxTable({
  match: m,
  players,
  mvpId,
}: {
  match: Match;
  players: Player[];
  mvpId: string | null;
}) {
  const [tab, setTab] = useState<Tab>("tiro");
  const lines = (["A", "B"] as const).flatMap((t) =>
    m.players.filter((l) => l.team === t && l.hasStats),
  );
  const zones = lines.some(
    (l) => l.box.fgra !== null && l.box.fgra !== undefined,
  );
  const fouls = lines.some((l) => normalizeBox(l.box).fouls > 0);
  const heads =
    tab === "tiro"
      ? ["Punti", ...(zones ? ["Sotto", "Media"] : ["Da 2"]), "Da 3", "Totale"]
      : [
          "Rimb.",
          "Assist",
          "Rubate",
          "Stopp.",
          "Perse",
          ...(fouls ? ["Falli"] : []),
        ];

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <h3 className="title flex shrink-0 items-center gap-1.5 text-[15px]">
          Tabellino
          <InfoTip label="Come si legge il tabellino" size={15}>
            I tiri sono segnati su tentati: da sotto, dalla media, da tre e il
            totale. In giallo le voci arrivate a 10. <b>DD</b> doppia doppia:
            almeno 10 in due voci tra punti, rimbalzi, assist, rubate e
            stoppate. <b>TD</b> tripla doppia: in tre. La corona indica
            l&apos;MVP
          </InfoTip>
        </h3>
        <Segmented<Tab>
          size="sm"
          className="ml-auto w-[150px]"
          value={tab}
          onChange={setTab}
          options={[
            { value: "tiro", label: "Tiro" },
            { value: "gioco", label: "Gioco" },
          ]}
        />
      </div>
      <table className="tnum w-full table-fixed text-[13px]">
        <colgroup>
          <col className="w-[34%]" />
          {heads.map((h) => (
            <col key={h} />
          ))}
        </colgroup>
        <thead>
          <tr className="text-[11px] text-muted">
            <th className="py-1 pr-1 text-left font-semibold">Giocatore</th>
            {heads.map((h) => (
              <th key={h} className="px-0.5 py-1 text-right font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const b = normalizeBox(l.box);
            const reb = b.oreb + b.dreb;
            const tens = doubleDigits(b);
            const p = players.find((x) => x.id === l.playerId);
            const rimM = b.fgrm ?? 0;
            const rimA = b.fgra ?? 0;
            const ten = (v: number) =>
              v >= 10
                ? "rounded-md bg-volt/70 px-1 font-bold text-volt-ink"
                : "";
            const cells =
              tab === "tiro"
                ? [
                    <span key="p" className={clsx("font-bold", ten(b.pts))}>
                      {b.pts}
                    </span>,
                    ...(zones
                      ? [shot(rimM, rimA), shot(b.fg2m - rimM, b.fg2a - rimA)]
                      : [shot(b.fg2m, b.fg2a)]),
                    shot(b.fg3m, b.fg3a),
                    shot(b.fg2m + b.fg3m, b.fg2a + b.fg3a),
                  ]
                : [
                    <span key="r" className={ten(reb)}>
                      {reb}
                    </span>,
                    <span key="a" className={ten(b.ast)}>
                      {b.ast}
                    </span>,
                    <span key="s" className={ten(b.stl)}>
                      {b.stl}
                    </span>,
                    <span key="b" className={ten(b.blk)}>
                      {b.blk}
                    </span>,
                    b.tov,
                    ...(fouls ? [b.fouls] : []),
                  ];
            return (
              <tr key={l.playerId} className="border-t border-line">
                <td className="truncate py-1.5 pr-1 font-semibold">
                  <span
                    className={clsx(
                      "mr-1.5 inline-block h-2.5 w-2.5 rounded-full",
                      l.team === "A" ? "bg-court" : "bg-ball",
                    )}
                  />
                  {shortName(p, players)}
                  {l.sub && (
                    <RefreshCw
                      size={11}
                      className="ml-1 inline align-[-1px] text-muted"
                      aria-label="cambio"
                    />
                  )}
                  {mvpId === l.playerId && (
                    <Crown
                      size={12}
                      className="ml-1 inline align-[-1px] text-gold"
                      aria-label="MVP della partita"
                    />
                  )}
                  <DoubleStamp n={tens.length} />
                </td>
                {cells.map((c, i) => (
                  <td
                    key={i}
                    className={clsx(
                      "px-0.5 text-right",
                      tab === "tiro" && i > 0 && "text-muted",
                    )}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
