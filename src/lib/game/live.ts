import type { Difficulty, GameState, Moment } from "./types";
import { LEVELS, clamp, hash, pick, seeded, type Rng } from "./economy";
import { SHOTS, finishMatch, pickDefense, planMatch, simMoment, type MatchPlan, type MomentResult } from "./match";

/**
 * La partita dal vivo, come nei manageriali di calcio: la telecronaca racconta le
 * azioni degli altri (canestri, palle perse, parziali, liberi) e il punteggio sale;
 * ogni tanto tocca a te e torni in campo. Le tue giocate cambiano il risultato e
 * l'inerzia della partita: più giochi bene, più palloni ti passano.
 *
 * 3 contro 3: si gioca ai 21. 5 contro 5: quattro quarti da 10 minuti.
 */

export type Side = "us" | "them";

export interface FeedLine {
  /** "1° Q 7:40" oppure il punteggio per il 3 contro 3. */
  clock: string;
  text: string;
  side: Side | null;
  pts: number;
  us: number;
  them: number;
  /** Il canestro o la giocata è tua. */
  mine?: boolean;
  big?: boolean;
  /** Chi ha fatto l'azione (per l'etichetta in campo). */
  who?: string;
  kind: "score" | "miss" | "turnover" | "info" | "period" | "end" | "you";
}

export interface LiveState {
  size: 3 | 5;
  us: number;
  them: number;
  poss: Side;
  period: number;
  /** Secondi rimasti nel periodo (5 contro 5). */
  clock: number;
  /** Quando arrivano i tuoi momenti (avanzamento della partita da 0 a 1). */
  triggers: number[];
  /** Quanti momenti tuoi sono previsti (cambia con come giochi). */
  planned: number;
  done: number;
  momentum: number;
  streak: number;
  onFire: boolean;
  failRun: number;
  benched: boolean;
  /** I tuoi falli: nel 5 contro 5 al quinto sei fuori. */
  fouls: number;
  over: boolean;
  feed: FeedLine[];
  extra: { ast: number; reb: number; pts: number };
  /** Le statistiche delle tue giocate: per la cronaca e il resoconto. */
  seed: number;
}

export interface Rosters {
  us: string[];
  them: string[];
  me: string;
  usTeam: string;
  themTeam: string;
}

const SURNAMES = [
  "Rossi", "Esposito", "Bianchi", "Ferrari", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno",
  "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri",
  "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferri", "Galli", "Martini", "Leone", "Longo",
  "Gentile", "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti", "Parisi",
];

/** I cognomi della rosa di una squadra (inventati, sempre gli stessi per ogni squadra). */
export function teamNames(team: string, n: number): string[] {
  const r = seeded(team);
  const pool = [...SURNAMES].sort(() => r() - 0.5);
  return pool.slice(0, n);
}

/** I nomi dei giocatori in campo (inventati, sempre gli stessi per ogni squadra). */
export function rosters(s: GameState, me: string, opponent: string, size: 3 | 5): Rosters {
  const take = teamNames;
  const us = take(s.contract.team, size - 1).filter((n) => n !== me);
  const them = take(opponent, size + 1).filter((n) => !us.includes(n)).slice(0, size);
  return { us, them, me, usTeam: s.contract.team, themTeam: opponent };
}

const TOTAL_5V5 = 4 * 600;

export function progress(st: LiveState): number {
  if (st.size === 3) return Math.max(st.us, st.them) / 21;
  const elapsed = Math.min(4, st.period - 1) * 600 + (600 - st.clock);
  return clamp(elapsed / TOTAL_5V5, 0, 1);
}

export function clockLabel(st: LiveState): string {
  if (st.size === 3) return `ai 21`;
  const m = Math.floor(Math.max(0, st.clock) / 60);
  const sec = Math.floor(Math.max(0, st.clock) % 60);
  return `${st.period > 4 ? "Suppl." : `${st.period}° Q`} ${m}:${String(sec).padStart(2, "0")}`;
}

function spreadTriggers(n: number, rng: Rng): number[] {
  return Array.from({ length: n }, (_, i) => clamp(0.04 + ((i + 0.35 + rng() * 0.3) / n) * 0.9, 0.03, 0.95));
}

