"use client";

import { matchMvp } from "@/lib/stats/match-mvp";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import {
  IconCrown,
  IconPencil,
  IconRefresh,
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
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { HighlightCard } from "./highlights/entry";
import { useToast } from "./ui/toast";
import { InfoTip } from "@/components/ui/info";
import { MvpMatchInfo } from "@/components/mvp-info";
import { say } from "@/lib/voice";
import { Character, characterOf } from "./character";
import { BoxTable } from "./box-table";

export const SOURCE_LABEL: Record<StatsSource, string> = {
  solo_risultato: "Solo risultato",
  tabellino: "Con tabellino",
  video: "Dal video",
  importata: "Con statistiche",
};

const LABEL =
  "text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted";

export interface SheetRecord {
  label: string;
  display: string;
  playerIds: string[];
}

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
  const won = winner === team;
  const ids = m.players
    .filter((p) => p.team === team)
    .sort((x, y) => Number(!!x.sub) - Number(!!y.sub));
  const starters = ids.filter((l) => !l.sub);
  const subs = ids.filter((l) => l.sub);
  const nm = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p?.guest ? `${shortName(p)} (ospite)` : shortName(p, players);
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center text-center">
      <span
        className={clsx(
          "h-1.5 w-8 rounded-full",
          team === "A" ? "bg-court" : "bg-ball",
        )}
      />
      <p
        className={clsx(
          "score mt-2.5 text-[48px] leading-none short:text-[40px]",
          !won && "text-faint",
        )}
      >
        {team === "A" ? m.scoreA : m.scoreB}
      </p>
      <span
        className={clsx(
          "mt-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em]",
          won ? "bg-volt text-volt-ink" : "text-muted",
          !winner && "invisible",
        )}
      >
        {won ? "Vince" : "Perde"}
      </span>
      <div className="mt-3 flex h-[46px] items-end justify-center -space-x-2 short:hidden">
        {ids.map((l) => {
          const pl = players.find((p) => p.id === l.playerId);
          return pl ? (
            <span key={l.playerId} className={clsx(l.sub && "opacity-70")}>
              <Character
                id={characterOf(pl)}
                outfit={pl.outfit}
                number={pl.jerseyNumber}
                height={(ids.length > 3 ? 38 : 44) * (l.sub ? 0.86 : 1)}
              />
            </span>
          ) : null;
        })}
      </div>
      <p className="mt-2 w-full text-[13px] font-semibold leading-tight [text-wrap:balance]">
        {starters.map((l) => nm(l.playerId)).join(", ")}
      </p>
      {subs.length > 0 && (
        <p className="mt-1 w-full text-[11.5px] font-semibold leading-tight text-muted">
          <IconRefresh
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

function MvpStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0">
      <dd className="num text-[22px] leading-none">{value}</dd>
      <dt className="mt-1 text-[11px] font-semibold text-muted">{label}</dt>
    </div>
  );
}

export function MatchSheet({
  match,
  record,
  onClose,
}: {
  match: Match | null;
  record?: SheetRecord;
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
          {record && (
            <section
              aria-label="Record"
              className="rounded-[22px] bg-linear-to-b from-[#ffd65c] via-[#ffad33] to-[#e9781a] px-4 py-4 text-center text-[#1d1a16] shadow-[var(--shadow-pop)]"
            >
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#1d1a16]/65">
                Record · {record.label}
              </p>
              <p className="num mt-1.5 text-[34px] leading-none">
                {record.display}
              </p>
              <p className="mt-2 truncate text-[14px] font-semibold">
                {record.playerIds
                  .map((id) =>
                    shortName(
                      players.find((p) => p.id === id),
                      players,
                    ),
                  )
                  .join(", ")}
              </p>
            </section>
          )}
          <p className="sr-only">
            Risultato {m.scoreA}–{m.scoreB}
          </p>
          <section className="flex items-stretch gap-3 rounded-[22px] bg-raised px-3 pb-4 pt-4">
            <TeamSide m={withGuestLines(m)} team="A" players={everyone} />
            <span className="w-px shrink-0 bg-line" aria-hidden />
            <TeamSide m={withGuestLines(m)} team="B" players={everyone} />
          </section>

          <HighlightCard
            matchId={m.id}
            onOpen={(replace) => {
              if (!replace) onClose();
            }}
          />

          {mvp && mvpPlayer && mvpLine ? (
            <section
              className="flex items-center gap-3 rounded-[22px] bg-gold-soft px-3 py-3"
              aria-label="MVP della partita"
            >
              <span className="shrink-0">
                <Character
                  id={characterOf(mvpPlayer)}
                  outfit={mvpPlayer.outfit}
                  number={mvpPlayer.jerseyNumber}
                  height={64}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx(LABEL, "flex items-center gap-1")}>
                  <IconCrown
                    size={13}
                    aria-hidden
                    className="shrink-0 text-gold"
                  />
                  MVP della partita
                </p>
                <p className="truncate text-[16px] font-semibold leading-tight">
                  {shortName(mvpPlayer, players)}
                </p>
                <dl className="mt-2 grid grid-cols-3 gap-2">
                  <MvpStat value={mvpLine.pts} label="punti" />
                  <MvpStat
                    value={mvpLine.oreb + mvpLine.dreb}
                    label="rimbalzi"
                  />
                  <MvpStat value={mvpLine.ast} label="assist" />
                </dl>
                {mvpShare !== null && (
                  <p className="mt-2 text-[12px] font-semibold text-muted">
                    {mvpShare}% del gioco della squadra
                  </p>
                )}
              </div>
              <span className="self-start">
                <InfoTip label="Come si sceglie l'MVP della partita" size={16}>
                  <MvpMatchInfo />
                </InfoTip>
              </span>
            </section>
          ) : (
            <p className="rounded-[18px] bg-raised px-4 py-3 text-[14px] leading-snug">
              {matchRecap(m, players)}
            </p>
          )}
          {m.notes && <p className="text-[14px] text-muted">{m.notes}</p>}

          {withStats.length > 0 && (
            <BoxTable
              match={withGuestLines(m)}
              players={everyone}
              mvpId={mvp?.playerId ?? null}
            />
          )}
        </div>
      )}
    </Sheet>
  );
}
