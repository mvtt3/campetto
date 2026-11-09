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
 * ranked from most to least balanced. With `maxSubs` the extra players (up to
 * `maxSubs` per team) join as substitutes: teams of 2 and 3 for five players in
 * a 2v2, the strength being the average of everyone who rotates. Beyond that,
 * the last arrived sit out. Within each team the order follows the pool, so the
 * last arrived are the substitutes.
 */
export function rankSplits(
  playerIds: string[],
  ratings: Map<string, number>,
  teamSize: number,
  maxSubs = 0,
): Split[] {
  const pool = playerIds.slice(0, (teamSize + maxSubs) * 2);
  if (pool.length < 2) return [];
  const size = Math.min(teamSize, Math.floor(pool.length / 2));
  const used =
    maxSubs > 0 && pool.length > size * 2 && size === teamSize
      ? pool
      : pool.slice(0, size * 2);
  const ks = [
    ...new Set([Math.floor(used.length / 2), Math.ceil(used.length / 2)]),
  ];
  const first = used[0];
  const seen = new Set<string>();
  const splits: Split[] = [];
  const r = new Map(ratings);
  for (const id of used) if (!r.has(id)) r.set(id, ELO_START);
  for (const k of ks)
    for (const combo of combinations(used, k)) {
      // Fix the first player in team A to avoid mirrored duplicates.
      if (!combo.includes(first)) continue;
      const teamA = combo;
      const teamB = used.filter((p) => !teamA.includes(p));
      const key = [...teamA].sort().join(",");
      if (seen.has(key)) continue;
      seen.add(key);
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
  maxSubs = 0,
): Split | null {
  const ranked = rankSplits(playerIds, ratings, teamSize, maxSubs);
  if (!ranked.length) return null;
  if (!shuffle) return ranked[0];
  const best = ranked[0].imbalance;
  const candidates = ranked
    .filter((s) => s.imbalance <= best + 0.06)
    .slice(0, 6);
  return candidates[Math.floor(random() * candidates.length)] ?? ranked[0];
}
