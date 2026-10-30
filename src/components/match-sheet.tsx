"use client";

import { matchMvp } from "@/lib/stats/match-mvp";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Crown, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData } from "@/lib/data/provider";
import { matchRecap } from "@/lib/recap";
import { normalizeBox } from "@/lib/stats/player";
import {
  shortName,
  winnerOf,
  type Match,
  type Player,
  type StatsSource,
  type Team,
} from "@/lib/types";
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { InfoTip } from "@/components/ui/info";
import { MvpMatchInfo } from "@/components/mvp-info";
import { say } from "@/lib/voice";
import { Character, characterOf } from "./character";

export const SOURCE_LABEL: Record<StatsSource, string> = {
  solo_risultato: "Solo risultato",
  tabellino: "Con tabellino",
  video: "Dal video",
  importata: "Con statistiche",
};

function TeamBlock({
  m,
  team,
  players,
}: {
  m: Match;
  team: Team;
  players: Player[];
}) {
  const won = winnerOf(m) === team;
  const ids = m.players
    .filter((p) => p.team === team)
    .sort((x, y) => Number(!!x.sub) - Number(!!y.sub));
  const starters = ids.filter((l) => !l.sub);
  const subs = ids.filter((l) => l.sub);
  const nm = (id: string) =>
    shortName(
      players.find((p) => p.id === id),
      players,
    );
  return (
    <div
      className={clsx(
        "sticker halftone relative flex min-w-0 flex-1 flex-col items-center rounded-3xl px-2 pb-2.5 pt-3",
        team === "A" ? "bg-court text-court-ink" : "bg-ball text-ball-ink",
        !won && "opacity-75",
      )}
    >
      {won && (
        <span className="absolute -top-3 rounded-full border-2 border-[#1d1a16] bg-volt px-2.5 py-0.5 text-[12px] font-bold text-volt-ink">
          Vince
        </span>
      )}
      <p className="score text-[44px] short:text-[38px]">
        {team === "A" ? m.scoreA : m.scoreB}
      </p>
      {/* La squadra in campo: i personaggini, uno accanto all'altro. */}
      <div className="mt-0.5 flex items-end justify-center -space-x-2 short:hidden">
        {ids.map((l) => {
          const pl = players.find((p) => p.id === l.playerId);
          return pl ? (
            <span key={l.playerId} className={clsx(l.sub && "opacity-80")}>
              <Character
                id={characterOf(pl)}
                number={pl.jerseyNumber}
                height={(ids.length > 3 ? 36 : 42) * (l.sub ? 0.86 : 1)}
              />
            </span>
          ) : null;
        })}
      </div>
      <p className="mt-1.5 text-center text-[12.5px] font-semibold leading-tight">
        {starters.map((l) => nm(l.playerId)).join(", ")}
      </p>
      {subs.length > 0 && (
        <p className="mt-0.5 text-center text-[11.5px] font-bold leading-tight opacity-85">
          <RefreshCw
            size={11}
            className="mr-1 inline align-[-1px]"
            aria-hidden
          />
          {subs.length === 1 ? "Cambio" : "Cambi"}:{" "}
          {subs.map((l) => nm(l.playerId)).join(", ")}
        </p>
      )}
    </div>
  );
}

