"use client";

import { normalizeBox } from "@/lib/stats/player";
import type { Box, BoxKey } from "@/lib/types";
import { Stepper } from "./ui/basics";

const FIELDS: { key: BoxKey; label: string; pairOf?: BoxKey; attemptOf?: BoxKey }[] = [
  { key: "fg2m", label: "Da 2 segnati", pairOf: "fg2a" },
  { key: "fg2a", label: "Da 2 tentati", attemptOf: "fg2m" },
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

/** Box score editor: points come from the shots, attempts never fall below makes. */
export function BoxEditor({ box, onChange }: { box: Box; onChange: (b: Box) => void }) {
  const set = (key: BoxKey, v: number) => {
    const next = { ...box, [key]: v };
    const f = FIELDS.find((x) => x.key === key)!;
    if (f.pairOf && next[f.pairOf] < v) next[f.pairOf] = v;
    if (f.attemptOf && next[f.attemptOf] > v) next[f.attemptOf] = v;
    next.pts = next.fg2m * 2 + next.fg3m * 3;
    onChange(next);
  };
  const pts = normalizeBox(box).pts;
  return (
    <div className="grid grid-cols-2 gap-2">
      {FIELDS.map((f) => (
        <Stepper key={f.key} compact label={f.label} value={box[f.key]} onChange={(v) => set(f.key, v)} />
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
