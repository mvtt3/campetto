import type { GameState, Level, Offer } from "./types";
import { LEGA_TEAMS, LEVELS, LEVEL_ORDER, TEAMS, clamp, hash, makeOffers, overall, seasonSummary, seeded, teamStrength, week, type Rng } from "./economy";
import { coachRel, isCaptain } from "./match";
import { teamNames } from "./live";

/**
 * La carriera vista da dentro: la tua squadra (compagni, coach, società), la classifica
 * del campionato, chi ti cerca dagli altri campionati. Tutto si muove con quello che fai
 * in campo e fuori.
 */

// ———————————— La squadra ————————————

const ROLES = ["Playmaker", "Guardia", "Ala", "Ala grande", "Centro"];

export interface Mate {
  name: string;
  role: string;
  number: number;
  /** Morale con te, 0–100. */
  mood: number;
  /** Titolare (gioca con te) o in panchina. */
  starter: boolean;
}

const NUMBERS = [0, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 21, 22, 24, 30, 31, 33, 44, 55];

/** Il morale di partenza di un compagno: c'è chi ti accoglie bene e chi no. */
export const baseMood = (team: string, name: string) => 40 + (hash(`${team}:${name}`) % 26);

export function mateMood(s: Pick<GameState, "mates" | "contract">, name: string): number {
  return s.mates[name] ?? baseMood(s.contract.team, name);
}

/** La rosa: i primi giocano con te in campo, gli altri in panchina. */
export function teamRoster(s: Pick<GameState, "mates" | "contract">): Mate[] {
  const size = LEVELS[s.contract.level].size;
  const n = size === 3 ? 4 : 9;
  return teamNames(s.contract.team, n).map((name, i) => ({
    name,
    role: size === 3 ? (i < size - 1 ? "In campo con te" : "Cambio") : ROLES[(i + 1) % ROLES.length],
    number: NUMBERS[hash(`${s.contract.team}${name}`) % NUMBERS.length],
    mood: mateMood(s, name),
    starter: i < size - 1,
  }));
}

export function moodWord(m: number): { emoji: string; line: string } {
  if (m >= 80) return { emoji: "🤩", line: "Ti passa sempre la palla" };
  if (m >= 62) return { emoji: "😄", line: "Ti stima e lo dice" };
  if (m >= 45) return { emoji: "🙂", line: "Tutto a posto" };
  if (m >= 30) return { emoji: "😐", line: "Ti studia: fagli vedere chi sei" };
  if (m >= 15) return { emoji: "😒", line: "Non gli piaci molto" };
  return { emoji: "😠", line: "Ce l'ha con te" };
}

/** Il morale medio della squadra con te. */
export function teamMood(s: Pick<GameState, "mates" | "contract">): number {
  const r = teamRoster(s);
  return Math.round(r.reduce((a, m) => a + m.mood, 0) / r.length);
}

/** Cambia il morale dei compagni: tutti, o solo alcuni per nome. */
export function moveMates(s: GameState, delta: number, only?: string[]): GameState {
  const mates = { ...s.mates };
  for (const m of teamRoster(s)) if (!only || only.includes(m.name)) mates[m.name] = clamp(m.mood + delta, 0, 100);
  return { ...s, mates };
}

export const moveClub = (s: GameState, delta: number): GameState => ({ ...s, club: clamp(s.club + delta, 0, 100) });

/** Coach e società su una scala 0–100 (il coach nei messaggi va da −100 a 100). */
export const coachScore = (s: GameState) => Math.round((coachRel(s) + 100) / 2);

// ———————————— Il tuo ruolo in squadra ————————————

export const LADDER = ["Panchinaro", "Riserva", "Titolare", "Capitano", "Stella"] as const;
export type Rank = (typeof LADDER)[number];

export function rank(s: GameState): { rank: Rank; i: number; next: string | null } {
  const avg = seasonSummary(s).avg;
  const coach = coachRel(s);
  let i = coach <= -30 ? 0 : 1;
  if (coach >= 10 && (avg >= 6 || s.career.games === 0)) i = 2;
  if (isCaptain(s)) i = 3;
  if (i === 3 && s.fame >= 70 && avg >= 8) i = 4;
  const next = [
    "Fai pace col coach: allenati e gioca bene",
    "Coach almeno amico e voto medio 6 per partire titolare",
    "Coach che si fida ciecamente (70) e fama 30 per la fascia",
    "Fama 70 e voto medio 8 per diventare la stella",
    null,
  ][i];
  return { rank: LADDER[i], i, next };
}

