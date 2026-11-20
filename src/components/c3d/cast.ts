import type { Preset } from "./build";

/**
 * I personaggi dell'app che hanno già il loro 3D (gli altri restano disegnati finché non
 * arriva il loro modello). Solo dati: importarlo non scarica il 3D.
 */
const PRESET_OF: Partial<Record<string, Preset>> = {
  collana: "jack",
  occhiali: "kenji",
  bomber: "bomber",
  bandana: "fernando",
  lungo: "lukas",
  coppola: "giacomo",
  muscoli: "kofi",
  rimbalzo: "ventosa",
  cecchino: "cecchino",
  regista: "regista",
  muro: "muro",
  lampo: "lampo",
  jolly: "jolly",
};

export const preset3d = (character: string): Preset | null =>
  PRESET_OF[character] ?? null;
