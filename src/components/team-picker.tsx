"use client";

import { play } from "@/lib/sound";
import clsx from "clsx";
import { RefreshCw, Scale, Shuffle } from "lucide-react";
import { useData } from "@/lib/data/provider";
import { winProbability } from "@/lib/stats/elo";
import { balanceTeams } from "@/lib/stats/teams";
import {
  MAX_SUBS,
  maxPerTeam,
  shortName,
  TEAM_SIZE,
  type Format,
  type Team,
} from "@/lib/types";
import { Avatar } from "./ui/avatar";
import { haptic } from "./ui/basics";
import { InfoTip } from "./ui/info";

export type Assignment = Record<string, Team>;

export function teamIds(a: Assignment, t: Team): string[] {
  return Object.entries(a)
    .filter(([, v]) => v === t)
    .map(([k]) => k);
}

/** Chi è un cambio: in ogni squadra, chi è stato messo dopo i titolari del formato. */
export function subsOf(a: Assignment, format: Format): Set<string> {
  const size = TEAM_SIZE[format];
  return new Set([
    ...teamIds(a, "A").slice(size),
    ...teamIds(a, "B").slice(size),
  ]);
}

/** Le squadre vanno bene: almeno il formato, al massimo due cambi a testa. */
export function teamsReady(a: Assignment, format: Format): boolean {
  const size = TEAM_SIZE[format];
  const max = maxPerTeam(format);
  const na = teamIds(a, "A").length;
  const nb = teamIds(a, "B").length;
  return na >= size && nb >= size && na <= max && nb <= max;
}

/** Squadre equilibrate (fino a due per squadra) entra come cambio. */
export function autoBalance(
  ids: string[],
  ratings: Map<string, number>,
  format: Format,
  shuffle = 0,
): Assignment | null {
  const split = balanceTeams(
    ids,
    ratings,
    TEAM_SIZE[format],
    shuffle,
    Math.random,
    format === "1v1" ? 0 : MAX_SUBS,
  );
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
  const max = maxPerTeam(format);
  const players = data.players.filter((p) => !p.archived);
  const a = teamIds(value, "A");
  const b = teamIds(value, "B");
  const selected = [...a, ...b];
  const subs = subsOf(value, format);
  const complete = teamsReady(value, format);
  const prob = complete ? winProbability(a, b, engine.elo.ratings) : null;

  // Un tocco: A, poi B, poi fuori. Chi va oltre il formato entra come cambio.
  const cycle = (id: string) => {
    haptic(6);
    const cur = value[id];
    const next = { ...value };
    // Chi cambia squadra passa in fondo: se la squadra è già piena, fa il cambio.
    delete next[id];
    if (!cur) {
      // Prima i titolari di A, poi quelli di B; chi arriva dopo è il cambio della squadra più corta.
      if (a.length < size) next[id] = "A";
      else if (b.length < size) next[id] = "B";
      else if (a.length < max && a.length <= b.length) next[id] = "A";
      else if (b.length < max) next[id] = "B";
      else if (a.length < max) next[id] = "A";
      else return;
    } else if (cur === "A" && b.length < max) next[id] = "B";
    onChange(next);
  };

  const balance = (shuffle: number) => {
    const res = autoBalance(selected, engine.elo.ratings, format, shuffle);
    if (res) onChange(res);
  };
  const canBalance = selected.length >= size * 2 && selected.length <= max * 2;
  const count = (t: Team, n: number) => {
    const extra = Math.max(0, n - size);
    return (
      <span className="flex items-center gap-1.5 font-semibold">
        <span
          className={clsx(
            "h-2.5 w-2.5 rounded-full",
            t === "A" ? "bg-ball" : "bg-text",
          )}
        />{" "}
        {t} {Math.min(n, size)}/{size}
        {extra > 0 && (
          <span className="flex items-center gap-0.5 text-muted">
            + <RefreshCw size={11} aria-hidden /> {extra}
          </span>
        )}
      </span>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2.5 text-[13px]">
        {count("A", a.length)}
        {count("B", b.length)}
        <span className="ml-auto flex items-center gap-1 text-muted">
          Tocca per assegnare
          {max > size && (
            <InfoTip label="Come funzionano i cambi" size={16}>
              Siete di più? Continua a toccare: chi supera il {format} entra
              come cambio e gioca a rotazione. Massimo due cambi per squadra, e
              la partita conta per tutti
            </InfoTip>
          )}
        </span>
      </div>

      <div className="scroll-area -mx-1 grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 px-1">
        {players.map((p) => {
          const t = value[p.id];
          return (
            <button
              key={p.id}
              onClick={() => cycle(p.id)}
              data-testid={`pick-${p.id}`}
              aria-label={`${shortName(p, data.players)}${t ? `, squadra ${t}${subs.has(p.id) ? ", cambio" : ""}` : ""}`}
              className={clsx(
                "flex h-14 items-center gap-2.5 rounded-2xl px-2.5 text-left transition-colors",
                t === "A" && "bg-ball text-ball-ink",
                t === "B" && "bg-text text-bg",
                !t && "bg-raised",
              )}
            >
              <span className="relative shrink-0">
                <Avatar player={p} size={34} href={false} ring="none" />
                {subs.has(p.id) && (
                  <span className="absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-edge bg-volt text-volt-ink">
                    <RefreshCw size={10} strokeWidth={3} aria-hidden />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[14px] font-semibold">
                  {shortName(p, data.players)}
                </span>
                {subs.has(p.id) && (
                  <span className="block text-[11.5px] font-bold opacity-80">
                    cambio
                  </span>
                )}
              </span>
              {t && <span className="num text-[18px]">{t}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        {prob !== null && (
          <div
            aria-label={`Probabilità di vittoria: A ${Math.round(prob * 100)}%, B ${Math.round((1 - prob) * 100)}%`}
          >
            <div className="mb-1 flex justify-between text-[12px] font-semibold">
              <span>A {Math.round(prob * 100)}%</span>
              <span className="text-muted">Previsione</span>
              <span>B {Math.round((1 - prob) * 100)}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-text">
              <div
                className="h-full bg-ball transition-[width]"
                style={{ width: `${prob * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            disabled={!canBalance}
            onClick={() => balance(0)}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-raised text-[14px] font-semibold disabled:opacity-40"
          >
            <Scale size={17} /> Equilibra
          </button>
          <button
            disabled={!canBalance}
            onClick={() => {
              play("shuffle");
              balance(1);
            }}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-raised text-[14px] font-semibold disabled:opacity-40"
          >
            <Shuffle size={17} /> Rimescola
          </button>
        </div>
      </div>
    </div>
  );
}
