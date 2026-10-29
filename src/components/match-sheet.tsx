"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { BadgeCheck, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useData } from "@/lib/data/provider";
import { matchRecap } from "@/lib/recap";
import { normalizeBox } from "@/lib/stats/player";
import { shortName, winnerOf, type Match, type Player, type StatsSource, type Team } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";

export const SOURCE_LABEL: Record<StatsSource, string> = {
  solo_risultato: "Solo risultato",
  tabellino: "Con tabellino",
  video: "Dal video",
  importata: "Importata",
};

export function canConfirm(m: Match, me: Player | null): boolean {
  if (!me || m.confirmedBy) return false;
  const mine = m.players.find((p) => p.playerId === me.id);
  if (!mine || m.createdBy === me.id) return false;
  const creatorTeam = m.players.find((p) => p.playerId === m.createdBy)?.team;
  return !creatorTeam || creatorTeam !== mine.team;
}

export function canEdit(m: Match, me: Player | null): boolean {
  return Boolean(me && (me.isAdmin || m.createdBy === me.id));
}

function TeamColumn({ m, team, players }: { m: Match; team: Team; players: Player[] }) {
  const won = winnerOf(m) === team;
  const ids = m.players.filter((p) => p.team === team);
  return (
    <div className={clsx("flex min-w-0 flex-1 flex-col items-center", team === "B" && "order-3")}>
      <div className="flex -space-x-2">
        {ids.map((l) => (
          <span key={l.playerId} className="rounded-full ring-2 ring-surface">
            <Avatar player={players.find((p) => p.id === l.playerId)} size={34} />
          </span>
        ))}
      </div>
      <p className={clsx("mt-2 line-clamp-2 text-center text-[13px] leading-tight", won ? "font-semibold" : "text-muted")}>
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
      title={m ? `${m.format}, ${date!.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}` : ""}
      description={m ? `${date!.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}. ${SOURCE_LABEL[m.statsSource]}.` : undefined}
      footer={
        m && (canConfirm(m, me) || canEdit(m, me)) ? (
          <div className="flex gap-2">
            {canConfirm(m, me) && (
              <Button
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await backend.confirmMatch(m.id);
                    mutate((d) => ({
                      ...d,
                      matches: d.matches.map((x) => (x.id === m.id ? { ...x, confirmedBy: me!.id, confirmedAt: new Date().toISOString() } : x)),
                    }));
                    toast("Risultato confermato");
                  } catch (e) {
                    toast((e as Error).message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <BadgeCheck size={18} /> Conferma risultato
              </Button>
            )}
            {canEdit(m, me) && !confirmDelete && (
              <>
                <Button className="flex-1" onClick={() => router.push(`/nuova?edit=${m.id}`)}>
                  <Pencil size={17} /> Modifica
                </Button>
                <Button variant="danger" aria-label="Elimina partita" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={18} />
                </Button>
              </>
            )}
            {confirmDelete && (
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
        <div className="flex flex-col gap-5 pb-2">
          <div className="flex items-center gap-2">
            <TeamColumn m={m} team="A" players={players} />
            <div className="order-2 shrink-0 text-center">
              <p className="num text-[46px]">
                <span className={winnerOf(m) === "A" ? "" : "text-muted"}>{m.scoreA}</span>
                <span className="text-faint">–</span>
                <span className={winnerOf(m) === "B" ? "" : "text-muted"}>{m.scoreB}</span>
              </p>
              {m.confirmedBy && (
                <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-ok">
                  <BadgeCheck size={14} /> Confermata
                </p>
              )}
            </div>
            <TeamColumn m={m} team="B" players={players} />
          </div>

          <p className="rounded-2xl bg-raised px-4 py-3 text-[15px] leading-snug">{matchRecap(m, players)}</p>
          {m.notes && <p className="text-[14px] text-muted">{m.notes}</p>}

          {withStats.length > 0 && (
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-muted">Tabellino</h3>
              <div className="scroll-x -mx-5 px-5">
                <table className="num-wide w-full min-w-[460px] text-[13.5px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-muted">
                      <th className="py-1.5 pr-2 font-semibold">Giocatore</th>
                      {["Punti", "2P", "3P", "Rimb.", "Ass.", "Rub.", "Stop.", "Perse"].map((h) => (
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
                                <span className={clsx("mr-1.5 inline-block h-2 w-2 rounded-full", t === "A" ? "bg-ball" : "bg-text")} />
                                {shortName(players.find((p) => p.id === l.playerId), players)}
                              </td>
                              <td className="px-1.5 text-right font-bold">{b.pts}</td>
                              <td className="px-1.5 text-right text-muted">
                                {b.fg2m}/{b.fg2a}
                              </td>
                              <td className="px-1.5 text-right text-muted">
                                {b.fg3m}/{b.fg3a}
                              </td>
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
          {m.events.length > 0 && (
            <p className="text-[13px] text-muted">{m.events.length} azioni segnate dal video.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