export function startLive(plan: MatchPlan, rng: Rng): LiveState {
  return {
    size: plan.size,
    us: 0,
    them: 0,
    poss: rng() < 0.5 ? "us" : "them",
    period: 1,
    clock: 600,
    triggers: spreadTriggers(plan.moments.length, rng),
    planned: plan.moments.length,
    done: 0,
    momentum: 0,
    streak: 0,
    onFire: false,
    failRun: 0,
    benched: false,
    fouls: 0,
    over: false,
    feed: [],
    extra: { ast: 0, reb: 0, pts: 0 },
    seed: Math.floor(rng() * 1e9),
  };
}

export type Step =
  | { kind: "line"; line: FeedLine }
  | { kind: "moment"; index: number; moment: Moment; clutch: boolean }
  | { kind: "end" };

/** Il prossimo pezzo di partita: una riga di cronaca o il tuo momento. */
export function nextStep(st: LiveState, plan: MatchPlan, names: Rosters, rng: Rng): { st: LiveState; step: Step } {
  if (st.over) return { st, step: { kind: "end" } };
  const p = progress(st);
  if (!st.benched && st.done < st.planned && st.done < plan.moments.length + 3 && p >= st.triggers[st.done]) {
    const base = plan.moments[st.done % plan.moments.length];
    const moment = withPossession(base, st, rng);
    const clutch =
      st.size === 3 ? Math.max(st.us, st.them) >= 16 && Math.abs(st.us - st.them) <= 4 : p > 0.88 && Math.abs(st.us - st.them) <= 6;
    const m = clutch && moment.clock !== "Palla decisiva" ? { ...moment, clock: "Palla decisiva" } : moment;
    return { st: { ...st, poss: m.kind === "attacco" ? "us" : "them" }, step: { kind: "moment", index: st.done, moment: m, clutch } };
  }
  return playPossession(st, plan, names, rng);
}

/** I momenti in più (quando giochi bene) si alternano tra attacco e difesa. */
function withPossession(m: Moment, st: LiveState, rng: Rng): Moment {
  const r = rng();
  const clock = st.size === 3 ? `${st.us}–${st.them}` : clockLabel(st);
  if (m.kind === "attacco") return { ...m, clock };
  return { ...m, clock, action: m.action ?? pickDefense(r) };
}

/** La probabilità che la squadra in attacco segni, con forza delle squadre e inerzia. */
function scoreChance(st: LiveState, plan: MatchPlan, side: Side): number {
  const diff = side === "us" ? plan.usStr - plan.oppStr : plan.oppStr - plan.usStr;
  const mom = side === "us" ? st.momentum : -st.momentum;
  // Un filo di vantaggio alla tua squadra: con una prestazione nella media si vince metà delle volte.
  return clamp((side === "us" ? 0.49 : 0.46) + diff * 0.55 + mom * 0.04, 0.28, 0.7);
}

const T = {
  two: [
    "{n} appoggia al vetro: due punti",
    "Arresto e tiro di {n}: dentro",
    "{n} entra in area e segna",
    "Gancio di {n}, buono",
    "{a} serve {n} sotto canestro: due punti",
    "{n} in contropiede, appoggio facile",
  ],
  three: ["Tripla di {n}!", "{n} dall'angolo: tre punti", "Bomba di {n} dal palleggio!", "{n} spara da lontano… dentro!"],
  miss: ["{n} sbaglia dalla media", "Ferro per {n}", "{n} forza il tiro: fuori", "Il tiro di {n} non entra", "Air ball di {n}!"],
  turnover: ["Palla persa di {n}", "Passi di {n}: palla agli avversari", "{n} si fa rubare il pallone", "Passaggio sbagliato di {n}"],
  ft: ["Fallo su {n}: {k} liberi su 2", "{n} in lunetta: {k} su 2"],
  run: ["Parziale di {p}-0: {n} e {m} a segno", "{n} e {m} firmano un mini-break di {p} punti", "Botta doppia: {n}, poi {m}. {p} punti di fila"],
  meReb: ["Rimbalzo di {me}, che riparte", "{me} cattura il rimbalzo"],
  meAst: ["Gran passaggio di {me} per {n}: due punti", "Assist di {me}, {n} segna"],
  crowd: ["Il pubblico si alza in piedi", "Il palazzetto si scalda", "Coro per la squadra di casa"],
};

