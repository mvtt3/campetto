import type { GameAward, GameState, MiniGame, Skill, Slot } from "./types";
import { CONSUMABLES, ITEMS, ITEM_BY_ID } from "./catalog";
import {
  DAILY,
  KING_PRIZE,
  LEVELS,
  LEVEL_ORDER,
  REAL_MATCH_BONUS,
  START_CONTRACT,
  TOKENS_MAX,
  addToken,
  addXp,
  clamp,
  dailyStatus,
  dow,
  fmtEuro,
  makeOffers,
  schedule,
  seasonSummary,
  weeklyNet,
  type Rng,
} from "./economy";
import type { MatchOutcome } from "./match";
import {
  applyFx,
  dayEvents,
  deliver,
  expireIgnored,
  girlfriend,
  initialContacts,
  matchEvents,
  matchToday,
  purchaseEvents,
} from "./messages";
import { MINI } from "./minigames";

/** Una partita del gioco al giorno in più per quanto si allena: il "cosa faccio oggi". */
export type Activity =
  | { kind: "allenamento"; skill: Skill }
  | { kind: "riposo" }
  | { kind: "serata" }
  | { kind: "ragazza" }
  | { kind: "amici" }
  /** Il giorno della partita, dopo averla giocata. */
  | { kind: "partita" };

export const SKILL_NAMES: Record<Skill, string> = {
  tiro: "Tiro",
  passaggio: "Passaggio",
  difesa: "Difesa",
  fisico: "Fisico",
};

export function newGame(o: { now: number; friend: string; realSeen: string[] }): GameState {
  const iso = new Date(o.now).toISOString();
  let s: GameState = {
    v: 1,
    createdAt: iso,
    updatedAt: iso,
    day: 1,
    contract: { ...START_CONTRACT },
    season: { n: 1, matches: schedule("campetto", 1, START_CONTRACT.team, `s1-${iso}`) },
    offers: [],
    money: 0,
    energy: 100,
    happiness: 70,
    fame: 0,
    skills: { tiro: 45, passaggio: 40, difesa: 40, fisico: 45 },
    xp: { tiro: 0, passaggio: 0, difesa: 0, fisico: 0 },
    owned: [],
    outfit: {},
    contacts: [],
    bank: [],
    yesterday: null,
    tonight: null,
    singleSince: null,
    badges: { banca: 0, contratti: 0 },
    tokens: TOKENS_MAX,
    tokensAt: iso,
    realSeen: o.realSeen,
    daily: { last: null, streak: 0 },
    tutorial: { step: 0, seen: [] },
    perks: { trainer: false, agent: false },
    once: [],
    sent: {},
    career: { games: 0, wins: 0, pts: 0, ast: 0, reb: 0, stl: 0, blk: 0, best: 0 },
  };
  s = { ...s, contacts: initialContacts(o.friend) };
  s = deliver(s, "mamma-scarpe");
  s = deliver(s, "coach-benvenuto");
  return s;
}

/** I salvataggi vecchi o arrivati a metà: si completano con i valori di partenza. */
export function normalize(raw: unknown, now: number, friend: string): GameState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<GameState>;
  if (r.v !== 1 || !r.contract || !r.season) return null;
  const base = newGame({ now, friend, realSeen: [] });
  return {
    ...base,
    ...r,
    skills: { ...base.skills, ...r.skills },
    xp: { ...base.xp, ...r.xp },
    perks: { ...base.perks, ...r.perks },
    badges: { ...base.badges, ...r.badges },
    daily: { ...base.daily, ...r.daily },
    tutorial: { ...base.tutorial, ...r.tutorial },
    career: { ...base.career, ...r.career },
    sent: r.sent ?? {},
    once: r.once ?? [],
    contacts: r.contacts ?? base.contacts,
  } as GameState;
}

export const levelIndex = (s: Pick<GameState, "contract">) => LEVEL_ORDER.indexOf(s.contract.level);

export const seasonOver = (s: GameState) => s.season.matches.every((m) => m.result);

export const todayMatch = (s: GameState) => {
  const i = s.season.matches.findIndex((m) => m.day === s.day);
  return i < 0 ? null : { index: i, match: s.season.matches[i] };
};

export const nextMatch = (s: GameState) => s.season.matches.find((m) => !m.result) ?? null;

/** Si può passare al giorno dopo? Non con una partita da giocare o un contratto da firmare. */
export function canAdvance(s: GameState): boolean {
  if (matchToday(s)) return false;
  if (seasonOver(s) && s.offers.length) return false;
  return true;
}

export const ACTIVITY_INFO = {
  allenamento: { name: "Allenamento", line: "−18 energia, abilità su" },
  riposo: { name: "Riposo", line: "+40 energia" },
  serata: { name: "Serata fuori", line: "+felicità, +fama, −energia" },
  ragazza: { name: "Esci con lei", line: "+felicità, più vicini" },
  amici: { name: "Pizza con gli amici", line: "+felicità" },
  partita: { name: "Domani", line: "" },
} as const;