// ———————————— La classifica ————————————

export interface TableRow {
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  diff: number;
  me: boolean;
}

/**
 * La classifica del campionato: le tue partite sono quelle vere, le altre si giocano
 * da sole (sempre uguali per la stessa stagione) negli stessi giorni.
 */
export function standings(s: GameState): TableRow[] {
  const lv = s.contract.level;
  const own = s.contract.team;
  const rows = new Map<string, TableRow>();
  for (const t of [own, ...TEAMS[lv].filter((x) => x !== own)])
    rows.set(t, { team: t, played: 0, won: 0, lost: 0, points: 0, diff: 0, me: t === own });
  const add = (a: string, pa: number, b: string, pb: number) => {
    const ra = rows.get(a);
    const rb = rows.get(b);
    if (!ra || !rb) return;
    for (const [r, p, q] of [
      [ra, pa, pb],
      [rb, pb, pa],
    ] as const) {
      r.played += 1;
      r.diff += p - q;
      if (p > q) {
        r.won += 1;
        r.points += 2;
      } else r.lost += 1;
    }
  };
  const size = LEVELS[lv].size;
  s.season.matches.forEach((m, k) => {
    if (!m.result) return;
    add(own, m.result.us, m.opponent, m.result.them);
    // Le altre partite della giornata.
    const rng = seeded(`${s.createdAt}:${s.season.n}:${k}`);
    const rest = TEAMS[lv].filter((t) => t !== own && t !== m.opponent).sort(() => rng() - 0.5);
    for (let i = 0; i + 1 < rest.length; i += 2) {
      const [a, b] = [rest[i], rest[i + 1]];
      const pA = clamp(0.5 + (teamStrength(a) - teamStrength(b)) * 1.6 + 0.04, 0.12, 0.88);
      const base = size === 3 ? 21 : 72 + Math.floor(rng() * 14);
      const gap = 1 + Math.floor(rng() * (size === 3 ? 7 : 16));
      if (rng() < pA) add(a, base, b, Math.max(0, base - gap));
      else add(a, Math.max(0, base - gap), b, base);
    }
  });
  return [...rows.values()].sort((x, y) => y.points - x.points || y.diff - x.diff || x.team.localeCompare(y.team));
}

/** I posti che contano: i primi vanno ai playoff, gli ultimi rischiano. */
export const PLAYOFF = 4;

/** La riga sotto la tua posizione: quanto manca ai playoff (o quanto margine hai). */
export function gapNote(table: TableRow[]): string {
  const i = table.findIndex((r) => r.me);
  if (i < 0) return "";
  const me = table[i];
  if (!me.played) return "Il campionato deve ancora cominciare";
  if (i === 0) {
    const second = table[1];
    const lead = (me.points - (second?.points ?? 0)) / 2;
    return lead > 0 ? `Primi con ${lead} ${lead === 1 ? "vittoria" : "vittorie"} di vantaggio` : "Primi a pari punti: non mollare";
  }
  if (i < PLAYOFF) return `In zona playoff · ${i + 1}° posto`;
  const need = Math.ceil((table[PLAYOFF - 1].points - me.points) / 2) || 1;
  return `${need} ${need === 1 ? "vittoria" : "vittorie"} dalla zona playoff`;
}

// ———————————— Chi ti cerca ————————————

const EUROPA = ["Madrid Churros", "Atene Souvlaki", "Belgrado Ćevapi", "Kaunas Cepelinai", "Istanbul Baklava", "Parigi Croissant", "Monaco Brezel", "Barcellona Tapas"];

export type League = Level | "europa" | "lega";
export const LEAGUE: Record<League, { name: string; flag: string; tier: number }> = {
  campetto: { name: "Campetto", flag: "🏀", tier: 0 },
  b: { name: "Serie B", flag: "🇮🇹", tier: 1 },
  a: { name: "Serie A", flag: "🇮🇹", tier: 2 },
  europa: { name: "Eurolega", flag: "🇪🇺", tier: 3 },
  lega: { name: "Lega americana", flag: "🇺🇸", tier: 4 },
};
/** Il valore che una squadra di quel campionato cerca (0–100). */
const NEED = [30, 48, 64, 78, 90];