function fill(t: string, v: Record<string, string | number>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}

function addTime(st: LiveState, sec: number): LiveState {
  if (st.size === 3) return st;
  return { ...st, clock: st.clock - sec };
}

/** Un'azione degli altri, raccontata. */
function playPossession(st0: LiveState, plan: MatchPlan, names: Rosters, rng: Rng): { st: LiveState; step: Step } {
  let st = { ...st0 };
  const side = st.poss;
  const team = side === "us" ? names.us : names.them;
  const tName = side === "us" ? "" : `${names.themTeam}: `;
  const n = pick(rng, team.length ? team : ["Rossi"]);
  const m = pick(rng, team.filter((x) => x !== n).length ? team.filter((x) => x !== n) : [n]);
  const a = pick(rng, team.length ? team : [n]);
  const p = scoreChance(st, plan, side);
  const r = rng();
  let pts = 0;
  let text = "";
  let kind: FeedLine["kind"] = "miss";
  let mine = false;
  // Nel 5 contro 5 ogni riga racconta una fase di gioco (due azioni della stessa squadra).
  const second = st.size === 5 && rng() < p ? (rng() < 0.3 ? 3 : 2) : 0;
  if (r < p) {
    const three = rng() < (st.size === 3 ? 0.28 : 0.33);
    pts = three ? 3 : 2;
    if (second) {
      pts += second;
      text = tName + fill(pick(rng, T.run), { n, m, p: pts });
    } else if (side === "us" && !three && rng() < 0.1 + plan.passaggio / 600) {
      // Ogni tanto l'assist è tuo (più spesso se passi bene).
      text = fill(pick(rng, T.meAst), { me: names.me, n });
      st.extra = { ...st.extra, ast: st.extra.ast + 1 };
      mine = true;
    } else text = tName + fill(pick(rng, three ? T.three : T.two), { n, a: a === n ? m : a });
    kind = "score";
  } else if (r < p + 0.12) {
    // Tiri liberi.
    const k = rng() < 0.7 ? 2 : 1;
    pts = (st.size === 3 ? Math.min(k, 1) : k) + second;
    text = tName + fill(pick(rng, T.ft), { n, k }) + (second ? `, poi canestro di ${m}` : "");
    kind = "score";
  } else if (r < p + 0.22) {
    text = tName + fill(pick(rng, T.turnover), { n });
    kind = "turnover";
  } else {
    text = tName + fill(pick(rng, T.miss), { n });
    // Il rimbalzo, a volte, è tuo.
    if (rng() < 0.12 + plan.fisico / 700) {
      text += `. ${fill(pick(rng, T.meReb), { me: names.me })}`;
      st.extra = { ...st.extra, reb: st.extra.reb + 1 };
      mine = true;
    }
  }
  if (side === "us") st.us += pts;
  else st.them += pts;
  st.momentum = clamp(st.momentum * 0.85 + (pts ? (side === "us" ? 0.25 : -0.25) : 0), -2, 2);
  st = addTime(st, st.size === 5 ? 30 + Math.floor(rng() * 21) : 0);
  st.poss = side === "us" ? "them" : "us";
  const line: FeedLine = {
    clock: st.size === 3 ? `${st.us}–${st.them}` : clockLabel(st),
    text,
    side,
    pts,
    us: st.us,
    them: st.them,
    kind,
    mine,
    who: mine ? names.me : n,
  };
  st.feed = [...st.feed, line];
  st = checkEnd(st, names, rng);
  return { st, step: { kind: "line", line } };
}

function checkEnd(st0: LiveState, names: Rosters, rng: Rng): LiveState {
  let st = st0;
  if (st.size === 3) {
    if (st.us >= 21 || st.them >= 21) {
      st = { ...st, over: true };
      st.feed = [...st.feed, endLine(st, names)];
    }
    return st;
  }
  if (st.clock <= 0) {
    if (st.period >= 4 && st.us !== st.them) {
      st = { ...st, clock: 0, over: true };
      st.feed = [...st.feed, endLine(st, names)];
      return st;
    }
    const next = st.period + 1;
    const line: FeedLine = {
      clock: clockLabel({ ...st, clock: 0 }),
      text:
        st.period === 2
          ? `Fine primo tempo: ${st.us}–${st.them}`
          : st.period >= 4
            ? `Parità! Si va ai supplementari`
            : `Fine del ${st.period}° quarto: ${st.us}–${st.them}`,
      side: null,
      pts: 0,
      us: st.us,
      them: st.them,
      kind: "period",
    };
    st = { ...st, period: next, clock: next > 4 ? 300 : 600, poss: rng() < 0.5 ? "us" : "them", feed: [...st.feed, line] };
  }
  return st;
}