export function activityCost(s: GameState, kind: Activity["kind"]): number {
  const m = LEVELS[s.contract.level].mult;
  return kind === "serata" ? 40 * m : kind === "ragazza" ? 20 * m : kind === "amici" ? 10 * m : 0;
}

/** Il giorno di oggi finisce con quello che hai scelto, e ne comincia un altro. */
export function advanceDay(s: GameState, act: Activity, rng: Rng): { s: GameState; note: string } {
  if (!canAdvance(s)) return { s, note: "" };
  let st = s;
  let note = "";
  const gf = girlfriend(st);
  const cost = activityCost(st, act.kind);
  switch (act.kind) {
    case "allenamento": {
      const gain = st.perks.trainer ? 24 : 12;
      const before = st.skills[act.skill];
      st = addXp(st, act.skill, gain);
      if (act.skill !== "fisico") st = addXp(st, "fisico", 2);
      st = { ...st, energy: clamp(st.energy - 18, 0, 100), happiness: clamp(st.happiness - 2, 0, 100) };
      st = applyFx(st, "coach", { rel: 1 });
      const up = st.skills[act.skill] - before;
      note = up > 0 ? `${SKILL_NAMES[act.skill]} sale a ${st.skills[act.skill]}!` : `${SKILL_NAMES[act.skill]}: +${gain} esperienza`;
      break;
    }
    case "riposo":
      st = { ...st, energy: clamp(st.energy + 40, 0, 100), happiness: clamp(st.happiness + 4, 0, 100) };
      note = "Riposato: energia su";
      break;
    case "serata":
      st = applyFx(st, "dario", { happiness: 12, energy: -22, fame: 2, rel: 5 });
      st = payOut(st, cost, "Serata fuori");
      note = "Che serata! Domani un po' di sonno";
      break;
    case "ragazza":
      if (gf) {
        st = applyFx(st, gf.id, { rel: 10, happiness: 8, energy: 10 });
        st = payOut(st, cost, `Uscita con ${gf.name}`);
        note = `${gf.name} è contenta`;
      }
      break;
    case "amici":
      st = applyFx(st, "socio", { rel: 4, happiness: 7, energy: 5 });
      st = payOut(st, cost, "Pizza con gli amici");
      note = "Pizza e risate";
      break;
    case "partita":
      break;
  }
  st = {
    ...st,
    yesterday: st.tonight ?? act.kind,
    tonight: null,
    day: st.day + 1,
    // La notte: un po' di energia torna, l'umore torna verso il normale.
    energy: clamp(st.energy + 8, 0, 100),
    happiness: st.happiness > 62 ? st.happiness - 1 : st.happiness < 58 ? st.happiness + 1 : st.happiness,
  };
  st = enterDay(st, rng);
  return { s: st, note };
}

function payOut(s: GameState, amount: number, label: string): GameState {
  const v = Math.min(amount, s.money);
  if (v <= 0) return s;
  return { ...s, money: s.money - v, bank: [...s.bank, { day: s.day, label, amount: -v }].slice(-60) };
}

/** Quello che succede all'inizio di ogni giorno: stipendio il lunedì, messaggi. */
function enterDay(s: GameState, rng: Rng): GameState {
  let st = s;
  if (dow(st.day) === 0 && st.day > 1) {
    const net = weeklyNet(st.contract);
    st = {
      ...st,
      money: st.money + net,
      bank: [...st.bank, { day: st.day, label: `Stipendio · ${st.contract.team}`, amount: net }].slice(-60),
      badges: { ...st.badges, banca: st.badges.banca + 1 },
    };
  }
  st = expireIgnored(st);
  for (const id of dayEvents(st, rng)) st = deliver(st, id, {}, rng);
  return st;
}

