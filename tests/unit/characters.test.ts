import { describe, expect, it } from "vitest";
import { AVATAR_PRESETS, GOALS, HEAD_SHAPE, KIT, CHARACTER_TAGLINE } from "@/components/avatar-presets";
import { characterProgress, nextCharacter } from "@/components/character";
import { BADGES, BADGE_BY_KEY, computeBadges, type BadgeState } from "@/lib/badges";
import { match } from "./fixtures";

const ctx = { months: [], seasons: [] };

/** Stati dei badge "finti": ogni badge al livello indicato (o 0). */
function states(tiers: Record<string, number> = {}, values: Record<string, number> = {}): BadgeState[] {
  return BADGES.map((def) => {
    const tier = (tiers[def.key] ?? 0) as BadgeState["tier"];
    const value = values[def.key] ?? (tier ? def.thresholds[tier - 1] : 0);
    return { def, value, tier, next: null, prev: 0, unlockedAt: null };
  });
}

describe("personaggi", () => {
  it("sono più di quaranta, tutti completi e con id validi per il database", () => {
    expect(AVATAR_PRESETS.length).toBeGreaterThanOrEqual(40);
    for (const p of AVATAR_PRESETS) {
      expect(p.id).toMatch(/^[a-z]{2,20}$/);
      expect(KIT[p.id]).toBeTruthy();
      expect(HEAD_SHAPE[p.id]).toBeTruthy();
      expect(CHARACTER_TAGLINE[p.id]).toBeTruthy();
      if (p.rarity !== "base") expect(GOALS[p.id]).toBeTruthy();
    }
    expect(new Set(AVATAR_PRESETS.map((p) => p.id)).size).toBe(AVATAR_PRESETS.length);
    expect(AVATAR_PRESETS.filter((p) => p.rarity === "leggendaria")).toHaveLength(2);
  });

  it("ogni traguardo punta a un badge che esiste", () => {
    for (const g of Object.values(GOALS)) {
      if (!g || "allTier" in g) continue;
      for (const step of "all" in g ? g.all : [g]) expect(BADGE_BY_KEY.get(step.badge), step.badge).toBeTruthy();
    }
  });

  it("più sale la rarità, più alto il livello richiesto", () => {
    const tierOf = (id: string) => {
      const g = GOALS[id as keyof typeof GOALS]!;
      if ("allTier" in g) return g.allTier;
      return Math.max(...("all" in g ? g.all : [g]).map((x) => x.tier));
    };
    for (const p of AVATAR_PRESETS) {
      if (p.rarity === "rara") expect(tierOf(p.id)).toBeLessThanOrEqual(2);
      if (p.rarity === "epica") expect(tierOf(p.id)).toBeGreaterThanOrEqual(2);
      if (p.rarity === "mitica") expect(tierOf(p.id)).toBeGreaterThanOrEqual(1);
      if (p.rarity === "leggendaria") expect(tierOf(p.id)).toBe(5);
    }
  });

  it("le sfide toccano quasi tutti i badge, rubate e stoppate comprese", () => {
    const used = new Set<string>();
    for (const g of Object.values(GOALS)) if (g && !("allTier" in g)) for (const s of "all" in g ? g.all : [g]) used.add(s.badge);
    for (const k of ["rubate", "stoppate", "partita-rubate", "partita-stoppate", "fairplay", "mira", "doppia-doppia", "rimbalzi-off", "mvp-partita"]) expect(used.has(k), k).toBe(true);
    expect(used.size).toBeGreaterThanOrEqual(BADGES.length - 2);
  });

  it("un traguardo doppio si sblocca solo con tutti e due", () => {
    const half = characterProgress("uragano", states({ serie: 2 }));
    expect(half.unlocked).toBe(false);
    expect(half.steps).toHaveLength(2);
    expect(half.pct).toBeCloseTo(0.5, 1);
    expect(characterProgress("uragano", states({ serie: 2, vittorie: 2 })).unlocked).toBe(true);
  });

  it("i leggendari vogliono i badge Leggenda", () => {
    const allHof = Object.fromEntries(BADGES.map((b) => [b.key, 4]));
    expect(characterProgress("leggenda", states(allHof)).unlocked).toBe(false);
    const career = Object.fromEntries(BADGES.filter((b) => b.category === "carriera").map((b) => [b.key, 5]));
    expect(characterProgress("re", states(career)).unlocked).toBe(true);
    expect(characterProgress("leggenda", states(career)).unlocked).toBe(false);
    const all = Object.fromEntries(BADGES.map((b) => [b.key, 5]));
    expect(characterProgress("leggenda", states(all)).unlocked).toBe(true);
  });

  it("il prossimo da sbloccare è il più vicino, mai un leggendario", () => {
    const next = nextCharacter(states({}, { stoppate: 24 }));
    expect(next?.id).toBe("muro");
    expect(next?.progress.steps[0].have).toBe(24);
  });
});

