import { ELO_START, winProbability } from "./elo";

export interface Split {
  teamA: string[];
  teamB: string[];
  /** Probability that A wins (0.5 = perfectly balanced). */
  probA: number;
  /** |probA − 0.5|, lower is better. */
  imbalance: number;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      acc.push(items[i]);
      rec(i + 1, acc);
      acc.pop();
    }
  };
  rec(0, []);
  return out;
}

/**
 * Every possible split of the present players into two teams of `teamSize`,
 * ranked from most to least balanced. Extra players (beyond 2·teamSize) sit out:
 * we try every choice of who plays, preferring to rest the most recent ones is
 * left to the caller, so here the first 2·teamSize players are used.
 */
export function rankSplits(playerIds: string[], ratings: Map<string, number>, teamSize: number): Split[] {
  const pool = playerIds.slice(0, teamSize * 2);
  if (pool.length < 2) return [];
  const size = Math.min(teamSize, Math.floor(pool.length / 2));
  const first = pool[0];
  const seen = new Set<string>();
  const splits: Split[] = [];
  for (const combo of combinations(pool, size)) {
    // Fix the first player in team A to avoid mirrored duplicates.
    if (!combo.includes(first)) continue;
    const teamA = combo;
    const teamB = pool.filter((p) => !teamA.includes(p)).slice(0, size);
    const key = [...teamA].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    const r = new Map(ratings);
    for (const id of pool) if (!r.has(id)) r.set(id, ELO_START);
    const probA = winProbability(teamA, teamB, r);
    splits.push({ teamA, teamB, probA, imbalance: Math.abs(probA - 0.5) });
  }
  return splits.sort((a, b) => a.imbalance - b.imbalance);
}

/**
 * Picks a balanced split. `shuffle` > 0 picks among the near-best options so the
 * "rimescola" button gives different teams that are still fair.
 */
export function balanceTeams(
  playerIds: string[],
  ratings: Map<string, number>,
  teamSize: number,
  shuffle = 0,
  random: () => number = Math.random,
): Split | null {
  const ranked = rankSplits(playerIds, ratings, teamSize);
  if (!ranked.length) return null;
  if (!shuffle) return ranked[0];
  const best = ranked[0].imbalance;
  const candidates = ranked.filter((s) => s.imbalance <= best + 0.06).slice(0, 6);
  return candidates[Math.floor(random() * candidates.length)] ?? ranked[0];
}