/** La partita è finita: risultato, soldi, fama, esperienza, e i messaggi che arrivano. */
export function applyMatch(
  s: GameState,
  index: number,
  o: MatchOutcome,
  now: number,
  rng: Rng,
): GameState {
  const m = s.season.matches[index];
  if (!m || m.result) return s;
  const won = o.result.us > o.result.them;
  const firstWin = won && s.career.wins === 0;
  let st: GameState = {
    ...s,
    season: {
      ...s.season,
      matches: s.season.matches.map((x, i) => (i === index ? { ...x, result: o.result } : x)),
    },
    fame: clamp(s.fame + o.fame, 0, 100),
    happiness: clamp(s.happiness + o.happiness, 0, 100),
    energy: clamp(s.energy + o.energy, 0, 100),
    career: {
      games: s.career.games + 1,
      wins: s.career.wins + (won ? 1 : 0),
      pts: s.career.pts + o.result.pts,
      ast: s.career.ast + o.result.ast,
      reb: s.career.reb + o.result.reb,
      stl: s.career.stl + o.result.stl,
      blk: s.career.blk + o.result.blk,
      best: Math.max(s.career.best, o.result.rating),
    },
  };
  if (o.money > 0)
    st = {
      ...st,
      money: st.money + o.money,
      bank: [...st.bank, { day: st.day, label: `Premio vittoria · ${m.opponent}`, amount: o.money }].slice(-60),
    };
  for (const [k, v] of Object.entries(o.xp)) st = addXp(st, k as Skill, v ?? 0);
  // Il coach si ricorda di come hai giocato.
  st = applyFx(st, "coach", { rel: o.result.benched ? -6 : o.result.rating >= 7.5 ? 4 : o.result.rating < 5.5 ? -3 : 1 });
  if (!o.result.simulated) st = addToken(st, now);
  for (const id of matchEvents(st, o.result, firstWin, rng)) st = deliver(st, id, {}, rng);
  if (seasonOver(st)) {
    const sum = seasonSummary(st);
    st = { ...st, offers: makeOffers(st, rng), badges: { ...st.badges, contratti: st.badges.contratti + 1 } };
    st = deliver(st, "agente-offerte", { promoted: sum.promoted ? 1 : 0 }, rng);
    if (sum.promoted && LEVELS[st.contract.level].next) st = deliver(st, "coach-promozione", {}, rng);
  }
  return st;
}

/** Firmi un contratto: nuova squadra (o la stessa), nuova stagione dal lunedì dopo. */
export function acceptOffer(s: GameState, offerId: string, rng: Rng): GameState {
  const o = s.offers.find((x) => x.id === offerId);
  if (!o) return s;
  const up = LEVEL_ORDER.indexOf(o.level) > levelIndex(s);
  const start = s.day + ((7 - dow(s.day)) % 7 || 7);
  const n = s.season.n + 1;
  let st: GameState = {
    ...s,
    contract: { team: o.team, level: o.level, salary: o.salary, sponsor: s.contract.sponsor },
    offers: [],
    season: { n, matches: schedule(o.level, start, o.team, `s${n}-${s.createdAt}`) },
    day: start,
    yesterday: null,
    tonight: null,
    badges: { ...s.badges, contratti: 0 },
  };
  // Cambiando squadra cambia anche il coach (e si riparte da zero con lui).
  if (o.team !== s.contract.team) st = applyFx(st, "coach", { rel: -(st.contacts.find((c) => c.role === "coach")?.rel ?? 0) });
  if (up) st = deliver(st, "mamma-promozione", {}, rng);
  st = enterDay(st, rng);
  return st;
}

export function canBuy(s: GameState, id: string): { ok: boolean; why?: string } {
  const it = ITEM_BY_ID.get(id);
  if (!it || it.prize) return { ok: false, why: "Non in vendita" };
  if (s.owned.includes(id)) return { ok: false, why: "Già tuo" };
  if (LEVEL_ORDER.indexOf(it.level) > levelIndex(s))
    return { ok: false, why: `Dalla ${LEVELS[it.level].name}` };
  if (s.money < it.price) return { ok: false, why: `Ti mancano ${fmtEuro(it.price - s.money)}` };
  return { ok: true };
}

export function buyItem(s: GameState, id: string, rng: Rng): GameState {
  const it = ITEM_BY_ID.get(id);
  if (!it || !canBuy(s, id).ok) return s;
  const before = s.money;
  let st: GameState = {
    ...s,
    money: s.money - it.price,
    owned: [...s.owned, id],
    outfit: { ...s.outfit, [it.slot]: id },
    bank: [...s.bank, { day: s.day, label: `Shopping · ${it.name}`, amount: -it.price }].slice(-60),
    fame: clamp(s.fame + (it.price >= 1000 ? 2 : 0), 0, 100),
    happiness: clamp(s.happiness + (it.price >= 300 ? 4 : 2), 0, 100),
  };
  for (const ev of purchaseEvents(st, it.price, before)) st = deliver(st, ev, {}, rng);
  return st;
}

export function equip(s: GameState, slot: Slot, id: string | null): GameState {
  if (id && (!s.owned.includes(id) || ITEM_BY_ID.get(id)?.slot !== slot)) return s;
  const outfit = { ...s.outfit };
  if (id) outfit[slot] = id;
  else delete outfit[slot];
  return { ...s, outfit };
}

export function consumablePrice(s: GameState, id: string): number {
  const c = CONSUMABLES.find((x) => x.id === id);
  return c ? Math.round(c.price * LEVELS[s.contract.level].mult) : 0;
}

