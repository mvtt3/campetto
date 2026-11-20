"use client";

import { useMemo } from "react";
import { characterOf, characterProgress } from "@/components/character";
import type { Outfit, Preset } from "@/components/c3d/build";
import { useData } from "@/lib/data/provider";
import { passAllowed } from "@/lib/pass/actions";
import { ITEM_BY_ID, type Item, type Slot } from "@/lib/pass/catalog";
import { computePass, type PassProgress } from "@/lib/pass/engine";
import { usePassState, type PassState } from "@/lib/pass/store";
import { useNow } from "@/lib/use-now";

/** Il personaggio 3D di partenza, da quello che hai già scelto nell'app. */
const START: Record<string, Preset> = { collana: "jack", occhiali: "kenji", bomber: "bomber" };

export interface PassView {
  allowed: boolean;
  st: PassState;
  prog: PassProgress | null;
  /** Il personaggio che indossi adesso. */
  preset: Preset;
  /** Quello che indossi, già pronto per il 3D. */
  outfit: Outfit;
  number?: string;
  playerId: string | null;
  /** Il Bomber si sblocca coi badge, come nell'app. */
  bomberOpen: boolean;
}

/** Trasforma "cosa indossi" (id del catalogo) nei pezzi per il 3D. */
export function looksOf(outfit: Partial<Record<Slot, string>>, owned?: Set<string>): Outfit {
  const out: Outfit = {};
  for (const [slot, id] of Object.entries(outfit) as [Slot, string][]) {
    if (slot === "skin" || !id || (owned && !owned.has(id))) continue;
    const it = ITEM_BY_ID.get(id);
    if (it && it.slot === slot) out[slot] = it.look;
  }
  return out;
}

export function presetOf(item: Item | undefined): Preset | null {
  return item?.look.kind === "skin" ? item.look.preset : null;
}

export function usePass(): PassView {
  const { me, data, engine } = useData();
  const st = usePassState(me?.id);
  const now = useNow(60_000);
  const allowed = passAllowed(me);
  const bomberOpen = useMemo(() => {
    if (!me) return false;
    if (characterOf(me) === "bomber") return true;
    return characterProgress("bomber", engine.badges(me.id).states).unlocked;
  }, [me, engine]);
  const prog = useMemo(() => {
    if (!me || !allowed) return null;
    const p = computePass(me.id, data.matches, st, now);
    if (bomberOpen) p.owned.add("skin-bomber");
    return p;
  }, [me, allowed, data.matches, st, now, bomberOpen]);
  const fallback: Preset = (me && START[characterOf(me)]) || "jack";
  const chosen = presetOf(ITEM_BY_ID.get(st.outfit.skin ?? ""));
  const preset = chosen && prog?.owned.has(`skin-${chosen}`) ? chosen : fallback;
  const outfit = useMemo(() => looksOf(st.outfit, prog?.owned), [st.outfit, prog]);
  return {
    allowed,
    st,
    prog,
    preset,
    outfit,
    number: me?.jerseyNumber != null ? String(me.jerseyNumber) : undefined,
    playerId: me?.id ?? null,
    bomberOpen,
  };
}
