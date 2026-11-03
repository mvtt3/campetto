import type { Difficulty, GameState, Moment, SeasonMatch, ShotOutcome, Skill } from "./types";
import { LEVELS, clamp, overall, pick, teamStrength, type Rng } from "./economy";

/**
 * La partita stile New Star Soccer: non si gioca tutta, solo i momenti chiave
 * (6–10). In attacco: tiro (tieni premuto e lascia sul verde) o passaggio (tocca il
 * compagno quando è libero). In difesa: rubata o stoppata, a tempo. Il resto della
 * partita lo giocano i compagni.
 */

export const DIFF: Record<
  Difficulty,
  { name: string; zone: number; ring: number; prize: number; sweep: number; ringMs: number; line: string; opp: number }
> = {
  facile: { name: "Facile", zone: 0.16, ring: 0.12, prize: 0.5, sweep: 1100, ringMs: 1250, opp: 0.9, line: "Zona verde larga, premi a metà" },
  normale: { name: "Normale", zone: 0.11, ring: 0.085, prize: 1, sweep: 900, ringMs: 1050, opp: 1, line: "Come al campetto" },
  difficile: { name: "Difficile", zone: 0.075, ring: 0.06, prize: 2, sweep: 760, ringMs: 900, opp: 1.06, line: "Zona stretta, premi doppi, coach nervoso" },
};

export const SHOTS = {
  sotto: { pts: 2, f: 1.25, label: "Sotto canestro" },
  media: { pts: 2, f: 1, label: "Dalla media" },
  tripla: { pts: 3, f: 0.8, label: "Da tre" },
} as const;
export type Shot = keyof typeof SHOTS;

/** Dove sta il verde sulla barra del tiro (0 in basso, 1 in alto). */
export const ZONE_CENTER = 0.8;
/** Dove si chiude il cerchio del passaggio e della difesa. */
export const RING_TARGET = 0.75;

/** Stanchezza e umore: sotto 30 di energia o di felicità si gioca peggio. */
export function condition(s: Pick<GameState, "energy" | "happiness">): number {
  const e = s.energy < 15 ? 0.7 : s.energy < 30 ? 0.82 : 1;
  const h = s.happiness < 30 ? 0.88 : s.happiness >= 80 ? 1.04 : 1;
  return e * h;
}

/** Quanto è larga la zona verde, da 0 a 1 della barra. */
export function shotZone(
  s: Pick<GameState, "skills" | "energy" | "happiness">,
  diff: Difficulty,
  shot: Shot,
  open: boolean,
): number {
  return clamp(
    DIFF[diff].zone *
      (0.6 + s.skills.tiro / 100) *
      condition(s) *
      (open ? 1.15 : 0.8) *
      SHOTS[shot].f,
    0.02,
    0.4,
  );
}

/** Mezza finestra buona del cerchio (passaggio o difesa), in frazione del tempo. */
export function ringWindow(
  s: Pick<GameState, "skills" | "energy" | "happiness">,
  diff: Difficulty,
  skill: Skill,
): number {
  return clamp(DIFF[diff].ring * (0.6 + s.skills[skill] / 100) * condition(s), 0.02, 0.25);
}

/** Dove sta la barra dopo `t` ms che tieni premuto: sale, scende, risale. */
export function barPos(t: number, sweep: number): number {
  const x = (Math.max(0, t) / sweep) % 2;
  return x <= 1 ? x : 2 - x;
}

export function judgeShot(
  pos: number,
  zone: number,
  tiro: number,
  rng: Rng,
): { outcome: ShotOutcome; made: boolean } {
  const d = Math.abs(pos - ZONE_CENTER);
  if (d <= zone / 2) return { outcome: "verde", made: rng() < 0.97 };
  if (d <= zone)
    return { outcome: "buono", made: rng() < clamp(0.3 + tiro / 220, 0.3, 0.75) };
  return { outcome: "fuori", made: rng() < 0.05 };
}

/** Il tocco sul cerchio: dentro la finestra è buono, a metà finestra è perfetto. */
export function judgeRing(p: number | null, win: number): "perfetto" | "buono" | "fuori" {
  if (p === null) return "fuori";
  const d = Math.abs(p - RING_TARGET);
  if (d <= win / 2) return "perfetto";
  if (d <= win) return "buono";
  return "fuori";
}