export function MatchSheet({
  match,
  onClose,
}: {
  match: Match | null;
  onClose: () => void;
}) {
  const { data, me, backend, refresh, mutate } = useData();
  const toast = useToast();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = match;
  const players = data.players;
  const withStats = m?.players.filter((p) => p.hasStats) ?? [];
  const date = m ? new Date(m.playedAt) : null;
  const mvp = m ? matchMvp(m) : null;
  const mvpPlayer = mvp
    ? players.find((p) => p.id === mvp.playerId)
    : undefined;
  // I falli si mostrano solo se quel giorno si contavano.
  const foulsTracked = withStats.some((l) => normalizeBox(l.box).fouls > 0);
  const mvpLine = mvp
    ? normalizeBox(m!.players.find((l) => l.playerId === mvp.playerId)!.box)
    : null;
  // Il suo contributo: la sua parte di quello che la squadra ha prodotto (punti, rimbalzi, assist, rubate, stoppate).
  const mvpShare = (() => {
    if (!m || !mvp) return null;
    const made = (box: Match["players"][number]["box"]) => {
      const b = normalizeBox(box);
      return b.pts + b.oreb + b.dreb + b.ast + b.stl + b.blk;
    };
    const line = m.players.find((l) => l.playerId === mvp.playerId)!;
    const total = m.players
      .filter((l) => l.team === line.team && l.hasStats)
      .reduce((a, l) => a + made(l.box), 0);
    return total > 0 ? Math.round((made(line.box) / total) * 100) : null;
  })();

  return (
    <Sheet
      open={Boolean(m)}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmDelete(false);
          onClose();
        }
      }}
      title={
        m
          ? date!
              .toLocaleDateString("it-IT", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
              .replace(/^./, (c) => c.toUpperCase())
          : ""
      }
      description={
        m
          ? `${m.format} · ore ${date!.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · ${SOURCE_LABEL[m.statsSource].toLowerCase()}`
          : undefined
      }
      footer={
        m && me?.isAdmin ? (
          <div className="flex gap-2">
            {!confirmDelete ? (
              <>
                <Button
                  className="flex-1"
                  onClick={() => router.push(`/nuova?edit=${m.id}`)}
                >
                  <Pencil size={17} /> Modifica
                </Button>
                <Button
                  variant="danger"
                  aria-label="Elimina partita"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={18} />
                </Button>
              </>
            ) : (
              <>
                <Button
                  className="flex-1"
                  onClick={() => setConfirmDelete(false)}
                >
                  Annulla
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await backend.deleteMatch(m.id);
                      mutate((d) => ({
                        ...d,
                        matches: d.matches.filter((x) => x.id !== m.id),
                      }));
                      toast("Ho eliminato la partita");
                      onClose();
                      void refresh();
                    } catch (e) {
                      toast(say(e), "error");
                    } finally {
                      setBusy(false);
                      setConfirmDelete(false);
                    }
                  }}
                >
                  Elimina partita
                </Button>
              </>
            )}
          </div>
        ) : undefined
      }
    >
      {m && (
        <div className="flex flex-col gap-3 pb-1">
          {/* Per chi usa il lettore di schermo: il risultato in una riga. */}
          <p className="sr-only">
            Risultato {m.scoreA}–{m.scoreB}
          </p>
          <div className="flex items-stretch gap-2 pt-2">
            <TeamBlock m={m} team="A" players={players} />
            <TeamBlock m={m} team="B" players={players} />
          </div>

          {mvp && mvpPlayer && mvpLine ? (
            <section
              className="sticker relative flex items-center gap-2.5 overflow-hidden rounded-[20px] bg-volt py-1.5 pl-2 pr-2.5 text-volt-ink"
              aria-label="MVP della partita"
            >
              <span className="grid w-10 shrink-0 place-items-end justify-center">
                <Character
                  id={characterOf(mvpPlayer)}
                  number={mvpPlayer.jerseyNumber}
                  height={46}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-[15px] font-bold leading-tight">
                  <Crown size={14} aria-hidden className="shrink-0" />{" "}
                  <span className="truncate">
                    MVP {shortName(mvpPlayer, players)}
                  </span>
                </p>
                <p className="truncate text-[12.5px] font-semibold opacity-80">
                  {mvpLine.pts} punti · {mvpLine.oreb + mvpLine.dreb} rimbalzi ·{" "}
                  {mvpLine.ast} assist
                </p>
                {mvpShare !== null && (
                  <p className="truncate text-[11.5px] font-bold opacity-70">
                    {mvpShare}% del gioco della squadra
                  </p>
                )}
              </div>
              <InfoTip label="Come si sceglie l'MVP della partita" size={16}>
                <MvpMatchInfo />
              </InfoTip>
            </section>
          ) : (
            // Senza tabellino il racconto della partita è l'unica cosa in più da dire.
            <p className="rounded-2xl border-2 border-dashed border-line-strong bg-raised px-4 py-2.5 text-[14.5px] leading-snug">
              {matchRecap(m, players)}
            </p>
          )}
          {m.notes && <p className="text-[14px] text-muted">{m.notes}</p>}

          {withStats.length > 0 && (
            <div>
              <h3 className="title mb-1 flex items-center gap-1.5 text-[15px]">
                Tabellino
                <InfoTip label="Cosa vogliono dire le colonne" size={15}>
                  Pt punti · Tiri e Da3: segnati su tentati · Rim rimbalzi · Ass
                  assist · Rub palle rubate · Stp stoppate · Per palle perse
                  {foulsTracked ? " · Fal falli" : ""} · la corona è l&apos;MVP
                  della partita
                </InfoTip>
              </h3>
              <div className="scroll-x -mx-5 px-5">
                <table className="tnum w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[11px] text-muted">
                      <th className="py-1 pr-1 font-semibold">Giocatore</th>
                      {[
                        "Pt",
                        "Tiri",
                        "Da3",
                        "Rim",
                        "Ass",
                        "Rub",
                        "Stp",
                        "Per",
                        ...(foulsTracked ? ["Fal"] : []),
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-[3px] py-1 text-right font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(["A", "B"] as const).flatMap((t) =>
                      withStats
                        .filter((l) => l.team === t)
                        .map((l) => {
                          const b = normalizeBox(l.box);
                          return (
                            <tr
                              key={l.playerId}
                              className="border-t border-line"
                            >
                              <td className="max-w-[84px] truncate py-1.5 pr-1 font-semibold">
                                <span
                                  className={clsx(
                                    "mr-1.5 inline-block h-2.5 w-2.5 rounded-full",
                                    t === "A" ? "bg-court" : "bg-ball",
                                  )}
                                />
                                {shortName(
                                  players.find((p) => p.id === l.playerId),
                                  players,
                                )}
                                {l.sub && (
                                  <RefreshCw
                                    size={11}
                                    className="ml-1 inline align-[-1px] text-muted"
                                    aria-label="cambio"
                                  />
                                )}
                                {mvp?.playerId === l.playerId && (
                                  <Crown
                                    size={12}
                                    className="ml-1 inline align-[-1px] text-gold"
                                    aria-label="MVP della partita"
                                  />
                                )}
                              </td>
                              <td className="px-[3px] text-right font-bold">
                                {b.pts}
                              </td>
                              <td className="px-[3px] text-right text-muted">
                                {b.fg2a + b.fg3a
                                  ? `${b.fg2m + b.fg3m}/${b.fg2a + b.fg3a}`
                                  : "—"}
                              </td>
                              <td className="px-[3px] text-right text-muted">
                                {b.fg3a ? `${b.fg3m}/${b.fg3a}` : "—"}
                              </td>
                              <td className="px-[3px] text-right">
                                {b.oreb + b.dreb}
                              </td>
                              <td className="px-[3px] text-right">{b.ast}</td>
                              <td className="px-[3px] text-right">{b.stl}</td>
                              <td className="px-[3px] text-right">{b.blk}</td>
                              <td className="px-[3px] text-right">{b.tov}</td>
                              {foulsTracked && (
                                <td className="px-[3px] text-right">
                                  {b.fouls}
                                </td>
                              )}
                            </tr>
                          );
                        }),
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
