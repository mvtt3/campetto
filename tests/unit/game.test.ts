import { describe, expect, it } from "vitest";
import {
  DAILY,
  LEVELS,
  TOKEN_MS,
  addXp,
  dailyStatus,
  makeOffers,
  nextTokenIn,
  prevDay,
  refillTokens,
  romeDay,
  schedule,
  seeded,
  spendToken,
  weeklyNet,
} from "@/lib/game/economy";
import {
  DIFF,
  ZONE_CENTER,
  barPos,
  finishMatch,
  judgeRing,
  judgeShot,
  planMatch,
  shotZone,
  type MomentResult,
} from "@/lib/game/match";
import { answer, deliver, girlfriend, mood } from "@/lib/game/messages";
import { applyMoment, nextStep, rosters, simulateMatch, startLive } from "@/lib/game/live";
import { dunkScore, DUNKS, liberiZone, tripleValue } from "@/lib/game/minigames";
import {
  acceptOffer,
  advanceDay,
  applyAwards,
  applyMatch,
  buyItem,
  canAdvance,
  canBuy,
  claimDaily,
  newGame,
  normalize,
  realMatchBonus,
  todayMatch,
} from "@/lib/game/state";
import { ITEMS } from "@/lib/game/catalog";
import type { GameState } from "@/lib/game/types";

const NOW = Date.parse("2026-11-03T10:00:00Z");
const fresh = () => newGame({ now: NOW, friend: "Simone", realSeen: ["m1"] });

/** Un giorno: se c'è la partita la simula, poi va a domani. */
function step(s: GameState, rng = seeded(7)): GameState {
  let st = s;
  const t = todayMatch(st);
  if (t && !t.match.result) {
    st = applyMatch(st, t.index, simulateMatch(st, t.match, "normale", "Tu", rng).outcome, NOW, rng);
  }
  return canAdvance(st) ? advanceDay(st, t ? { kind: "partita" } : { kind: "riposo" }, rng).s : st;
}

/** Gioca (simulando) tutta la stagione, scegliendo il riposo nei giorni liberi. */
function playSeason(s: GameState, rng = seeded(7)): GameState {
  let st = s;
  for (let guard = 0; guard < 400 && st.season.matches.some((m) => !m.result); guard++) {
    const t = todayMatch(st);
    if (t && !t.match.result) {
      st = applyMatch(st, t.index, simulateMatch(st, t.match, "normale", "Tu", rng).outcome, NOW, rng);
    }
    if (canAdvance(st)) st = advanceDay(st, t ? { kind: "partita" } : { kind: "riposo" }, rng).s;
  }
  return st;
}

describe("Campetto Star: partenza", () => {
  it("si parte dal campetto con 100 € di mamma e due messaggi da leggere", () => {
    const s = fresh();
    expect(s.contract.level).toBe("campetto");
    expect(s.money).toBe(100);
    expect(s.tokens).toBe(5);
    expect(s.contacts.find((c) => c.id === "mamma")!.pending?.event).toBe("mamma-scarpe");
    expect(s.contacts.find((c) => c.id === "coach")!.unread).toBeGreaterThan(0);
    expect(s.contacts.find((c) => c.id === "socio")!.name).toBe("Simone");
    expect(s.season.matches).toHaveLength(LEVELS.campetto.matches);
  });

  it("calendario: mercoledì e sabato, senza giocare contro sé stessi", () => {
    const m = schedule("b", 8, "Torino Tombini", "x");
    expect(m).toHaveLength(20);
    expect(m.map((x) => ((x.day - 1) % 7))).toEqual(Array.from({ length: 20 }, (_, i) => (i % 2 ? 5 : 2)));
    expect(m.some((x) => x.opponent === "Torino Tombini")).toBe(false);
  });

  it("i salvataggi a metà si completano senza perdere niente", () => {
    const s = fresh();
    const half = JSON.parse(JSON.stringify({ ...s, money: 1234, perks: undefined, sent: undefined }));
    const n = normalize(half, NOW, "Simone")!;
    expect(n.money).toBe(1234);
    expect(n.perks).toEqual({ trainer: false, agent: false });
    expect(normalize({ v: 2 }, NOW, "x")).toBeNull();
  });
});

