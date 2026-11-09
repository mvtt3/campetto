/**
 * I tiri trovati nel video da `scripts/video/tiri.py`: secondo del video, se è entrato e da dove
 * è partito. Nella schermata "Segna dal video" servono a saltare da un tiro all'altro e a
 * proporre l'azione giusta; chi ha tirato lo sceglie sempre chi segna.
 */
export interface FoundShot {
  t: number;
  made: boolean;
  zone: "sotto" | "fuori";
}

/** Legge il file di tiri.py ({ tiri: [{ t, dentro, da }] }). Lancia un errore leggibile se non lo è. */
export function parseShots(text: string): FoundShot[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("Questo file non è un elenco di tiri: scegli il .json creato da tiri.py");
  }
  const list = (raw as { tiri?: unknown })?.tiri;
  if (!Array.isArray(list))
    throw new Error("Questo file non è un elenco di tiri: scegli il .json creato da tiri.py");
  const shots: FoundShot[] = [];
  for (const s of list) {
    const t = Number((s as { t?: unknown })?.t);
    if (!Number.isFinite(t) || t < 0) continue;
    shots.push({
      t,
      made: (s as { dentro?: unknown }).dentro === true,
      zone: (s as { da?: unknown }).da === "sotto" ? "sotto" : "fuori",
    });
  }
  if (!shots.length) throw new Error("Nel file non ci sono tiri");
  return shots.sort((a, b) => a.t - b.t);
}

/** 84.2 → "1:24" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** L'azione da proporre per un tiro trovato (la tripla non si distingue: si corregge con +3). */
export function suggestedKind(shot: FoundShot): "2pt" | "miss2" {
  return shot.made ? "2pt" : "miss2";
}
