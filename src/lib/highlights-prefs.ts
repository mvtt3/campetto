/**
 * Cosa succede quando un highlight finisce: parte il prossimo (come i Reels) oppure
 * ricomincia quello che stai guardando. Si sceglie dalle impostazioni e vale su questo telefono.
 */
export type HighlightEnd = "next" | "loop";

const KEY = "campetto:hl-dopo";

export function highlightEnd(): HighlightEnd {
  try {
    return localStorage.getItem(KEY) === "loop" ? "loop" : "next";
  } catch {
    return "next";
  }
}

export function setHighlightEnd(v: HighlightEnd) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* il telefono non salva: vale solo per ora */
  }
}