describe("Tiro e difesa", () => {
  it("la barra sale e scende", () => {
    expect(barPos(0, 900)).toBe(0);
    expect(barPos(900, 900)).toBeCloseTo(1);
    expect(barPos(1350, 900)).toBeCloseTo(0.5);
  });

  it("il verde è più largo in Facile, da libero e con più tiro", () => {
    const s = fresh();
    const n = shotZone(s, "normale", "media", true);
    expect(shotZone(s, "facile", "media", true)).toBeGreaterThan(n);
    expect(shotZone(s, "difficile", "media", true)).toBeLessThan(n);
    expect(shotZone(s, "normale", "media", false)).toBeLessThan(n);
    expect(shotZone({ ...s, skills: { ...s.skills, tiro: 90 } }, "normale", "media", true)).toBeGreaterThan(n);
    // Stanco o giù di morale: verde più stretto.
    expect(shotZone({ ...s, energy: 20 }, "normale", "media", true)).toBeLessThan(n);
    expect(shotZone({ ...s, happiness: 20 }, "normale", "media", true)).toBeLessThan(n);
  });

  it("sul verde è (quasi) sempre dentro, lontano quasi mai", () => {
    const rng = seeded(1);
    let green = 0;
    let far = 0;
    for (let i = 0; i < 400; i++) {
      if (judgeShot(ZONE_CENTER, 0.1, 50, rng).made) green++;
      if (judgeShot(0.2, 0.1, 50, rng).made) far++;
    }
    expect(green).toBeGreaterThan(370);
    expect(far).toBeLessThan(40);
    expect(judgeShot(ZONE_CENTER + 0.07, 0.1, 50, rng).outcome).toBe("buono");
  });

  it("il cerchio: perfetto al centro, fuori se non tocchi", () => {
    expect(judgeRing(0.75, 0.1)).toBe("perfetto");
    expect(judgeRing(0.83, 0.1)).toBe("buono");
    expect(judgeRing(0.9, 0.1)).toBe("fuori");
    expect(judgeRing(null, 0.1)).toBe("fuori");
  });
});

