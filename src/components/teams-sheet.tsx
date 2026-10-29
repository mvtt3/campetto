"use client";

import clsx from "clsx";
import Link from "next/link";
import { Shuffle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { useData } from "@/lib/data/provider";
import { balanceTeams } from "@/lib/stats/teams";
import { shortName, TEAM_SIZE, type Format } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { Button } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { InfoTip } from "@/components/ui/info";

/** Squadre equilibrate per chi ha detto "ci sono", in base all'ELO. Solo da guardare. */
export function TeamsSheet({ playerIds, format, onClose }: { playerIds: string[]; format: Format | null; onClose: () => void }) {
  const { data, engine, me } = useData();
  const size = format && playerIds.length >= TEAM_SIZE[format] * 2 ? TEAM_SIZE[format] : Math.min(4, Math.floor(playerIds.length / 2));
  const [round, setRound] = useState(0);
  const split = useMemo(
    () => (size ? balanceTeams(playerIds, engine.elo.ratings, size, round ? 1 : 0) : null),
    // round cambia per rimescolare
    [playerIds, engine.elo.ratings, size, round],
  );
  const name = (id: string) => shortName(data.players.find((p) => p.id === id), data.players);
  const fmt = `${size}v${size}` as Format;
  const resting = split ? playerIds.filter((id) => !split.teamA.includes(id) && !split.teamB.includes(id)) : [];

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Squadre per il ${fmt}`}
      description="Divise in modo che sia una partita equilibrata"
      footer={
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setRound((r) => r + 1)}>
            <Shuffle size={17} /> Rimescola
          </Button>
          {me?.isAdmin && split && (
            <Link
              href={`/nuova?players=${[...split.teamA, ...split.teamB].join(",")}&format=${fmt}`}
              className="sticker press flex h-12 flex-1 items-center justify-center rounded-full bg-court text-[15px] font-bold text-court-ink"
            >
              Segna il risultato
            </Link>
          )}
        </div>
      }
    >
      {split && (
        <div className="flex flex-col gap-4 pb-2">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={split.teamA.join()}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="grid grid-cols-2 gap-3"
            >
              {(["A", "B"] as const).map((t) => (
                <div key={t} className={clsx("sticker halftone rounded-3xl p-4", t === "A" ? "bg-court text-court-ink" : "bg-ball text-ball-ink")}>
                  <p className="text-[13px] font-semibold opacity-85">Squadra {t}</p>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {(t === "A" ? split.teamA : split.teamB).map((id) => (
                      <li key={id} className="flex items-center gap-2">
                        <Avatar player={data.players.find((p) => p.id === id)} size={30} href={false} ring="none" />
                        <span className="truncate text-[15px] font-semibold">{name(id)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
          <div>
            <div className="mb-1.5 flex justify-between text-[13px] font-semibold">
              <span className="text-court">A {Math.round(split.probA * 100)}%</span>
              <span className="flex items-center gap-1 text-muted">
                Chi vince?
                <InfoTip label="Come si calcola chi vince" size={14}>
                  Una stima dall&apos;ELO di chi gioca: le squadre sono divise per avvicinarsi al 50%
                </InfoTip>
              </span>
              <span className="text-ball">B {Math.round((1 - split.probA) * 100)}%</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-full border-2 border-edge bg-ball">
              <motion.div className="h-full bg-court" animate={{ width: `${split.probA * 100}%` }} transition={{ type: "spring", stiffness: 160, damping: 22 }} />
            </div>
          </div>
          {resting.length > 0 && <p className="text-[13.5px] text-muted">Riposano: {resting.map(name).join(", ")}</p>}
        </div>
      )}
    </Sheet>
  );
}