export function buyConsumable(s: GameState, id: string): GameState {
  const c = CONSUMABLES.find((x) => x.id === id);
  if (!c) return s;
  if (c.perk && s.perks[c.perk]) return s;
  const price = consumablePrice(s, id);
  if (s.money < price) return s;
  return {
    ...s,
    money: s.money - price,
    energy: clamp(s.energy + (c.energy ?? 0), 0, 100),
    happiness: clamp(s.happiness + (c.happiness ?? 0), 0, 100),
    perks: c.perk ? { ...s.perks, [c.perk]: true } : s.perks,
    bank: [...s.bank, { day: s.day, label: c.name, amount: -price }].slice(-60),
  };
}

/** Il premio del giorno: soldi, energia, un vestito, un allenamento, un accessorio raro. */
export function claimDaily(s: GameState, today: string): { s: GameState; label: string } | null {
  const st = dailyStatus(s, today);
  if (st.claimed) return null;
  const prize = DAILY[st.step - 1];
  const mult = LEVELS[s.contract.level].mult;
  let out: GameState = { ...s, daily: { last: today, streak: st.step } };
  let label = "";
  const money = (base: number, why: string) => {
    const v = base * mult;
    out = {
      ...out,
      money: out.money + v,
      bank: [...out.bank, { day: out.day, label: why, amount: v }].slice(-60),
    };
    label = `+${fmtEuro(v)}`;
  };
  switch (prize.kind) {
    case "money":
      money(prize.base, `Premio del giorno ${st.step}`);
      break;
    case "energy":
      out = { ...out, energy: 100 };
      label = "Energia piena";
      break;
    case "item": {
      const it = ITEMS.filter(
        (i) => !i.prize && !out.owned.includes(i.id) && LEVEL_ORDER.indexOf(i.level) <= levelIndex(out),
      ).sort((a, b) => a.price - b.price)[0];
      if (it) {
        out = {
          ...out,
          owned: [...out.owned, it.id],
          outfit: out.outfit[it.slot] ? out.outfit : { ...out.outfit, [it.slot]: it.id },
        };
        label = it.name;
      } else money(300, "Premio del giorno 4");
      break;
    }
    case "training": {
      const weakest = (Object.keys(out.skills) as Skill[]).sort((a, b) => out.skills[a] - out.skills[b])[0];
      out = addXp(out, weakest, 14);
      label = `Allenamento gratis: ${SKILL_NAMES[weakest]}`;
      break;
    }
    case "rare":
      if (!out.owned.includes("occhiali-stella")) {
        out = { ...out, owned: [...out.owned, "occhiali-stella"], outfit: { ...out.outfit, occhi: "occhiali-stella" } };
        label = "Occhiali a stella";
      } else money(2000, "Premio della settimana");
      break;
  }
  return { s: out, label };
}

/** Le partite vere del gruppo valgono anche qui: soldi, energia piena e un gettone. */
export function realMatchBonus(
  s: GameState,
  ids: string[],
  now: number,
  rng: Rng,
): { s: GameState; count: number } {
  const fresh = ids.filter((id) => !s.realSeen.includes(id));
  if (!fresh.length) return { s, count: 0 };
  const mult = LEVELS[s.contract.level].mult;
  const v = REAL_MATCH_BONUS * mult * fresh.length;
  let st: GameState = {
    ...s,
    realSeen: [...s.realSeen, ...fresh].slice(-200),
    money: s.money + v,
    energy: 100,
    bank: [
      ...s.bank,
      { day: s.day, label: fresh.length > 1 ? `Partite vere al campetto (${fresh.length})` : "Partita vera al campetto", amount: v },
    ].slice(-60),
    badges: { ...s.badges, banca: s.badges.banca + 1 },
  };
  for (let i = 0; i < fresh.length; i++) st = addToken(st, now);
  st = deliver(st, "socio-vero", { bonus: fmtEuro(v) }, rng);
  return { s: st, count: fresh.length };
}

/** I premi di mezzanotte: primo in una classifica = soldi; primo in tutte e tre = la corona. */
export function applyAwards(s: GameState, awards: GameAward[]): GameState {
  if (!awards.length) return s;
  const mult = LEVELS[s.contract.level].mult;
  let st = s;
  for (const a of awards) {
    const v = KING_PRIZE * mult;
    st = {
      ...st,
      money: st.money + v,
      bank: [...st.bank, { day: st.day, label: `Re del campetto · ${MINI[a.game as MiniGame].name}`, amount: v }].slice(-60),
      badges: { ...st.badges, banca: st.badges.banca + 1 },
    };
  }
  const byDay = new Map<string, number>();
  for (const a of awards) byDay.set(a.day, (byDay.get(a.day) ?? 0) + 1);
  if ([...byDay.values()].some((n) => n >= 3) && !st.owned.includes("corona"))
    st = { ...st, owned: [...st.owned, "corona"], outfit: { ...st.outfit, testa: "corona" } };
  return st;
}
