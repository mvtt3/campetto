"use client";

import clsx from "clsx";
import { Scale, Shuffle } from "lucide-react";
import { useData } from "@/lib/data/provider";
import { winProbability } from "@/lib/stats/elo";
import { balanceTeams } from "@/lib/stats/teams";
import { shortName, TEAM_SIZE, type Format, type Team } from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { haptic } from "./ui/basics";

export type Assignment = Record<string, Team>;

export function teamIds(a: Assignment, t: Team): string[] {
  return Object.entries(a)
    .filter(([, v]) => v === t)
    .map(([k]) => k);
}

export function autoBalance(ids: string[], ratings: Map<string, number>, format: Format, shuffle = 0): Assignment | null {
  const split = balanceTeams(ids, ratings, TEAM_SIZE[format], shuffle);
  if (!split) return null;
  const out: Assignment = {};
  for (const id of split.teamA) out[id] = "A";
  for (const id of split.teamB) out[id] = "B";
  return out;
}

export function TeamPicker({
  format,
  value,
  onChange,
}: {
  format: Format;
  value: Assignment;
  onChange: (a: Assignment) => void;
}) {
  const { data, engine } = useData();
  const size = TEAM_SIZE[format];
  const players = data.players.filter((p) => !p.archived);
  const a = teamIds(value, "A");
  const b = teamIds(value, "B");
  const selected = [...a, ...b];
  const complete = a.length === size && b.length === size;
  const prob = complete ? winProbability(a, b, engine.elo.ratings) : null;

  const cycle = (id: string) => {
    haptic(6);
    const cur = value[id];
    const next = { ...value };
    if (!cur) {
      if (a.length < size) next[id] = "A";
      else if (b.length < size) next[id] = "B";
      else return;
    } else if (cur === "A") {
      if (b.length < size) next[id] = "B";
      else delete next[id];
    } else delete next[id];
    onChange(next);
  };

  const balance = (shuffle: number) => {
    const res = autoBalance(selected, engine.elo.ratings, format, shuffle);
    if (res) onChange(res);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-ball" /> A {a.length}/{size}
        </span>
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="h-2.5 w-2.5 rounded-full bg-text" /> B {b.length}/{size}
        </span>
        <span className="ml-auto text-muted">Tocca per assegnare</span>
      </div>

      <div className="scroll-area -mx-1 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 px-1">
        {players.map((p) => {
          const t = value[p.id];
          return (
            <button
              key={p.id}
              onClick={() => cycle(p.id)}
              data-testid={`pick-${p.id}`}
              aria-label={`${shortName(p, data.players)}${t ? `, squadra ${t}` : ""}`}
              className={clsx(
                "flex h-14 items-center gap-2.5 rounded-[16px] px-2.5 text-left transition-colors",
                t === "A" && "bg-ball text-ball-ink",
                t === "B" && "bg-text text-bg",
                !t && "bg-raised ring-1 ring-line ring-inset",
              )}
            >
              <Avatar player={p} size={34} href={false} ring="none" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{shortName(p, data.players)}</span>
              {t && <span className="num text-[18px]">{t}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {prob !== null && (
          <div aria-label={`Probabilità di vittoria: A ${Math.round(prob * 100)}%, B ${Math.round((1 - prob) * 100)}%`}>
            <div className="mb-1 flex justify-between text-[12px] font-semibold">
              <span>A {Math.round(prob * 100)}%</span>
              <span className="text-muted">Previsione</span>
              <span>B {Math.round((1 - prob) * 100)}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-text">
              <div className="h-full bg-ball transition-[width]" style={{ width: `${prob * 100}%` }} />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            disabled={selected.length !== size * 2}
            onClick={() => balance(0)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-raised text-[14px] font-semibold ring-1 ring-line ring-inset disabled:opacity-40"
          >
            <Scale size={17} /> Equilibra
          </button>
          <button
            disabled={selected.length !== size * 2}
            onClick={() => balance(1)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[14px] bg-raised text-[14px] font-semibold ring-1 ring-line ring-inset disabled:opacity-40"
          >
            <Shuffle size={17} /> Rimescola
          </button>
        </div>
      </div>
    </div>
  );
}