function endLine(st: LiveState, names: Rosters): FeedLine {
  const won = st.us > st.them;
  return {
    clock: st.size === 3 ? `${st.us}–${st.them}` : "Finale",
    text: won ? `Finita! Vince ${names.usTeam} ${st.us}–${st.them}` : `Finita: vince ${names.themTeam} ${st.them}–${st.us}`,
    side: null,
    pts: 0,
    us: st.us,
    them: st.them,
    kind: "end",
  };
}

const isFail = (r: MomentResult) => (r.kind === "tiro" && !r.made) || (r.kind === "passaggio" && !r.ok);
const isGood = (r: MomentResult) =>
  (r.kind === "tiro" && r.made) || (r.kind === "passaggio" && r.ok && r.made) || (r.kind === "difesa" && r.ok);

/** La tua giocata entra nella partita: punteggio, inerzia, e quanti palloni ti daranno. */
export function applyMoment(
  st0: LiveState,
  plan: MatchPlan,
  names: Rosters,
  r: MomentResult,
  rng: Rng,
): LiveState {
  let st = { ...st0, done: st0.done + 1 };
  let text = "";
  let pts = 0;
  let side: Side = "us";
  let fouledOut = false;
  const kind: FeedLine["kind"] = "you";
  if (r.kind === "tiro") {
    pts = r.pts;
    text =
      r.shot === "terzo" && r.outcome === "fuori"
        ? `Passi di ${names.me}: palla agli avversari`
        : r.made
          ? r.shot === "tripla"
            ? `TRIPLA di ${names.me}!`
            : r.shot === "terzo"
              ? `Terzo tempo di ${names.me}: dentro!`
              : `Canestro di ${names.me}!`
          : `${names.me} sbaglia ${r.shot === "tripla" ? "da tre" : r.shot === "terzo" ? "l'appoggio" : "il tiro"}`;
  } else if (r.kind === "fallo") {
    side = "them";
    pts = r.ftMade;
    st.fouls += 1;
    text = `Fallo di ${names.me} (${st.fouls}°): ${names.themTeam} in lunetta, ${r.ftMade} su ${r.ftTaken}`;
  } else if (r.kind === "passaggio") {
    pts = r.pts;
    const mate = pick(rng, names.us.length ? names.us : ["un compagno"]);
    text = !r.ok ? `Palla persa di ${names.me}` : r.made ? `Assist di ${names.me} per ${mate}!` : `Bel passaggio di ${names.me}, ma ${mate} sbaglia`;
  } else if (r.kind === "difesa" && r.action === "salvataggio") {
    if (r.ok) {
      text = `Salvataggio sulla linea di ${names.me}!`;
      if (r.fastBreak) {
        pts = 2;
        text += " E contropiede: canestro";
      }
    } else text = `${names.me} si tuffa ma non ci arriva: rimessa per ${names.themTeam}`;
  } else if (r.kind === "difesa") {
    if (r.ok) {
      text = r.action === "rubata" ? `Palla rubata da ${names.me}!` : `STOPPATA di ${names.me}!`;
      if (r.fastBreak) {
        pts = 2;
        text += " Contropiede e canestro";
      }
    } else {
      side = "them";
      // Sulla penetrazione, se arrivi tardi, a volte è anche fallo: canestro e libero.
      const andOne = r.action === "penetrazione" && rng() < 0.3;
      pts = r.action === "penetrazione" ? 2 + (andOne ? 1 : 0) : rng() < 0.25 ? 3 : 2;
      if (andOne) st.fouls += 1;
      text = andOne ? `${names.themTeam} segna col fallo di ${names.me}: canestro e libero` : `${names.themTeam} segna: ${names.me} battuto`;
    }
  }
  if (side === "us") st.us += pts;
  else st.them += pts;
  if (r.kind !== "panchina") {
    const good = isGood(r);
    st.streak = r.kind === "tiro" ? (r.made ? st.streak + 1 : 0) : st.streak;
    st.onFire = st.streak >= 3;
    st.momentum = clamp(st.momentum + (good ? 0.7 : -0.5), -2, 2);
    st.failRun = isFail(r) ? st.failRun + 1 : 0;
    // Meritocrazia: chi gioca bene riceve più palloni, chi sbaglia meno.
    if (good && rng() < 0.45 && st.planned < plan.moments.length + 3) {
      st.planned += 1;
      st.triggers = [...st.triggers.slice(0, st.done), ...respread(st, st.planned - st.done, rng)];
    }
    if (st.failRun >= 2 && st.planned > st.done + 1 && rng() < 0.5) st.planned -= 1;
    if (st.failRun >= plan.benchAfter && st.planned > st.done) {
      st.benched = true;
      st.planned = st.done;
    }
    // Nel 5 contro 5 al quinto fallo si esce.
    if (st.size === 5 && st.fouls >= 5 && !st.benched) {
      st.benched = true;
      st.planned = st.done;
      fouledOut = true;
    }
  }
  st = addTime(st, st.size === 5 ? 24 : 0);
  st.poss = side === "us" ? "them" : "us";
  if (r.kind === "difesa" && r.ok && !r.fastBreak) st.poss = "us";
  const line: FeedLine = {
    clock: st.size === 3 ? `${st.us}–${st.them}` : clockLabel(st),
    text: fouledOut ? `${text}. Quinto fallo: sei fuori!` : st.benched ? `${text}. Il coach ti richiama in panchina` : text,
    side: pts ? side : null,
    pts,
    us: st.us,
    them: st.them,
    mine: side === "us",
    big: true,
    who: names.me,
    kind,
  };
  st.feed = [...st.feed, line];
  return checkEnd(st, names, rng);
}

