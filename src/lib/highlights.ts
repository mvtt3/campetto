import { matchMvp } from "./stats/match-mvp";
import { normalizeBox } from "./stats/player";
import {
  COMMENT_MAX,
  shortName,
  type Highlight,
  type HighlightClip,
  type Match,
  type Player,
} from "./types";

/** Il feed: un video per partita, dalla più recente. Senza la partita (eliminata) il video non c'è. */
export function feedOrder(
  highlights: Highlight[],
  matches: Pick<Match, "id" | "playedAt">[],
): Highlight[] {
  const at = new Map(matches.map((m) => [m.id, m.playedAt]));
  return highlights
    .filter((h) => at.has(h.matchId) && h.videoUrl)
    .sort(
      (a, b) =>
        at.get(b.matchId)!.localeCompare(at.get(a.matchId)!) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/** Il canestro che si sta vedendo, dal secondo del video. */
export function clipIndexAt(clips: HighlightClip[], t: number): number {
  let idx = -1;
  for (let i = 0; i < clips.length; i++) if (clips[i].t <= t + 0.05) idx = i;
  return idx;
}

/** "Paolo e Simone": i nomi di una squadra, come si dicono. */
function teamNames(m: Match, team: "A" | "B", players: Player[]): string {
  const names = m.players
    .filter((p) => p.team === team && !p.sub)
    .map((p) =>
      shortName(
        players.find((x) => x.id === p.playerId),
        players,
      ),
    );
  if (names.length <= 1) return names[0] ?? (team === "A" ? "Blu" : "Arancio");
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** Per l'apertura del video: le due squadre e il risultato, su righe separate. */
export function scoreOf(
  m: Match,
  players: Player[],
): { a: string; b: string; score: string } {
  return {
    a: teamNames(m, "A", players),
    b: teamNames(m, "B", players),
    score: `${m.scoreA}–${m.scoreB}`,
  };
}

/** Una voce della striscia: l'etichetta piccola e il dato grande ("PUNTI · Paolo 14"). */
export interface TickerItem {
  k: string;
  v: string;
}

/**
 * La striscia di numeri che scorre sotto al video: risultato, MVP e i migliori della
 * partita. Solo quello che c'è davvero nel tabellino (niente zeri).
 */
export function tickerItems(m: Match, players: Player[]): TickerItem[] {
  const name = (id: string) =>
    shortName(
      players.find((p) => p.id === id),
      players,
    );
  const items: TickerItem[] = [
    {
      k: "Finale",
      v: `${teamNames(m, "A", players)} ${m.scoreA}–${m.scoreB} ${teamNames(m, "B", players)}`,
    },
  ];
  const mvp = matchMvp(m);
  if (mvp) items.push({ k: "MVP", v: name(mvp.playerId) });
  const lines = m.players
    .filter((p) => p.hasStats)
    .map((p) => ({ id: p.playerId, b: normalizeBox(p.box) }));
  const best = (
    k: string,
    pick: (b: ReturnType<typeof normalizeBox>) => number,
  ) => {
    const top = [...lines].sort(
      (x, y) => pick(y.b) - pick(x.b) || x.id.localeCompare(y.id),
    )[0];
    if (top && pick(top.b) > 0)
      items.push({ k, v: `${name(top.id)} ${pick(top.b)}` });
  };
  best("Punti", (b) => b.pts);
  best("Rimbalzi", (b) => b.oreb + b.dreb);
  best("Assist", (b) => b.ast);
  best("Rubate", (b) => b.stl);
  best("Stoppate", (b) => b.blk);
  const threes = lines.reduce((s, l) => s + l.b.fg3m, 0);
  if (threes > 0) items.push({ k: "Triple", v: String(threes) });
  return items;
}

/** La striscia letta tutta di fila (per i lettori di schermo). */
export function tickerText(items: TickerItem[]): string {
  return items.map((t) => `${t.k} ${t.v}`).join(" · ");
}

/** Da quanto è stato scritto un commento: "adesso", "5 min", "2 h", "ieri", "3 g", poi la data. */
export function timeAgo(iso: string, now: Date): string {
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "adesso";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h`;
  const days = Math.floor(s / 86_400);
  if (days === 1) return "ieri";
  if (days < 7) return `${days} g`;
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  });
}

/** Il commento come si salva: senza spazi in testa e in coda, al massimo due righe vuote. */
export function cleanComment(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, COMMENT_MAX);
}

/** 1.234 → "1,2 mila", come nelle app: i numeri piccoli restano interi. */
export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000)
    return `${(Math.floor(n / 100) / 10).toString().replace(".", ",")} mila`;
  return `${Math.floor(n / 1000)} mila`;
}

/** Il titolo del video: il giorno della partita e, se quella sera se ne sono giocate più, quale. */
export function highlightTitle(
  m: Pick<Match, "id" | "playedAt">,
  all: Pick<Match, "id" | "playedAt">[],
): string {
  const d = new Date(m.playedAt);
  const sameDay = all
    .filter((x) => new Date(x.playedAt).toDateString() === d.toDateString())
    .sort((a, b) => a.playedAt.localeCompare(b.playedAt));
  const day = d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  if (sameDay.length <= 1) return cap;
  return `${cap} · partita ${sameDay.findIndex((x) => x.id === m.id) + 1}`;
}
