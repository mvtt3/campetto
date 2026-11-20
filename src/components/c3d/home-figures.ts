"use client";

import { useMemo } from "react";
import { characterOf } from "@/components/character";
import { looksOf } from "@/components/pass/use-pass";
import { passAllowed } from "@/lib/pass/actions";
import { usePassState } from "@/lib/pass/store";
import type { Player } from "@/lib/types";
import type { Outfit } from "./build";
import { preset3d } from "./cast";
import type { PhotoSpec } from "./figure-photos";

/** Le foto 3D della Home: il tuo personaggio nella scheda del mese e l'MVP con la coppa. */
export const MONTH_FIG = { w: 140, h: 214 };
export const MVP_FIG = { w: 172, h: 340 };

/** Quello che indossi nel camerino, uguale ovunque (così le foto si ritrovano). */
export function useMyLook(me: Player | null | undefined): Outfit {
  const st = usePassState(me?.id);
  return useMemo(() => looksOf(st.outfit), [st.outfit]);
}

const numberOf = (p: Player) =>
  p.jerseyNumber != null ? String(p.jerseyNumber) : undefined;

/** Le due foto della Home, se il 3D è acceso e il personaggio ha già il suo modello. */
export function homeFigures(
  me: Player | null | undefined,
  mvp: Player | null | undefined,
  myLook: Outfit,
) {
  if (!me || !passAllowed(me)) return { month: null, mvp: null };
  const pm = preset3d(characterOf(me));
  const month: PhotoSpec | null = pm
    ? {
        preset: pm,
        outfit: myLook,
        number: numberOf(me),
        award: "riposo",
        yaw: -0.4,
        ...MONTH_FIG,
      }
    : null;
  const pv = mvp ? preset3d(characterOf(mvp)) : null;
  const best: PhotoSpec | null =
    mvp && pv
      ? {
          preset: pv,
          outfit: mvp.id === me.id ? myLook : {},
          number: numberOf(mvp),
          award: "oro",
          yaw: 0.3,
          ...MVP_FIG,
        }
      : null;
  return { month, mvp: best };
}
