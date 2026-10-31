/**
 * Le notizie del Campetto, scritte dall'app a partire dalle partite: record del gruppo,
 * massimi personali, doppie e triple doppie, serie di vittorie, i migliori del mese e la
 * serata appena giocata. Più gli annunci scritti a mano (dal database). Tutto calcolato sul
 * telefono, in un attimo, senza chiedere niente al server.
 */
import { MONTHS_IT, filterMatches, sortChrono } from "./periods";
import { mvpRanking } from "./stats/awards";
import { leaderboard, STAT_BY_KEY, type StatKey } from "./stats/leaderboards";
import { computePlayerStats, doubleDigits, normalizeBox } from "./stats/player";
import { matchMvp } from "./stats/match-mvp";
import {
  shortName,
  winnerOf,
  type Match,
  type NewsPost,
  type Player,
} from "./types";
import type { EloResult } from "./stats/elo";

export type NewsIcon =
  | "record"
  | "fire"
  | "double"
  | "streak"
  | "crown"
  | "calendar"
  | "season"
  | "megaphone"
  | "leader"
  | "video";

export interface NewsStory {
  id: string;
  /** Quando è successo (per l'ordine e per "nuovo"). */
  date: string;
  icon: NewsIcon;
  title: string;
  body: string;
  /** Dove porta il tocco, se porta da qualche parte. */
  href?: string;
  /** In cima, sempre (gli annunci). */
  pinned?: boolean;
  /** Il tocco apre gli highlights (le novità sui video). */
  highlights?: boolean;
}

/** Il giorno delle stagioni: fino ad allora c'è l'anteprima, dopo la notizia cambia. */
export const SEASONS_START = new Date("2026-12-01T00:00:00+01:00");

/** Una frase tra alcune, sempre la stessa per la stessa notizia (niente cambi a ogni apertura). */
function pick(seed: string, options: string[]): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const num = (v: number, d = 1) =>
  Number.isInteger(v) ? String(v) : v.toFixed(d).replace(".", ",");

const STAT_WORDS: {
  key: "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m";
  one: string;
  many: string;
}[] = [
  { key: "pts", one: "punto", many: "punti" },
  { key: "reb", one: "rimbalzo", many: "rimbalzi" },
  { key: "ast", one: "assist", many: "assist" },
  { key: "stl", one: "palla rubata", many: "palle rubate" },
  { key: "blk", one: "stoppata", many: "stoppate" },
  { key: "fg3m", one: "tripla", many: "triple" },
];

function lineValues(m: Match, playerId: string) {
  const l = m.players.find((p) => p.playerId === playerId && p.hasStats);
  if (!l) return null;
  const b = normalizeBox(l.box);
  return {
    pts: b.pts,
    reb: b.oreb + b.dreb,
    ast: b.ast,
    stl: b.stl,
    blk: b.blk,
    fg3m: b.fg3m,
    box: l.box,
  };
}

const LEADERS: { stat: StatKey; who: string; unit: string; one: string }[] = [
  {
    stat: "punti",
    who: "il miglior realizzatore",
    unit: "punti a partita",
    one: "punto a partita",
  },
  {
    stat: "rimbalzi",
    who: "il miglior rimbalzista",
    unit: "rimbalzi a partita",
    one: "rimbalzo a partita",
  },
  {
    stat: "assist",
    who: "il miglior assistman",
    unit: "assist a partita",
    one: "assist a partita",
  },
  {
    stat: "difesa",
    who: "il miglior difensore",
    unit: "punti difesa a partita",
    one: "punto difesa a partita",
  },
  {
    stat: "rubate",
    who: "il miglior ladro di palloni",
    unit: "palle rubate a partita",
    one: "palla rubata a partita",
  },
  {
    stat: "stoppate",
    who: "il miglior stoppatore",
    unit: "stoppate a partita",
    one: "stoppata a partita",
  },
];