function respread(st: LiveState, left: number, rng: Rng): number[] {
  const p = progress(st);
  return Array.from({ length: left }, (_, i) => clamp(p + 0.03 + ((i + 0.3 + rng() * 0.4) / left) * (0.95 - p), p + 0.02, 0.96));
}

/** Simula tutta la partita (o il resto): le tue giocate le fa un giocatore virtuale. */
export function runToEnd(
  st0: LiveState,
  plan: MatchPlan,
  names: Rosters,
  moment: (m: Moment, index: number) => MomentResult,
  rng: Rng,
): { st: LiveState; results: MomentResult[] } {
  let st = st0;
  const results: MomentResult[] = [];
  for (let guard = 0; guard < 600 && !st.over; guard++) {
    const n = nextStep(st, plan, names, rng);
    st = n.st;
    if (n.step.kind === "moment") {
      const r = moment(n.step.moment, n.step.index);
      results.push(r);
      st = applyMoment(st, plan, names, r, rng);
    }
  }
  return { st, results };
}

/** Le squadre: la nostra prende forza dal livello, dalla fama e dalle abilità. */
export function levelTag(s: GameState) {
  return LEVELS[s.contract.level].name;
}

/** Il punteggio di un tiro (per le scritte). */
export const shotPts = (shot: keyof typeof SHOTS) => SHOTS[shot].pts;

/** Un numero stabile per ogni giocatore (sulla maglia). */
export const shirtNumber = (name: string) => [0, 3, 4, 5, 7, 8, 9, 11, 12, 13, 14, 15, 21, 22, 24, 30, 31, 33, 44, 55][hash(name) % 20];

/** Una partita intera simulata (Simula, i test): piano, cronaca, tue giocate virtuali, risultato. */
export function simulateMatch(
  s: GameState,
  m: { opponent: string; home: boolean },
  diff: Difficulty,
  me: string,
  rng: Rng,
) {
  const plan = planMatch(s, m, diff, rng);
  const names = rosters(s, me, m.opponent, plan.size);
  const run = runToEnd(startLive(plan, rng), plan, names, (mm) => simMoment(s, mm, diff, rng), rng);
  const outcome = finishMatch(
    s,
    plan,
    run.results,
    { us: run.st.us, them: run.st.them, ast: run.st.extra.ast, reb: run.st.extra.reb },
    diff,
    true,
    rng,
  );
  return { plan, names, st: run.st, results: run.results, outcome };
}