export interface MatchPlan {
  opponent: string;
  home: boolean;
  moments: Moment[];
  /** Entri dalla panchina: meno momenti (troppo stanco o coach arrabbiato). */
  fromBench: boolean;
  /** Errori di fila dopo cui il coach ti toglie. */
  benchAfter: number;
  /** I punti del resto della partita, senza di te. */
  usBase: number;
  themBase: number;
  size: 3 | 5;
}

export const coachRel = (s: GameState) =>
  s.contacts.find((c) => c.role === "coach")?.rel ?? 0;

export function isCaptain(s: GameState): boolean {
  return coachRel(s) >= 70 && s.fame >= 30;
}

function clockLabel(i: number, n: number, size: 3 | 5): string {
  const p = (i + 0.5) / n;
  if (size === 3) {
    if (i === n - 1) return "Palla decisiva";
    return p < 0.3 ? "Inizio partita" : p < 0.65 ? "A metà partita" : "Finale punto a punto";
  }
  const q = Math.min(4, Math.floor(p * 4) + 1);
  const left = Math.max(0.2, 10 - ((p * 4) % 1) * 10);
  const m = Math.floor(left);
  const sec = Math.round((left - m) * 60) % 60;
  return `${q}° quarto · ${m}:${String(sec).padStart(2, "0")}`;
}

export function planMatch(
  s: GameState,
  m: Pick<SeasonMatch, "opponent" | "home">,
  diff: Difficulty,
  rng: Rng,
): MatchPlan {
  const size = LEVELS[s.contract.level].size;
  const coach = coachRel(s);
  let n = clamp(
    6 +
      Math.round(coach / 25) +
      (s.fame >= 40 ? 1 : 0) +
      (diff === "difficile" ? 1 : 0) +
      (isCaptain(s) ? 1 : 0),
    5,
    10,
  );
  const fromBench = s.energy < 15 || coach <= -50;
  if (fromBench) n = Math.max(3, Math.floor(n / 2));
  const kinds: ("attacco" | "difesa")[] = [];
  for (let i = 0; i < n; i++) kinds.push(rng() < 0.62 ? "attacco" : "difesa");
  // Almeno tre attacchi e una difesa.
  while (kinds.filter((k) => k === "attacco").length < Math.min(3, n))
    kinds[kinds.indexOf("difesa")] = "attacco";
  if (!kinds.includes("difesa")) kinds[Math.min(2, n - 1)] = "difesa";
  // L'ultima palla, se è in attacco, è sempre da giocare.
  const moments: Moment[] = kinds.map((k, i) => {
    const clock = clockLabel(i, n, size);
    if (k === "difesa")
      return { kind: "difesa", action: rng() < 0.55 ? "rubata" : "stoppata", clock };
    const r = rng();
    return {
      kind: "attacco",
      shot: r < 0.36 ? "sotto" : r < 0.7 ? "media" : "tripla",
      open: rng() < 0.5,
      clock,
    };
  });
  const usStr = 1 + s.fame / 500 + (overall(s) - 50) / 300;
  const oppStr = teamStrength(m.opponent) * DIFF[diff].opp;
  const usBase =
    size === 3 ? Math.round((14 + rng() * 5) * usStr) : Math.round((60 + rng() * 12) * usStr);
  const themBase =
    size === 3 ? Math.round((16.5 + rng() * 5) * oppStr) : Math.round((69 + rng() * 12) * oppStr);
  return {
    opponent: m.opponent,
    home: m.home,
    moments,
    fromBench,
    benchAfter: (diff === "facile" ? 4 : 3) + (coach >= 30 ? 1 : 0),
    usBase,
    themBase,
    size,
  };
}

export type MomentResult =
  | { kind: "tiro"; shot: Shot; outcome: ShotOutcome; made: boolean; pts: number }
  | { kind: "passaggio"; ok: boolean; perfect: boolean; made: boolean; pts: number }
  | { kind: "difesa"; action: "rubata" | "stoppata"; ok: boolean; perfect: boolean; fastBreak: boolean }
  | { kind: "panchina" };

export function shotResult(shot: Shot, j: { outcome: ShotOutcome; made: boolean }): MomentResult {
  return { kind: "tiro", shot, outcome: j.outcome, made: j.made, pts: j.made ? SHOTS[shot].pts : 0 };
}

