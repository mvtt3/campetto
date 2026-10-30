"use client";

import { useState } from "react";
import { useData } from "@/lib/data/provider";
import type { BadgeCategory, BadgeState } from "@/lib/badges";
import { BadgeMedal, BadgeTile, TIER_STYLE } from "./badge-medal";
import { Button, Segmented } from "./ui/basics";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { say } from "@/lib/voice";
import { play } from "@/lib/sound";
import { useNewRewards } from "./rewards";

const CATS: { value: BadgeCategory | "tutti"; label: string }[] = [
  { value: "tutti", label: "Tutti" },
  { value: "carriera", label: "Carriera" },
  { value: "partita", label: "Partita" },
  { value: "speciali", label: "Speciali" },
];

export function BadgeCollection({ playerId, editable }: { playerId: string; editable?: boolean }) {
  const { engine, data, backend, mutate } = useData();
  const toast = useToast();
  const player = data.players.find((p) => p.id === playerId);
  const states = engine.badges(playerId).states;
  const [cat, setCat] = useState<BadgeCategory | "tutti">("tutti");
  const [open, setOpen] = useState<BadgeState | null>(null);
  const showcase = player?.showcase ?? [];
  const unlocked = states.filter((s) => s.tier > 0).length;

  const progress = (s: BadgeState) => (s.next ? (s.value - s.prev) / (s.next - s.prev) : 1);
  // Nella propria collezione, i badge appena guadagnati stanno in cima con "Nuovo" finché non li apri.
  const rewards = useNewRewards();
  const fresh = editable ? rewards.badges : new Set<string>();
  const [claimed, setClaimed] = useState<string | null>(null);
  const list = states
    .filter((s) => cat === "tutti" || s.def.category === cat)
    .sort((a, b) => Number(fresh.has(b.def.key)) - Number(fresh.has(a.def.key)) || b.tier - a.tier || progress(b) - progress(a));
  const openBadge = (s: BadgeState) => {
    if (fresh.has(s.def.key)) {
      // Riscattato: via l'etichetta, un piccolo salto e il suono dello sblocco.
      rewards.claimBadge(s.def.key);
      setClaimed(s.def.key);
      play("unlock");
    }
    setOpen(s);
  };

  const toggleShowcase = async (key: string) => {
    if (!player) return;
    let next = showcase.includes(key) ? showcase.filter((k) => k !== key) : [...showcase, key];
    if (next.length > 3) next = next.slice(-3);
    mutate((d) => ({ ...d, players: d.players.map((p) => (p.id === player.id ? { ...p, showcase: next } : p)) }));
    try {
      await backend.updateMe({ showcase: next });
      toast(showcase.includes(key) ? "L'ho tolto dalla vetrina" : "L'ho messo in vetrina");
    } catch (e) {
      toast(say(e), "error");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-center text-[14px] text-muted">
        <span className="tnum font-bold text-text">{unlocked}</span> di {states.length} sbloccati
        {editable && (fresh.size ? ` · ${fresh.size === 1 ? "uno nuovo da aprire" : `${fresh.size} nuovi da aprire`}` : " · tocca un badge per metterlo in vetrina")}
      </p>
      <Segmented value={cat} onChange={setCat} size="sm" options={CATS} />
      <div className="grid grid-cols-3 gap-2">
        {list.map((s) => (
          <BadgeTile
            key={s.def.key}
            state={s}
            selected={editable && showcase.includes(s.def.key)}
            fresh={fresh.has(s.def.key)}
            popped={claimed === s.def.key}
            onClick={() => openBadge(s)}
          />
        ))}
      </div>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.def.name ?? ""}
        description={open?.def.description}
        footer={
          editable && open && open.tier > 0 ? (
            <Button
              variant={showcase.includes(open.def.key) ? "secondary" : "primary"}
              block
              onClick={() => {
                void toggleShowcase(open.def.key);
                setOpen(null);
              }}
            >
              {showcase.includes(open.def.key) ? "Togli dalla vetrina" : "Metti in vetrina"}
            </Button>
          ) : undefined
        }
      >
        {open && (
          <div className="flex flex-col items-center gap-4 pb-2">
            <BadgeMedal icon={open.def.icon} tier={open.tier} size={92} />
            <p className="text-[15px] font-semibold">{TIER_STYLE[open.tier].label}</p>
            <p className="tnum text-[14px] text-muted">
              {open.value} {open.def.unit}
              {open.next ? `, prossimo livello a ${open.next}` : ", livello massimo"}
            </p>
            <ol className="flex w-full justify-between gap-1">
              {open.def.thresholds.map((t, i) => (
                <li key={t} className="flex flex-1 flex-col items-center gap-1.5">
                  <BadgeMedal icon={open.def.icon} tier={(open.tier > i ? i + 1 : 0) as 0 | 1 | 2 | 3 | 4 | 5} size={34} />
                  <span className="text-[11px] text-muted">{TIER_STYLE[(i + 1) as 1].label}</span>
                  <span className="tnum text-[12px] font-semibold">{t}</span>
                </li>
              ))}
            </ol>
            {open.unlockedAt && (
              <p className="text-[12.5px] text-faint">
                Ultimo livello sbloccato il {new Date(open.unlockedAt).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
