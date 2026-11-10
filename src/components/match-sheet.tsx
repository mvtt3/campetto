"use client";

import { matchMvp } from "@/lib/stats/match-mvp";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import {
  IconCrown,
  IconPencil,
  IconTrophy,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { useData } from "@/lib/data/provider";
import { matchRecap } from "@/lib/recap";
import { withGuestLines } from "@/lib/guests";
import { normalizeBox } from "@/lib/stats/player";
import {
  shortName,
  winnerOf,
  type Match,
  type Player,
  type StatsSource,
  type Team,
} from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { HighlightCard } from "./highlights/entry";
import { useToast } from "./ui/toast";
import { say } from "@/lib/voice";
import { BoxTable } from "./box-table";

export const SOURCE_LABEL: Record<StatsSource, string> = {
  solo_risultato: "Solo risultato",
  tabellino: "Con tabellino",
  video: "Dal video",
  importata: "Con statistiche",
};

function TeamSide({
  m,
  team,
  players,
}: {
  m: Match;
  team: Team;
  players: Player[];
}) {
  const winner = winnerOf(m);
  const lines = m.players
    .filter((p) => p.team === team)
    .sort((x, y) => Number(!!x.sub) - Number(!!y.sub));
  const nm = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p?.guest ? `${shortName(p)} (ospite)` : shortName(p, players);
  };
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-0.5",
        team === "A" ? "items-start text-left" : "items-end text-right",
        winner && winner !== team && "text-muted",
      )}
    >
      <span
        className={clsx(
          "mb-1.5 h-1.5 w-7 rounded-full",
          team === "A" ? "bg-court" : "bg-ball",
        )}
      />
      {lines.map((l) => (
        <span
          key={l.playerId}
          className={clsx(
            "max-w-full truncate text-[13px] leading-tight",
            l.sub ? "text-faint" : "font-semibold",
          )}
        >
          {nm(l.playerId)}
        </span>
      ))}
    </div>
  );
}

export function MatchSheet({
  match,
  record,
  onClose,
}: {
  match: Match | null;
  record?: boolean;
  onClose: () => void;
}) {
  const { data, me, backend, refresh, mutate } = useData();
  const toast = useToast();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = match;
  const players = data.players;
  // Nel tabellino ci sono anche gli ospiti (solo lì: fuori dai conti del gruppo).
  const everyone = [...data.players, ...(data.guests ?? [])];
  const withStats = m?.players.filter((p) => p.hasStats) ?? [];
  const date = m ? new Date(m.playedAt) : null;
  const mvp = m ? matchMvp(m) : null;
  const mvpPlayer = mvp
    ? players.find((p) => p.id === mvp.playerId)
    : undefined;
  // I falli si mostrano solo se quel giorno si contavano.
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
                  <IconPencil size={17} /> Modifica
                </Button>
                <Button
                  variant="danger"
                  aria-label="Elimina partita"
                  onClick={() => setConfirmDelete(true)}
                >
                  <IconTrash size={18} />
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
        <div className="flex flex-col gap-3 pb-1 pt-1">
          <section className="overflow-hidden rounded-[22px] bg-linear-to-r from-court/12 via-raised to-ball/12">
            {record && (
              <p className="flex items-center justify-center gap-1.5 bg-gold-soft/80 px-4 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                <IconTrophy
                  size={14}
                  className="shrink-0 text-gold"
                  aria-hidden
                />
                Partita del record
              </p>
            )}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-5">
              <TeamSide m={withGuestLines(m)} team="A" players={everyone} />
              <p className="score whitespace-nowrap text-[42px] leading-none">
                <span className={clsx(winnerOf(m) === "B" && "text-faint")}>
                  {m.scoreA}
                </span>
                <span className="mx-1 text-line-strong">–</span>
                <span className={clsx(winnerOf(m) === "A" && "text-faint")}>
                  {m.scoreB}
                </span>
              </p>
              <TeamSide m={withGuestLines(m)} team="B" players={everyone} />
            </div>
          </section>

          {mvp && mvpPlayer && mvpLine ? (
            <section
              aria-label="MVP della partita"
              className="flex items-center gap-3 rounded-[22px] bg-linear-to-r from-gold-soft to-raised px-3 py-3"
            >
              <Avatar player={mvpPlayer} size={46} href={false} ring="gold" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gold">
                  <IconCrown size={12} className="shrink-0" aria-hidden />
                  MVP
                </p>
                <p className="truncate text-[15.5px] font-semibold leading-tight">
                  {shortName(mvpPlayer, players)}
                </p>
                {mvpShare !== null && (
                  <p className="truncate text-[12px] text-muted">
                    {mvpShare}% del gioco della squadra
                  </p>
                )}
              </div>
              <dl className="flex shrink-0 gap-1.5 text-center">
                {[
                  [mvpLine.pts, "pt"],
                  [mvpLine.oreb + mvpLine.dreb, "rb"],
                  [mvpLine.ast, "as"],
                ].map(([v, l]) => (
                  <div
                    key={l}
                    className="min-w-[40px] rounded-[14px] bg-surface px-1.5 py-1.5 shadow-[var(--shadow)]"
                  >
                    <dd className="num text-[18px] leading-none">{v}</dd>
                    <dt className="mt-0.5 text-[10.5px] font-semibold uppercase text-muted">
                      {l}
                    </dt>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            <p className="rounded-[22px] bg-raised px-4 py-3.5 text-[14px] leading-snug">
              {matchRecap(m, players)}
            </p>
          )}

          <HighlightCard
            matchId={m.id}
            onOpen={(replace) => {
              if (!replace) onClose();
            }}
          />

          {m.notes && <p className="text-[14px] text-muted">{m.notes}</p>}

          {withStats.length > 0 && (
            <div className="mt-2 px-1">
              <BoxTable
                match={withGuestLines(m)}
                players={everyone}
                mvpId={mvp?.playerId ?? null}
              />
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