/** Il passaggio: se è buono, il compagno tira (e se segna è un assist). */
export function passResult(
  s: GameState,
  shot: Shot,
  open: boolean,
  hit: "perfetto" | "buono" | "fuori",
  rng: Rng,
): MomentResult {
  if (hit === "fuori") return { kind: "passaggio", ok: false, perfect: false, made: false, pts: 0 };
  const p = clamp(
    0.42 + s.skills.passaggio / 250 + (hit === "perfetto" ? 0.15 : 0) + (open ? 0 : 0.05),
    0.3,
    0.9,
  );
  const made = rng() < p;
  return {
    kind: "passaggio",
    ok: true,
    perfect: hit === "perfetto",
    made,
    pts: made ? SHOTS[shot].pts : 0,
  };
}

export function defenseResult(
  action: "rubata" | "stoppata",
  hit: "perfetto" | "buono" | "fuori",
  rng: Rng,
): MomentResult {
  const ok = hit !== "fuori";
  return {
    kind: "difesa",
    action,
    ok,
    perfect: hit === "perfetto",
    fastBreak: ok && rng() < (hit === "perfetto" ? 0.6 : 0.35),
  };
}

const isFail = (r: MomentResult) =>
  (r.kind === "tiro" && !r.made) || (r.kind === "passaggio" && !r.ok);

/** Il coach ti toglie? Dopo troppi errori di fila, se c'è ancora partita da giocare. */
export function shouldBench(plan: MatchPlan, results: MomentResult[]): boolean {
  if (results.length >= plan.moments.length) return false;
  let run = 0;
  for (let i = results.length - 1; i >= 0 && isFail(results[i]); i--) run++;
  return run >= plan.benchAfter;
}

/** Simula: un giocatore virtuale con le tue abilità gioca i momenti al posto tuo. */
export function simulateMoments(
  s: GameState,
  plan: MatchPlan,
  diff: Difficulty,
  rng: Rng,
): MomentResult[] {
  const out: MomentResult[] = [];
  for (const m of plan.moments) {
    if (shouldBench(plan, out)) {
      while (out.length < plan.moments.length) out.push({ kind: "panchina" });
      break;
    }
    if (m.kind === "attacco") {
      if (s.skills.passaggio > s.skills.tiro + 4 && rng() < 0.4) {
        const w = ringWindow(s, diff, "passaggio");
        const r = rng();
        const hit = r < w * 2.2 ? "perfetto" : r < w * 5.5 ? "buono" : "fuori";
        out.push(passResult(s, m.shot, m.open, hit, rng));
      } else {
        const z = shotZone(s, diff, m.shot, m.open);
        const r = rng();
        const outcome: ShotOutcome =
          r < clamp(z * 2.6, 0.05, 0.6) ? "verde" : r < clamp(z * 5.2, 0.12, 0.85) ? "buono" : "fuori";
        const made =
          outcome === "verde"
            ? rng() < 0.97
            : outcome === "buono"
              ? rng() < clamp(0.3 + s.skills.tiro / 220, 0.3, 0.75)
              : rng() < 0.05;
        out.push(shotResult(m.shot, { outcome, made }));
      }
    } else {
      const w = ringWindow(s, diff, m.action === "rubata" ? "difesa" : "fisico");
      const r = rng();
      const hit = r < w * 2.2 ? "perfetto" : r < w * 5.5 ? "buono" : "fuori";
      out.push(defenseResult(m.action, hit, rng));
    }
  }
  return out;
}

export interface MatchOutcome {
  result: NonNullable<SeasonMatch["result"]>;
  money: number;
  fame: number;
  happiness: number;
  energy: number;
  xp: Partial<Record<Skill, number>>;
}

