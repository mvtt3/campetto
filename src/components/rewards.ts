"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { BadgeState } from "@/lib/badges";
import { useData } from "@/lib/data/provider";
import type { Match } from "@/lib/types";
import { AVATAR_PRESETS, type AvatarPresetId } from "./avatar-presets";
import { characterProgress } from "./character";

/**
 * Le novità da "riscattare", come nei giochi di carte: ogni badge (o livello) appena
 * guadagnato e ogni personaggio appena sbloccato resta segnato come "Nuovo" (con il
 * pallino rosso sul Profilo) finché non lo apri nella sua collezione.
 * Resta sul telefono, per giocatore.
 */

const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function read(key: string): string[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, list: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* il telefono non salva: vale solo per ora */
  }
}

const WEEKS_3 = 21 * 86_400_000;

/**
 * Su un telefono nuovo: chi gioca da poco (prima partita nelle ultime tre settimane)
 * trova tutto da scoprire; chi c'è da tempo e cambia telefono non si ritrova
 * decine di novità vecchie.
 */
export function isNewcomer(playerId: string, matches: Match[], now = Date.now()): boolean {
  // Nei test e nell'anteprima locale (dati di prova) il telefono nuovo conta come "c'è da tempo",
  // a meno di chiederlo apposta (?telefono=nuovo: come chi entra per la prima volta).
  try {
    if (localStorage.getItem("campetto:use-mock") === "1") return localStorage.getItem("campetto:mock:telefono-nuovo") === "1";
  } catch {
    /* ignore */
  }
  const mine = matches.filter((m) => m.players.some((p) => p.playerId === playerId));
  if (!mine.length) return true;
  const first = Math.min(...mine.map((m) => new Date(m.playedAt).getTime()));
  return now - first < WEEKS_3;
}

const badgeId = (s: BadgeState) => `${s.def.key}:${s.tier}`;

export interface NewRewards {
  /** Badge con un livello nuovo da aprire. */
  badges: Set<string>;
  /** Personaggi appena sbloccati da aprire. */
  characters: Set<AvatarPresetId>;
  total: number;
  claimBadge: (key: string) => void;
  claimCharacter: (id: AvatarPresetId) => void;
}

const NONE: NewRewards = { badges: new Set(), characters: new Set(), total: 0, claimBadge: () => {}, claimCharacter: () => {} };

export function useNewRewards(): NewRewards {
  const { me, engine, data, loading } = useData();
  const v = useSyncExternalStore(subscribe, () => version, () => 0);
  return useMemo(() => {
    // Il numero non cambia mentre gioca la festa: si legge e basta.
    void v;
    if (!me || loading) return NONE;
    const states = engine.badges(me.id).states;
    const got = states.filter((s) => s.tier > 0);
    const openChars = AVATAR_PRESETS.filter((p) => p.rarity !== "base" && characterProgress(p.id, states).unlocked).map((p) => p.id as AvatarPresetId);

    const bKey = `campetto:badge-riscattati:${me.id}`;
    const cKey = `campetto:personaggi-riscattati:${me.id}`;
    let bSeen = read(bKey);
    let cSeen = read(cKey);
    if (bSeen === null || cSeen === null) {
      const fresh = isNewcomer(me.id, data.matches);
      if (bSeen === null) write(bKey, (bSeen = fresh ? [] : got.map(badgeId)));
      if (cSeen === null) write(cKey, (cSeen = fresh ? [] : openChars));
    }
    const badges = new Set(got.filter((s) => !bSeen!.includes(badgeId(s))).map((s) => s.def.key));
    const characters = new Set(openChars.filter((id) => !cSeen!.includes(id)));
    return {
      badges,
      characters,
      total: badges.size + characters.size,
      claimBadge(key) {
        const s = got.find((x) => x.def.key === key);
        if (!s || !badges.has(key)) return;
        const list = read(bKey) ?? [];
        write(bKey, [...list.filter((x) => !x.startsWith(`${key}:`)), badgeId(s)]);
        bump();
      },
      claimCharacter(id) {
        if (!characters.has(id)) return;
        write(cKey, [...(read(cKey) ?? []), id]);
        bump();
      },
    };
  }, [me, engine, data.matches, loading, v]);
}
