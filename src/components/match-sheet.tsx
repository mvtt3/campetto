"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData } from "@/lib/data/provider";
import { matchRecap } from "@/lib/recap";
import { normalizeBox } from "@/lib/stats/player";
import { shortName, winnerOf, type Match, type Player, type StatsSource, type Team } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { InfoTip } from "@/components/ui/info";

export const SOURCE_LABEL: Record<StatsSource, string> = {
  solo_risultato: "Solo risultato",
  tabellino: "Con tabellino",
  video: "Dal video",
  importata: "Con statistiche",
};

function TeamBlock({ m, team, players }: { m: Match; team: Team; players: Player[] }) {
  const won = winnerOf(m) === team;
  const ids = m.players.filter((p) => p.team === team);
  return (
    <div
      className={clsx(
        "sticker halftone relative flex min-w-0 flex-1 flex-col items-center rounded-3xl px-2 pb-3 pt-4",
        team === "A" ? "bg-court text-court-ink" : "bg-ball text-ball-ink",
        !won && "opacity-75",
      )}
    >
      {won && <span className="absolute -top-3 rounded-full border-2 border-[#1d1a16] bg-volt px-2.5 py-0.5 text-[12px] font-bold text-volt-ink">Vince</span>}
      <p className="score text-[54px]">{team === "A" ? m.scoreA : m.scoreB}</p>
      <div className="mt-2 flex -space-x-2">
        {ids.map((l) => (
          <span key={l.playerId} className="rounded-full ring-2 ring-white/70">
            <Avatar player={players.find((p) => p.id === l.playerId)} size={30} href={false} ring="none" />
          </span>
        ))}
      </div>
      <p className="mt-1.5 line-clamp-2 text-center text-[12.5px] font-semibold leading-tight">
        {ids.map((l) => shortName(players.find((p) => p.id === l.playerId), players)).join(", ")}
      </p>
    </div>
  );
}

export function MatchSheet({ match, onClose }: { match: Match | null; onClose: () => void }) {
  const { data, me, backend, refresh, mutate } = useData();
  const toast = useToast();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = match;
  const players = data.players;
  const withStats = m?.players.filter((p) => p.hasStats) ?? [];
  const date = m ? new Date(m.playedAt) : null;

  return (
    <Sheet
      open={Boolean(m)}
      onOpenChange={(o) => {
        if (!o) {
          setConfirmDelete(false);
          onClose();
        }
      }}
      title={m ? date!.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, (c) => c.toUpperCase()) : ""}
      description={m ? `${m.format} · ore ${date!.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })} · ${SOURCE_LABEL[m.statsSource].toLowerCase()}` : undefined}
      footer={
        m && me?.isAdmin ? (
          <div className="flex gap-2">
            {!confirmDelete ? (
              <>
                <Button className="flex-1" onClick={() => router.push(`/nuova?edit=${m.id}`)}>
                  <Pencil size={17} /> Modifica
                </Button>
                <Button variant="danger" aria-label="Elimina partita" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={18} />
                </Button>
              </>
            ) : (
              <>
                <Button className="flex-1" onClick={() => setConfirmDelete(false)}>
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
                      mutate((d) => ({ ...d, matches: d.matches.filter((x) => x.id !== m.id) }));
                      toast("Partita eliminata");
                      onClose();
                      void refresh();
                    } catch (e) {
                      toast((e as Error).message, "error");
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
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex items-stretch gap-2 pt-2">
            <TeamBlock m={m} team="A" players={players} />
            <TeamBlock m={m} team="B" players={players} />
          </div>

          <p className="rounded-2xl border-2 border-dashed border-line-strong bg-raised px-4 py-3 text-[15px] leading-snug">{matchRecap(m, players)}</p>
          {m.notes && <p className="text-[14px] text-muted">{m.notes}</p>}

          {withStats.length > 0 && (
            <div>
              <h3 className="title mb-2 flex items-center gap-1.5 text-[16px]">
                Tabellino
                <InfoTip label="Cosa vogliono dire le colonne" size={15}>
                  Da 2 e Da 3: canestri segnati su tentati · Rimb. rimbalzi · Ass. assist · Rub. palle rubate · Stop. stoppate
                </InfoTip>
              </h3>
              <div className="scroll-x -mx-5 px-5">
                <table className="tnum w-full min-w-[440px] text-[13.5px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-muted">
                      <th className="py-1.5 pr-2 font-semibold">Giocatore</th>
                      {["Punti", "Da 2", "Da 3", "Rimb.", "Ass.", "Rub.", "Stop.", "Perse"].map((h) => (
                        <th key={h} className="px-1.5 py-1.5 text-right font-semibold">
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
                            <tr key={l.playerId} className="border-t border-line">
                              <td className="max-w-[120px] truncate py-2 pr-2 font-semibold">
                                <span className={clsx("mr-1.5 inline-block h-2.5 w-2.5 rounded-full", t === "A" ? "bg-court" : "bg-ball")} />
                                {shortName(players.find((p) => p.id === l.playerId), players)}
                              </td>
                              <td className="px-1.5 text-right font-bold">{b.pts}</td>
                              <td className="px-1.5 text-right text-muted">{b.fg2a ? `${b.fg2m}/${b.fg2a}` : "—"}</td>
                              <td className="px-1.5 text-right text-muted">{b.fg3a ? `${b.fg3m}/${b.fg3a}` : "—"}</td>
                              <td className="px-1.5 text-right">{b.oreb + b.dreb}</td>
                              <td className="px-1.5 text-right">{b.ast}</td>
                              <td className="px-1.5 text-right">{b.stl}</td>
                              <td className="px-1.5 text-right">{b.blk}</td>
                              <td className="px-1.5 text-right">{b.tov}</td>
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
