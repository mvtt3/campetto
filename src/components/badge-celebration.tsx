"use client";

import { useEffect, useMemo, useState } from "react";
import { BADGE_BY_KEY, type BadgeUnlock } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { BadgeMedal, TIER_STYLE } from "./badge-medal";
import { Button } from "./ui/basics";

const key = (u: BadgeUnlock) => `${u.key}:${u.tier}`;

/**
 * Shows the unlock animation the first time the app is opened after a badge was
 * earned. On a brand new device everything already earned counts as seen.
 */
export function BadgeCelebration() {
  const { me, engine, loading } = useData();
  const unlocks = useMemo(() => (me ? engine.badges(me.id).unlocks : []), [me, engine]);
  const [queue, setQueue] = useState<BadgeUnlock[]>([]);

  useEffect(() => {
    if (!me || loading) return;
    const storeKey = `campetto:seen-badges:${me.id}`;
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(storeKey) ?? "null");
    } catch {
      seen = null;
    }
    const all = unlocks.map(key);
    if (seen === null) {
      try {
        localStorage.setItem(storeKey, JSON.stringify(all));
      } catch {
        /* ignore */
      }
      return;
    }
    const fresh = unlocks.filter((u) => !seen!.includes(key(u)));
    if (!fresh.length) return;
    // Only the highest tier per badge, newest first, at most three.
    const best = new Map<string, BadgeUnlock>();
    for (const u of fresh) if (!best.has(u.key) || best.get(u.key)!.tier < u.tier) best.set(u.key, u);
    // Showing the queue is a response to data that just loaded.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueue([...best.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3));
    try {
      localStorage.setItem(storeKey, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, [me, unlocks, loading]);

  const current = queue[0];
  if (!current) return null;
  const def = BADGE_BY_KEY.get(current.key);
  if (!def) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="badge-title"
      className="fixed inset-0 z-[70] grid place-items-center bg-black/70 px-8 backdrop-blur-sm"
      onClick={() => setQueue((q) => q.slice(1))}
    >
      <div className="flex w-full max-w-xs flex-col items-center rounded-[28px] bg-surface px-6 pb-6 pt-8 text-center ring-1 ring-line">
        <BadgeMedal icon={def.icon} tier={current.tier} size={112} animate key={key(current)} />
        <p className="mt-5 text-[13px] text-muted">Badge sbloccato</p>
        <h2 id="badge-title" className="title mt-1 text-[26px]">
          {def.name}
        </h2>
        <p className="mt-1 font-semibold" style={{ color: current.tier >= 3 ? "var(--gold)" : "var(--text)" }}>
          {TIER_STYLE[current.tier].label}
        </p>
        <p className="mt-2 text-[14px] text-muted">{def.description}</p>
        <Button variant="primary" block className="mt-6" onClick={() => setQueue((q) => q.slice(1))}>
          {queue.length > 1 ? "Avanti" : "Grande"}
        </Button>
      </div>
    </div>
  );
}