/** Quanto vali oggi, da 0 a 100: abilità, voti, fama e seguito. */
export function playerValue(s: GameState): number {
  const sum = seasonSummary(s);
  const rating = sum.played ? clamp((sum.avg - 4) * 16, 0, 100) : 40;
  const social = clamp(Math.log10(Math.max(10, s.social.followers)) * 18 - 18, 0, 100);
  return Math.round(overall(s) * 0.45 + rating * 0.25 + s.fame * 0.2 + social * 0.1);
}

/** Il valore di mercato in euro, per dare un numero da guardare crescere. */
export function marketValue(s: GameState): number {
  const v = playerValue(s) / 100;
  const raw = 2000 * Math.pow(v, 2) * Math.pow(10, v * 3.2);
  const step = raw > 100_000 ? 10_000 : raw > 10_000 ? 1000 : 100;
  return Math.round(raw / step) * step;
}

export interface Interest {
  team: string;
  league: League;
  pct: number;
  stage: "Osserva" | "Interessato" | "Pronto a offrire";
  /** Cosa manca perché arrivi un'offerta. */
  wants: string | null;
}

/** Le squadre che ti seguono, con quanto sono interessate (cambia ogni settimana e con le partite). */
export function interest(s: GameState): Interest[] {
  const cur = LEVEL_ORDER.indexOf(s.contract.level);
  const v = playerValue(s);
  const sum = seasonSummary(s);
  const wk = week(s.day);
  const pool: { team: string; league: League }[] = [];
  const take = (league: League, teams: string[], n: number) => {
    const r = seeded(`${s.createdAt}:${league}:${s.season.n}`);
    [...teams]
      .filter((t) => t !== s.contract.team)
      .sort(() => r() - 0.5)
      .slice(0, n)
      .forEach((team) => pool.push({ team, league }));
  };
  if (cur <= 0) take("campetto", TEAMS.campetto, 2);
  if (cur <= 1) take("b", TEAMS.b, cur === 1 ? 2 : 3);
  take("a", TEAMS.a, cur === 2 ? 2 : 2);
  take("europa", EUROPA, 2);
  take("lega", LEGA_TEAMS, 2);
  return pool
    .map(({ team, league }) => {
      const t = LEAGUE[league].tier;
      const noise = (seeded(`${team}:${wk}`)() - 0.5) * 12;
      const pct = Math.round(clamp(50 + (v - NEED[t]) * 3.2 + noise, 1, 99));
      const stage: Interest["stage"] = pct >= 70 ? "Pronto a offrire" : pct >= 35 ? "Interessato" : "Osserva";
      const needRating = [6, 6.5, 7, 7.5, 8][t];
      const needFame = [10, 30, 50, 70, 85][t];
      const wants =
        pct >= 70
          ? null
          : sum.avg < needRating
            ? `Vuole voto medio ${String(needRating).replace(".", ",")}`
            : s.fame < needFame
              ? `Vuole fama ${needFame}`
              : `Vuole abilità più alte (${overall(s)} → ${NEED[t]})`;
      return { team, league, pct, stage, wants };
    })
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Le offerte di fine stagione, prese tra le squadre che ti cercano di più: chi ti segue
 * davvero è chi ti fa l'offerta.
 */
export function careerOffers(s: GameState, rng: Rng): Offer[] {
  const base = makeOffers(s, rng);
  const list = interest(s);
  const best = (level: Level, not: string[]) =>
    list.find((x) => x.league === level && !not.includes(x.team) && x.pct >= 35)?.team ??
    list.find((x) => x.league === level && !not.includes(x.team))?.team;
  const used: string[] = [s.contract.team];
  return base.map((o) => {
    if (o.id.startsWith("r")) return o;
    const t = best(o.level, used);
    if (!t) return o;
    used.push(t);
    return { ...o, team: t };
  });
}

/** Il prossimo impegno, per la scheda in alto. */
export function nextFixture(s: GameState) {
  const i = s.season.matches.findIndex((m) => !m.result);
  if (i < 0) return null;
  const m = s.season.matches[i];
  return { index: i, ...m, inDays: m.day - s.day, strength: teamStrength(m.opponent) };
}

/** Per i test e per l'hub: club e coach in parole. */
export const clubWord = (v: number) =>
  v >= 75 ? "La società ti adora" : v >= 55 ? "La società è contenta" : v >= 35 ? "La società aspetta" : "La società è scontenta";

export { coachRel };