describe("badge nuovi", () => {
  const line = (id: string, team: "A" | "B", box: Record<string, number>) => ({ id, team, box });
  it("doppia doppia, mira, fair play, migliore in campo, rubate e stoppate in partita", () => {
    const m = match({
      date: "2026-10-10T18:00:00Z",
      a: 21,
      b: 15,
      lines: [
        line("a", "A", { fg2m: 5, fg2a: 7, pts: 10, dreb: 8, oreb: 3, ast: 2, stl: 4, blk: 3, fouls: 0 }),
        line("b", "A", { pts: 11, fg2m: 4, fg2a: 9, fg3m: 1, fg3a: 3, ast: 1, fouls: 2 }),
        line("c", "B", { pts: 9, fg2m: 3, fg2a: 8, fg3m: 1, fg3a: 4, dreb: 2, fouls: 1 }),
        line("d", "B", { pts: 6, fg2m: 3, fg2a: 10, fouls: 0 }),
      ],
    });
    const a = computeBadges("a", [m], ctx).states;
    const v = (k: string) => a.find((s) => s.def.key === k)!.value;
    expect(v("doppia-doppia")).toBe(1);
    expect(v("mira")).toBe(1);
    expect(v("fairplay")).toBe(1);
    expect(v("mvp-partita")).toBe(1);
    expect(v("partita-rubate")).toBe(4);
    expect(v("partita-stoppate")).toBe(3);
    expect(v("rimbalzi-off")).toBe(3);
    // d ha zero falli ma tira male e non è il migliore.
    const d = computeBadges("d", [m], ctx).states;
    expect(d.find((s) => s.def.key === "fairplay")!.value).toBe(1);
    expect(d.find((s) => s.def.key === "mira")!.value).toBe(0);
    expect(d.find((s) => s.def.key === "mvp-partita")!.value).toBe(0);
  });

  it("il fair play conta solo se quel giorno i falli si segnavano", () => {
    const m = match({
      date: "2026-10-11T18:00:00Z",
      a: 21,
      b: 15,
      lines: [line("a", "A", { pts: 8 }), line("b", "B", { pts: 6 })],
    });
    expect(computeBadges("a", [m], ctx).states.find((s) => s.def.key === "fairplay")!.value).toBe(0);
  });
});

describe("MVP della partita", () => {
  it("è il migliore di chi vince, non il migliore in assoluto", async () => {
    const { matchMvp } = await import("@/lib/stats/match-mvp");
    const m = match({
      date: "2026-10-12T18:00:00Z",
      a: 21,
      b: 19,
      lines: [
        { id: "a", team: "A", box: { pts: 8, fg2m: 4, fg2a: 6, ast: 3, dreb: 2 } },
        { id: "b", team: "A", box: { pts: 13, fg2m: 5, fg2a: 9, fg3m: 1, fg3a: 2, dreb: 1 } },
        { id: "c", team: "B", box: { pts: 19, fg2m: 8, fg2a: 9, fg3m: 1, fg3a: 1, dreb: 6, ast: 4 } },
        { id: "d", team: "B", box: {} },
      ],
    });
    // a: 8 + 2 + 3 − 2 sbagliati = 11; b: 13 + 1 − 5 sbagliati = 9; c perde.
    expect(matchMvp(m)?.playerId).toBe("a");
  });

  it("a pari valutazione chi ha segnato di più; senza tabellino niente MVP", async () => {
    const { matchMvp } = await import("@/lib/stats/match-mvp");
    const tie = match({
      date: "2026-10-13T18:00:00Z",
      a: 21,
      b: 10,
      lines: [
        { id: "a", team: "A", box: { pts: 4, fg2m: 2, fg2a: 2, ast: 6 } },
        { id: "b", team: "A", box: { pts: 10, fg2m: 5, fg2a: 5 } },
        { id: "c", team: "B", box: { pts: 10, fg2m: 5, fg2a: 5 } },
        { id: "d", team: "B", box: {} },
      ],
    });
    expect(matchMvp(tie)?.playerId).toBe("b");
    const bare = match({ date: "2026-10-14T18:00:00Z", a: 21, b: 10, lines: [{ id: "a", team: "A" }, { id: "b", team: "B" }] });
    expect(matchMvp(bare)).toBeNull();
  });
});