describe("Partita", () => {
  it("6–10 momenti, meno se entri dalla panchina", () => {
    const s = fresh();
    const rng = seeded(3);
    const p = planMatch(s, s.season.matches[0], "normale", rng);
    expect(p.moments.length).toBeGreaterThanOrEqual(5);
    expect(p.moments.length).toBeLessThanOrEqual(10);
    expect(p.moments.some((m) => m.kind === "difesa")).toBe(true);
    const tired = planMatch({ ...s, energy: 10 }, s.season.matches[0], "normale", seeded(3));
    expect(tired.fromBench).toBe(true);
    expect(tired.moments.length).toBeLessThan(p.moments.length);
  });

  it("3 contro 3 ai 21: si gioca fino a 21, i tuoi punti stanno nel punteggio", () => {
    const s = fresh();
    for (let i = 0; i < 60; i++) {
      const { st, outcome: o, results } = simulateMatch(s, s.season.matches[0], "normale", "Tu", seeded(i));
      expect(Math.max(o.result.us, o.result.them)).toBeGreaterThanOrEqual(21);
      expect(Math.max(o.result.us, o.result.them)).toBeLessThanOrEqual(23);
      expect(Math.min(o.result.us, o.result.them)).toBeLessThanOrEqual(20);
      expect(o.result.pts).toBeLessThanOrEqual(o.result.us);
      expect(o.result.rating).toBeGreaterThanOrEqual(4);
      expect(o.result.rating).toBeLessThanOrEqual(10);
      expect(o.money).toBe(o.result.us > o.result.them ? LEVELS.campetto.win / 2 : 0);
      // La cronaca racconta tutto: l'ultima riga è il risultato finale.
      expect(st.feed.at(-1)!.kind).toBe("end");
      expect(results.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("5 contro 5: quattro quarti, niente pareggi, punteggi da basket", () => {
    const s = { ...fresh(), contract: { team: "Roma Supplì", level: "b" as const, salary: 1000 } };
    for (let i = 0; i < 40; i++) {
      const { st, outcome: o } = simulateMatch(s, { opponent: "Bari Orecchiette", home: true }, "difficile", "Tu", seeded(100 + i));
      expect(o.result.us).not.toBe(o.result.them);
      expect(o.result.us + o.result.them).toBeGreaterThan(80);
      expect(st.period).toBeGreaterThanOrEqual(4);
      expect(st.feed.filter((l) => l.kind === "period").length).toBeGreaterThanOrEqual(3);
    }
  });

  it("le tue giocate cambiano la partita: chi segna sempre vince quasi sempre", () => {
    const s = fresh();
    let wonAll = 0;
    let wonNone = 0;
    for (let i = 0; i < 80; i++) {
      for (const good of [true, false]) {
        const rng = seeded(500 + i);
        const plan = planMatch(s, s.season.matches[0], "normale", rng);
        const names = rosters(s, "Tu", plan.opponent, plan.size);
        let st = startLive(plan, rng);
        const results: MomentResult[] = [];
        for (let g = 0; g < 400 && !st.over; g++) {
          const n = nextStep(st, plan, names, rng);
          st = n.st;
          if (n.step.kind === "moment") {
            const m = n.step.moment;
            const r: MomentResult =
              m.kind === "attacco"
                ? { kind: "tiro", shot: m.shot, outcome: good ? "verde" : "fuori", made: good, pts: good ? (m.shot === "tripla" ? 3 : 2) : 0 }
                : { kind: "difesa", action: m.action, ok: good, perfect: good, fastBreak: false };
            results.push(r);
            st = applyMoment(st, plan, names, r, rng);
          }
        }
        if (st.us > st.them) {
          if (good) wonAll++;
          else wonNone++;
        }
        // Chi sbaglia tutto finisce in panchina, chi segna sempre riceve più palloni.
        if (!good) expect(st.benched || results.length <= plan.moments.length).toBe(true);
        else expect(results.length).toBeGreaterThanOrEqual(Math.min(plan.moments.length - 1, 4));
      }
    }
    expect(wonAll).toBeGreaterThan(60);
    expect(wonNone).toBeLessThan(25);
  });

  it("simulare vale metà premio e niente gettone", () => {
    const s = fresh();
    const rng = seeded(9);
    const plan = planMatch(s, s.season.matches[0], "difficile", rng);
    const allIn: MomentResult[] = plan.moments.map((m) =>
      m.kind === "attacco"
        ? { kind: "tiro", shot: m.shot, outcome: "verde", made: true, pts: m.shot === "tripla" ? 3 : 2 }
        : { kind: "difesa", action: m.action, ok: true, perfect: true, fastBreak: false },
    );
    const score = { us: 21, them: 14 };
    const played = finishMatch(s, plan, allIn, score, "difficile", false, seeded(1));
    const sim = finishMatch(s, plan, allIn, score, "difficile", true, seeded(1));
    expect(played.money).toBe(LEVELS.campetto.win * DIFF.difficile.prize);
    expect(sim.money).toBe(played.money / 2);
    expect(played.result.rating).toBeGreaterThanOrEqual(8);
    const s0 = { ...s, tokens: 2 };
    const after = applyMatch(s0, 0, played, NOW, seeded(2));
    expect(after.tokens).toBe(3);
    const afterSim = applyMatch(s0, 0, sim, NOW, seeded(2));
    expect(afterSim.tokens).toBe(2);
    expect(afterSim.career.games).toBe(1);
  });

  it("tre errori di fila e il coach ti toglie", () => {
    const s = fresh();
    const plan = { ...planMatch(s, s.season.matches[0], "normale", seeded(4)), benchAfter: 3 };
    const miss: MomentResult = { kind: "tiro", shot: "media", outcome: "fuori", made: false, pts: 0 };
    const full = { ...plan, moments: [...plan.moments, ...plan.moments, ...plan.moments].slice(0, 6) };
    const names = rosters(s, "Tu", full.opponent, full.size);
    const rng = seeded(9);
    let st = startLive(full, rng);
    st = applyMoment(st, full, names, miss, rng);
    st = applyMoment(st, full, names, miss, rng);
    expect(st.benched).toBe(false);
    st = applyMoment(st, full, names, miss, rng);
    expect(st.benched).toBe(true);
    expect(st.feed.at(-1)?.text).toContain("panchina");
  });
});

describe("Giorni, soldi e carriera", () => {
  it("il giorno della partita non si salta; il lunedì arriva lo stipendio", () => {
    let s = fresh();
    const rng = seeded(5);
    s = advanceDay(s, { kind: "allenamento", skill: "tiro" }, rng).s; // martedì
    s = advanceDay(s, { kind: "riposo" }, rng).s; // mercoledì: partita
    expect(canAdvance(s)).toBe(false);
    expect(advanceDay(s, { kind: "riposo" }, rng).s.day).toBe(s.day);
    s = step(s, rng);
    while (s.day < 7) s = step(s, rng); // fino a domenica (sabato si gioca)
    const sunday = s.money;
    s = step(s, rng); // lunedì
    expect(s.day).toBe(8);
    expect(s.money).toBeGreaterThanOrEqual(sunday + weeklyNet(s.contract) - 200);
    expect(s.bank.some((b) => b.day === 8 && b.label.includes("Stipendio"))).toBe(true);
  });

  it("le tasse: Serie B 20%, Serie A 35%", () => {
    expect(weeklyNet({ team: "x", level: "campetto", salary: 100 })).toBe(100);
    expect(weeklyNet({ team: "x", level: "b", salary: 1000, sponsor: 500 })).toBe(1200);
    expect(weeklyNet({ team: "x", level: "a", salary: 10000 })).toBe(6500);
  });

  it("allenarsi alza le abilità", () => {
    let s = fresh();
    s = addXp(s, "tiro", 200);
    expect(s.skills.tiro).toBeGreaterThan(45);
    s = addXp({ ...s, skills: { ...s.skills, tiro: 99 } }, "tiro", 100);
    expect(s.skills.tiro).toBe(99);
  });

  it("una stagione intera: alla fine le offerte, poi una stagione nuova", () => {
    let s = playSeason(fresh());
    expect(s.season.matches.every((m) => m.result)).toBe(true);
    expect(s.offers.length).toBeGreaterThanOrEqual(2);
    expect(s.contacts.find((c) => c.role === "agente")!.thread.length).toBeGreaterThan(0);
    expect(canAdvance(s)).toBe(false);
    const offer = s.offers[0];
    s = acceptOffer(s, offer.id, seeded(1));
    expect(s.season.n).toBe(2);
    expect(s.offers).toHaveLength(0);
    expect((s.day - 1) % 7).toBe(0);
    expect(s.season.matches.every((m) => !m.result)).toBe(true);
  });

  it("chi gioca bene (o è famoso) riceve la promozione", () => {
    const s = fresh();
    const good: GameState = {
      ...s,
      fame: 25,
      season: {
        ...s.season,
        matches: s.season.matches.map((m) => ({
          ...m,
          result: { us: 21, them: 15, rating: 7.5, pts: 8, ast: 1, reb: 1, stl: 0, blk: 0, simulated: false, benched: false },
        })),
      },
    };
    const offers = makeOffers(good, seeded(2));
    expect(offers.some((o) => o.promotion && o.level === "b")).toBe(true);
    for (const o of offers.filter((x) => x.level === "b")) {
      expect(o.salary).toBeGreaterThanOrEqual(LEVELS.b.salary[0]);
      expect(o.salary).toBeLessThanOrEqual(LEVELS.b.salary[1]);
    }
    const bad = { ...good, fame: 0, season: { ...good.season, matches: good.season.matches.map((m) => ({ ...m, result: { ...m.result!, rating: 5 } })) } };
    expect(makeOffers(bad, seeded(2)).some((o) => o.promotion)).toBe(false);
  });
});

describe("Negozio e premi", () => {
  it("le prime scarpe con i soldi di mamma; il lusso solo più avanti", () => {
    let s = fresh();
    expect(canBuy(s, "scarpe-campetto").ok).toBe(true);
    s = buyItem(s, "scarpe-campetto", seeded(1));
    expect(s.money).toBe(20);
    expect(s.outfit.scarpe).toBe("scarpe-campetto");
    expect(canBuy(s, "scarpe-campetto").why).toBe("Già tuo");
    expect(canBuy({ ...s, money: 1e6 }, "catena-oro").why).toBe("Dalla Serie A");
    expect(canBuy(s, "corona").ok).toBe(false);
  });

  it("ogni oggetto ha uno slot e un look", () => {
    const ids = new Set<string>();
    for (const it of ITEMS) {
      expect(ids.has(it.id)).toBe(false);
      ids.add(it.id);
      expect(it.look.kind).toBeTruthy();
    }
  });

  it("premio giornaliero: 7 giorni di fila, se ne salti uno ricominci", () => {
    let s = fresh();
    let day = "2026-11-03";
    const labels: string[] = [];
    for (let i = 0; i < DAILY.length; i++) {
      const r = claimDaily(s, day)!;
      labels.push(r.label);
      s = r.s;
      expect(claimDaily(s, day)).toBeNull();
      const d = new Date(`${day}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      day = d.toISOString().slice(0, 10);
    }
    expect(labels[0]).toBe("+200 €");
    expect(labels[1]).toBe("Energia piena");
    expect(s.owned).toContain("occhiali-stella");
    // Saltato un giorno: si riparte dal primo.
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    expect(dailyStatus(s, d.toISOString().slice(0, 10)).step).toBe(1);
    expect(prevDay("2026-03-01")).toBe("2026-02-28");
    expect(romeDay(Date.parse("2026-11-03T23:30:00Z"))).toBe("2026-11-04");
  });

  it("gettoni: uno ogni 2 ore, massimo 5", () => {
    let s = { ...fresh(), tokens: 5 };
    s = spendToken(s, NOW)!;
    expect(s.tokens).toBe(4);
    expect(nextTokenIn(s, NOW)).toBe(TOKEN_MS);
    s = spendToken(spendToken(spendToken(spendToken(s, NOW)!, NOW)!, NOW)!, NOW)!;
    expect(s.tokens).toBe(0);
    expect(spendToken(s, NOW)).toBeNull();
    expect(refillTokens(s, NOW + TOKEN_MS * 3 + 5).tokens).toBe(3);
    expect(refillTokens(s, NOW + TOKEN_MS * 30).tokens).toBe(5);
  });

  it("le partite vere: soldi, energia piena e un messaggio dell'amico", () => {
    const s = { ...fresh(), energy: 20, tokens: 1 };
    const r = realMatchBonus(s, ["m1", "m2", "m3"], NOW, seeded(1));
    expect(r.count).toBe(2);
    expect(r.s.money).toBe(s.money + 1000);
    expect(r.s.energy).toBe(100);
    expect(r.s.tokens).toBe(3);
    expect(realMatchBonus(r.s, ["m2"], NOW, seeded(1)).count).toBe(0);
  });

  it("re del campetto: soldi per ogni classifica, la corona se le vinci tutte e tre", () => {
    const s = fresh();
    const one = applyAwards(s, [{ day: "2026-11-02", game: "triple", score: 25 }]);
    expect(one.money).toBe(s.money + 1000);
    expect(one.owned).not.toContain("corona");
    const all = applyAwards(s, (["triple", "liberi", "schiacciate"] as const).map((g) => ({ day: "2026-11-02", game: g, score: 1 })));
    expect(all.owned).toContain("corona");
  });
});

describe("Telefono", () => {
  it("rispondere cambia il rapporto e il carattere", () => {
    let s = fresh();
    const before = s.contacts.find((c) => c.id === "mamma")!.rel;
    s = answer(s, "mamma", 0);
    const m = s.contacts.find((c) => c.id === "mamma")!;
    expect(m.rel).toBeGreaterThan(before);
    expect(m.pending).toBeNull();
    expect(m.thread.at(-1)!.from).toBe("them");
    // Sempre sbruffone col socio: comincia a prenderti in giro.
    let st = s;
    for (let i = 0; i < 4; i++) {
      st = { ...st, day: st.day + 10 };
      st = deliver(st, "socio-campetto");
      const idx = 1; // sbruffone
      st = answer(st, "socio", idx);
    }
    expect(mood(st.contacts.find((c) => c.id === "socio")!)).toBe("ironico");
  });

  it("se la tratti male ti lascia, e dopo un po' arriva qualcun'altra", () => {
    let s = fresh();
    const rng = seeded(11);
    s = { ...s, fame: 15, contacts: s.contacts.map((c) => (c.role === "ragazza" ? { ...c, rel: -60 } : c)) };
    s = advanceDay(s, { kind: "riposo" }, rng).s;
    expect(girlfriend(s)).toBeUndefined();
    expect(s.contacts.find((c) => c.id === "giulia")!.role).toBe("ex");
    for (let i = 0; i < 12 && !s.contacts.some((c) => c.role === "nuova"); i++) s = step(s, rng);
    const nuova = s.contacts.find((c) => c.role === "nuova")!;
    expect(nuova).toBeTruthy();
    s = answer(s, nuova.id, 1);
    expect(girlfriend(s)!.id).toBe(nuova.id);
  });
});

describe("Sfide", () => {
  it("triple: il pallone colorato vale doppio, massimo 30", () => {
    let max = 0;
    for (let i = 0; i < 25; i++) max += tripleValue(i, true);
    expect(max).toBe(30);
  });
  it("liberi: il verde si stringe a ogni canestro", () => {
    const s = fresh();
    expect(liberiZone(s, 10)).toBeLessThan(liberiZone(s, 0));
    expect(liberiZone(s, 500)).toBeGreaterThan(0);
  });
  it("schiacciate: da 30 a 50, mai oltre il massimo", () => {
    const rng = seeded(3);
    for (const d of DUNKS) {
      expect(dunkScore([1, 1, 1], d, rng).total).toBe(d.max);
      expect(dunkScore([1, 1, 0], d, rng).total).toBe(30);
      for (let i = 0; i < 30; i++) {
        const t = dunkScore([rng(), rng(), 0.2 + rng() * 0.8], d, rng).total;
        expect(t).toBeGreaterThanOrEqual(30);
        expect(t).toBeLessThanOrEqual(d.max);
      }
    }
  });
});