export function finishMatch(
  s: GameState,
  plan: MatchPlan,
  results: MomentResult[],
  diff: Difficulty,
  simulated: boolean,
  rng: Rng,
): MatchOutcome {
  let pts = 0;
  let ast = 0;
  let stl = 0;
  let blk = 0;
  let us = plan.usBase;
  let them = plan.themBase;
  let rating = 5.6;
  const xp: Partial<Record<Skill, number>> = { fisico: 2 };
  const add = (k: Skill, v: number) => (xp[k] = (xp[k] ?? 0) + v);
  const benched = results.some((r) => r.kind === "panchina");
  for (const r of results) {
    if (r.kind === "tiro") {
      pts += r.pts;
      us += r.pts;
      rating += r.made ? (r.outcome === "verde" ? 0.65 : 0.45) : -0.3;
      add("tiro", 2 + (r.made ? 1 : 0));
    } else if (r.kind === "passaggio") {
      add("passaggio", 3);
      if (!r.ok) rating -= 0.3;
      else if (r.made) {
        ast++;
        us += r.pts;
        rating += 0.4;
      } else rating += 0.05;
    } else if (r.kind === "difesa") {
      add(r.action === "rubata" ? "difesa" : "fisico", 3);
      if (r.ok) {
        rating += r.perfect ? 0.6 : 0.45;
        if (r.action === "rubata") stl++;
        else blk++;
        if (r.fastBreak) {
          pts += 2;
          us += 2;
        }
      } else {
        rating -= 0.25;
        them += rng() < 0.25 ? 3 : 2;
      }
    }
  }
  // Qualche punto anche fuori dai momenti chiave (rimbalzi, tiri liberi…).
  const extra =
    plan.size === 3
      ? pick(rng, [0, 0, 1, 2])
      : Math.round(rng() * (2 + s.skills.tiro / 20));
  pts += extra;
  us += extra;
  // Ai 21 nel 3 contro 3: il vincente arriva a 21 esatto.
  if (plan.size === 3) {
    if (us === them) {
      if (rng() < 0.5) us += 1;
      else them += 1;
    }
    const top = Math.max(us, them);
    const f = 21 / top;
    const win = us > them;
    let lose = Math.round((win ? them : us) * f);
    lose = Math.min(lose, 20);
    us = win ? 21 : lose;
    them = win ? lose : 21;
    if (pts > us) pts = us;
  } else {
    while (us === them) {
      us += Math.round(rng() * 8);
      them += Math.round(rng() * 8);
    }
  }
  const won = us > them;
  rating += won ? 0.6 : -0.2;
  if (benched) rating -= 0.8;
  if (plan.fromBench) rating -= 0.3;
  rating = clamp(Math.round(rating * 2) / 2, 4, 10);
  const reb = Math.round(rng() * (plan.size === 3 ? 3 : 6) * (0.5 + s.skills.fisico / 100));
  let fame = rating >= 9 ? 4 : rating >= 8 ? 3 : rating >= 7 ? 2 : rating >= 6 ? 1 : rating < 5 ? -1 : 0;
  if (fame > 0 && diff === "difficile") fame += 1;
  if (fame > 0 && diff === "facile") fame = Math.max(0, fame - 1);
  if (simulated) fame = Math.min(fame, 1);
  const money = won
    ? Math.round(LEVELS[s.contract.level].win * DIFF[diff].prize * (simulated ? 0.5 : 1))
    : 0;
  return {
    result: {
      us,
      them,
      rating,
      pts,
      ast,
      reb,
      stl,
      blk,
      simulated,
      benched,
    },
    money,
    fame,
    happiness: (won ? 6 : -6) + (rating >= 8 ? 4 : 0),
    energy: simulated ? -12 : -22,
    xp,
  };
}

/** Una riga di cronaca per ogni momento. */
export function commentary(r: MomentResult, rng: Rng): string {
  switch (r.kind) {
    case "tiro":
      if (r.made && r.outcome === "verde")
        return pick(rng, r.shot === "tripla"
          ? ["Tripla dal verde. Solo retina!", "Da tre, ciuff! Non ha toccato il ferro"]
          : ["Verde perfetto: ciuff!", "Rilascio perfetto, dentro"]);
      if (r.made) return pick(rng, ["Balla sul ferro… e va dentro!", "Non bellissimo, ma vale lo stesso", "Tabella e dentro"]);
      return r.outcome === "fuori"
        ? pick(rng, ["Mattone. Lo hanno sentito in tribuna", "Air ball… che figura", "Rilascio sbagliato, fuori"])
        : pick(rng, ["Esce di un niente", "Ferro! Così vicino", "Gira sul ferro e se ne va"]);
    case "passaggio":
      if (!r.ok) return pick(rng, ["Palla persa: passaggio letto in anticipo", "Passaggio in tribuna"]);
      return r.made
        ? pick(rng, ["Che assist! Il compagno appoggia facile", "Passaggio no-look, canestro"])
        : "Bel passaggio, ma il compagno sbaglia";
    case "difesa":
      if (!r.ok)
        return r.action === "rubata" ? "Ti salta in palleggio e segna" : "Arrivi tardi: canestro loro";
      if (r.fastBreak) return r.action === "rubata" ? "Rubata e contropiede: due punti tuoi!" : "Stoppata e ripartenza: canestro in contropiede!";
      return r.action === "rubata" ? "Palla rubata!" : pick(rng, ["Stoppata da cineteca!", "Gliel'hai rimandata in faccia"]);
    case "panchina":
      return "In panchina";
  }
}
