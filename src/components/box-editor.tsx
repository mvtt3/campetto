"use client";

import { normalizeBox } from "@/lib/stats/player";
import type { Box, BoxKey } from "@/lib/types";
import { Stepper } from "./ui/basics";

/** I tiri per zona del campo (come nella mappa di tiro), poi il resto. */
type Field =
  | "rimM"
  | "rimA"
  | "midM"
  | "midA"
  | "fg3m"
  | "fg3a"
  | Exclude<BoxKey, "pts" | "fg2m" | "fg2a" | "fg3m" | "fg3a">;

const FIELDS: {
  key: Field;
  label: string;
  pairOf?: Field;
  attemptOf?: Field;
}[] = [
  { key: "rimM", label: "Da sotto segnati", pairOf: "rimA" },
  { key: "rimA", label: "Da sotto tentati", attemptOf: "rimM" },
  { key: "midM", label: "Dalla media segnati", pairOf: "midA" },
  { key: "midA", label: "Dalla media tentati", attemptOf: "midM" },
  { key: "fg3m", label: "Da 3 segnati", pairOf: "fg3a" },
  { key: "fg3a", label: "Da 3 tentati", attemptOf: "fg3m" },
  { key: "oreb", label: "Rimb. offensivi" },
  { key: "dreb", label: "Rimb. difensivi" },
  { key: "ast", label: "Assist" },
  { key: "stl", label: "Rubate" },
  { key: "blk", label: "Stoppate" },
  { key: "tov", label: "Palle perse" },
  { key: "fouls", label: "Falli" },
];

type Flat = Record<Field, number>;

function flatten(b: Box): Flat {
  const rimM = b.fgrm ?? 0;
  const rimA = b.fgra ?? 0;
  return {
    rimM,
    rimA,
    midM: Math.max(0, b.fg2m - rimM),
    midA: Math.max(0, b.fg2a - rimA),
    fg3m: b.fg3m,
    fg3a: b.fg3a,
    oreb: b.oreb,
    dreb: b.dreb,
    ast: b.ast,
    stl: b.stl,
    blk: b.blk,
    tov: b.tov,
    fouls: b.fouls,
  };
}

/** Il tabellino di un giocatore: i punti vengono dai tiri, i tentati non scendono mai sotto i segnati. */
export function BoxEditor({
  box,
  onChange,
}: {
  box: Box;
  onChange: (b: Box) => void;
}) {
  const flat = flatten(box);
  const set = (key: Field, v: number) => {
    const next: Flat = { ...flat, [key]: v };
    const f = FIELDS.find((x) => x.key === key)!;
    if (f.pairOf && next[f.pairOf] < v) next[f.pairOf] = v;
    if (f.attemptOf && next[f.attemptOf] > v) next[f.attemptOf] = v;
    const fg2m = next.rimM + next.midM;
    onChange({
      ...box,
      fgrm: next.rimM,
      fgra: next.rimA,
      fg2m,
      fg2a: next.rimA + next.midA,
      fg3m: next.fg3m,
      fg3a: next.fg3a,
      oreb: next.oreb,
      dreb: next.dreb,
      ast: next.ast,
      stl: next.stl,
      blk: next.blk,
      tov: next.tov,
      fouls: next.fouls,
      pts: fg2m * 2 + next.fg3m * 3,
    });
  };
  const pts = normalizeBox(box).pts;
  return (
    <div className="grid grid-cols-2 gap-2">
      {FIELDS.map((f) => (
        <Stepper
          key={f.key}
          compact
          label={f.label}
          value={flat[f.key]}
          onChange={(v) => set(f.key, v)}
        />
      ))}
      <div className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-ball-soft text-ball">
        <span className="num text-[24px]" data-testid="box-points">
          {pts}
        </span>
        <span className="text-[12px] font-semibold">punti</span>
      </div>
    </div>
  );
}
