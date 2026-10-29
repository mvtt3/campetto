"use client";

import { useEffect, useMemo, useState } from "react";
import { BADGE_BY_KEY, type BadgeUnlock } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import { BadgeMedal, TIER_STYLE } from "./badge-medal";
import { motion } from "motion/react";
import { Mascot } from "./mascot";
import { Button, CourtLines } from "./ui/basics";
import { useToast } from "./ui/toast";
import { RARITY, rarityProgress, type Rarity } from "./avatar-presets";

const key = (u: BadgeUnlock) => `${u.key}:${u.tier}`;

/**
 * Shows the unlock animation the first time the app is opened after a badge was
 * earned. On a brand new device everything already earned counts as seen.
 */
export function BadgeCelebration() {
  const { me, engine, loading } = useData();
  const unlocks = useMemo(() => (me ? engine.badges(me.id).unlocks : []), [me, engine]);
  const [queue, setQueue] = useState<BadgeUnlock[]>([]);
  const toast = useToast();

  // Figurine appena sbloccate: un avviso di Spicchio, una volta sola per telefono.
  useEffect(() => {
    if (!me || loading) return;
    const tiers = engine.badges(me.id).states.map((b) => b.tier);
    const open = (["rara", "epica", "leggendaria"] as Rarity[]).filter((r) => rarityProgress(r, tiers).unlocked);
    const storeKey = `campetto:figurine:${me.id}`;
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(storeKey) ?? "null");
      localStorage.setItem(storeKey, JSON.stringify(open));
    } catch {
      return;
    }
    if (seen === null) return;
    const fresh = open.filter((r) => !seen!.includes(r));
    if (fresh.length) toast(`Hai sbloccato le figurine ${RARITY[fresh[fresh.length - 1]].label.toLowerCase()}! Le trovi in Impostazioni`);
  }, [me, engine, loading, toast]);

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
      className="fixed inset-0 z-[70] grid place-items-center bg-[#1d1a16]/75 px-8"
      onClick={() => setQueue((q) => q.slice(1))}
    >
      <motion.div
        key={key(current)}
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="court relative flex w-full max-w-xs flex-col items-center overflow-hidden rounded-[32px] px-6 pb-6 pt-7 text-center"
      >
        <CourtLines className="absolute inset-0 h-full w-full" />
        <div className="relative flex items-end gap-1">
          <Mascot pose="esulta" size={86} />
          <BadgeMedal icon={def.icon} tier={current.tier} size={92} animate />
        </div>
        <p className="relative mt-4 text-[14px] font-semibold text-volt">Badge sbloccato</p>
        <h2 id="badge-title" className="display relative mt-1 text-[28px]">
          {def.name}
        </h2>
        <p className="relative mt-1 font-bold">{TIER_STYLE[current.tier].label}</p>
        <p className="relative mt-2 text-[14px] text-white/85">{def.description}</p>
        <Button block variant="light" className="relative mt-6 text-court" onClick={() => setQueue((q) => q.slice(1))}>
          {queue.length > 1 ? "Avanti" : "Grande!"}
        </Button>
      </motion.div>
    </div>
  );
}