export function buildNews(
  matches: Match[],
  players: Player[],
  posts: NewsPost[],
  elo: EloResult,
  now = new Date(),
): NewsStory[] {
  const out: NewsStory[] = [];
  const name = (id: string) =>
    shortName(
      players.find((p) => p.id === id),
      players,
    );
  const chrono = sortChrono(matches);

  // Gli annunci scritti a mano, in cima.
  for (const p of posts)
    out.push({
      id: `post-${p.id}`,
      date: p.createdAt,
      icon:
        p.kind === "stagione"
          ? "season"
          : /highlight/i.test(p.title)
            ? "video"
            : "megaphone",
      title: p.title,
      body: p.body,
      pinned: true,
      highlights: /highlight/i.test(p.title),
    });

  if (!chrono.length) return out;

  // Le ultime due settimane di partite, divise per serata.
  const since = now.getTime() - 14 * 86_400_000;
  const recent = chrono.filter((m) => new Date(m.playedAt).getTime() >= since);
  const nights = new Map<string, Match[]>();
  for (const m of recent) {
    const k = new Date(m.playedAt).toDateString();
    nights.set(k, [...(nights.get(k) ?? []), m]);
  }

  for (const [, games] of nights) {
    const last = games[games.length - 1];
    const date = last.playedAt;
    const day = dayLabel(date);
    // La serata: quante partite, chi ha vinto di più, chi ha segnato di più.
    const wins = new Map<string, number>();
    const pts = new Map<string, number>();
    for (const m of games) {
      const w = winnerOf(m);
      for (const l of m.players) {
        if (l.team === w) wins.set(l.playerId, (wins.get(l.playerId) ?? 0) + 1);
        if (l.hasStats)
          pts.set(
            l.playerId,
            (pts.get(l.playerId) ?? 0) + normalizeBox(l.box).pts,
          );
      }
    }
    const topWins = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
    const topPts = [...pts.entries()].sort((a, b) => b[1] - a[1])[0];
    const mvps = new Map<string, number>();
    for (const m of games) {
      const id = matchMvp(m)?.playerId;
      if (id) mvps.set(id, (mvps.get(id) ?? 0) + 1);
    }
    const topMvp = [...mvps.entries()].sort((a, b) => b[1] - a[1])[0];
    // Le cose da dire, raggruppate per persona: "Springs: 4 vinte su 4, 58 punti e sempre MVP".
    const facts = new Map<string, string[]>();
    const add = (id: string, f: string) =>
      facts.set(id, [...(facts.get(id) ?? []), f]);
    if (topWins)
      add(
        topWins[0],
        `${topWins[1]} vinte su ${games.filter((m) => m.players.some((p) => p.playerId === topWins[0])).length}`,
      );
    if (topPts) add(topPts[0], `più punti di tutti (${topPts[1]})`);
    if (topMvp && topMvp[1] > 1)
      add(
        topMvp[0],
        topMvp[1] === games.length
          ? "sempre MVP della partita"
          : `${topMvp[1]} volte MVP della partita`,
      );
    const list = (xs: string[]) =>
      xs.length > 1
        ? `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`
        : xs[0];
    const parts = [...facts.entries()].map(
      ([id, fs]) => `${name(id)}: ${list(fs)}`,
    );
    out.push({
      id: `night-${date.slice(0, 10)}`,
      date,
      icon: "calendar",
      title: `${pick(date, ["La serata di", "Com'è andata", "Il racconto di"])} ${day}`,
      body: `${games.length === 1 ? "Una partita" : `${games.length} partite`}. ${parts.join(". ")}`,
      href: "/partite",
    });

    // Doppie e triple doppie.
    for (const m of games)
      for (const l of m.players) {
        if (!l.hasStats) continue;
        const tens = doubleDigits(l.box);
        if (tens.length < 2) continue;
        const v = lineValues(m, l.playerId)!;
        const what = tens
          .map((k) => `${v[k]} ${STAT_WORDS.find((s) => s.key === k)!.many}`)
          .join(" e ");
        const td = tens.length >= 3;
        out.push({
          id: `dd-${m.id}-${l.playerId}`,
          date: m.playedAt,
          icon: "double",
          title: `${td ? "Tripla doppia" : "Doppia doppia"} per ${name(l.playerId)}`,
          body: pick(m.id + l.playerId, [
            `${what}: ${td ? "una partita da incorniciare" : "doppia cifra in due voci, roba da grandi"}`,
            `${what} nella stessa partita. ${td ? "Rarissima" : "Chi lo ferma?"}`,
            `${what}. ${td ? "Tre voci in doppia cifra: succede quasi mai" : "Quando c'è, si vede"}`,
            `${what}: ${td ? "serata storica" : "presente ovunque, sotto i due canestri"}`,
            `${what}. ${td ? "Da raccontare per un pezzo" : "Doppia cifra due volte, in una sola partita"}`,
          ]),
          href: `/partite?m=${m.id}`,
        });
      }
  }

  // Massimi personali: nell'ultima serata, chi ha fatto meglio che mai (con almeno una partita prima).
  const lastNight = [...nights.values()].at(-1) ?? [];
  const lastIds = new Set(lastNight.map((m) => m.id));
  const before = chrono.filter((m) => !lastIds.has(m.id));
  const ids = new Set(
    lastNight.flatMap((m) => m.players.map((p) => p.playerId)),
  );
  for (const id of ids) {
    const prevGames = before
      .map((m) => lineValues(m, id))
      .filter(Boolean) as NonNullable<ReturnType<typeof lineValues>>[];
    if (!prevGames.length) continue;
    let bestStory: NewsStory | null = null;
    let bestGain = 0;
    for (const m of lastNight) {
      const v = lineValues(m, id);
      if (!v) continue;
      for (const s of STAT_WORDS) {
        const prev = Math.max(...prevGames.map((g) => g[s.key]));
        const gain = v[s.key] - prev;
        if (v[s.key] >= 3 && gain > 0 && gain / Math.max(1, prev) > bestGain) {
          bestGain = gain / Math.max(1, prev);
          bestStory = {
            id: `pb-${m.id}-${id}-${s.key}`,
            date: m.playedAt,
            icon: "fire",
            title: `${name(id)}: ${v[s.key]} ${v[s.key] === 1 ? s.one : s.many}, mai così tanti`,
            body: pick(m.id + s.key, [
              `È il suo massimo da quando c'è il Campetto: prima non era mai andato oltre ${prev}`,
              `Nuovo record personale: il precedente era ${prev}`,
            ]),
            href: `/partite?m=${m.id}`,
          };
        }
      }
    }
    if (bestStory) out.push(bestStory);
  }

  // Serie di vittorie in corso (da 3 in su).
  for (const p of players) {
    let streak = 0;
    let lastAt = "";
    for (const m of chrono) {
      const l = m.players.find((x) => x.playerId === p.id);
      if (!l) continue;
      if (winnerOf(m) === l.team) {
        streak++;
        lastAt = m.playedAt;
      } else streak = 0;
    }
    if (streak >= 3 && new Date(lastAt).getTime() >= since)
      out.push({
        id: `streak-${p.id}-${streak}`,
        date: lastAt,
        icon: "streak",
        title: `${name(p.id)} non perde da ${streak} partite`,
        body: pick(p.id + streak, [
          `${streak} vittorie di fila: chi gli toglie l'imbattibilità?`,
          `Serie aperta: ${streak} vinte una dopo l'altra. La prossima è la più difficile`,
        ]),
        href: `/giocatore?id=${p.id}`,
      });
  }

  // Il mese in corso: corsa all'MVP e i migliori per statistica.
  const lastDate = new Date(chrono[chrono.length - 1].playedAt);
  const period = {
    kind: "month" as const,
    year: lastDate.getFullYear(),
    month: lastDate.getMonth(),
  };
  const month = MONTHS_IT[period.month].toLowerCase();
  const allIds = players.map((p) => p.id);
  const ranking = mvpRanking(allIds, matches, period, "all", { elo });
  if (ranking.length >= 2) {
    const [a, b] = ranking;
    out.push({
      id: `mvp-race-${period.year}-${period.month}-${a.playerId}-${b.playerId}`,
      date: chrono[chrono.length - 1].playedAt,
      icon: "crown",
      title: `Corsa all'MVP di ${month}: ${name(a.playerId)} davanti`,
      body: `${name(a.playerId)} guida con ${Math.round(a.score * 100)} punti, ${name(b.playerId)} insegue a ${Math.round(b.score * 100)}. Conta come giochi e conta vincere`,
      href: "/classifiche",
    });
  }
  const scoped = filterMatches(matches, { period, format: "all" });
  const stats = allIds.map((id) => computePlayerStats(id, scoped));
  for (const l of LEADERS) {
    const def = STAT_BY_KEY.get(l.stat)!;
    const lb = leaderboard(def, stats, { elo, allTime: false });
    const [first, second] = lb.rows;
    if (!first || first.value <= 0 || (second && second.value === first.value))
      continue;
    out.push({
      id: `leader-${period.year}-${period.month}-${l.stat}-${first.playerId}`,
      date: chrono[chrono.length - 1].playedAt,
      icon: "leader",
      title: `${name(first.playerId)} è ${l.who} di ${month}`,
      body: `${num(first.value)} ${first.value === 1 ? l.one : l.unit}${second ? `, davanti a ${name(second.playerId)} (${num(second.value)})` : ""}`,
      href: "/classifiche",
    });
  }

  // Prima gli annunci, poi dal più recente; nello stesso giorno: la serata, le imprese, la classifica.
  const ORDER: NewsIcon[] = [
    "megaphone",
    "season",
    "calendar",
    "double",
    "fire",
    "record",
    "streak",
    "crown",
    "leader",
  ];
  return out.sort(
    (x, y) =>
      Number(!!y.pinned) - Number(!!x.pinned) ||
      y.date.slice(0, 10).localeCompare(x.date.slice(0, 10)) ||
      ORDER.indexOf(x.icon) - ORDER.indexOf(y.icon) ||
      y.date.localeCompare(x.date),
  );
}
