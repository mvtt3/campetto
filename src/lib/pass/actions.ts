import {
  ITEMS,
  ITEM_BY_ID,
  MAX_BOOSTS,
  PASS_LEVELS,
  PRICE,
  RARITIES,
  duplicateRefund,
  type Item,
  type Rarity,
  type Slot,
} from "./catalog";
import { seeded } from "./engine";
import { todayKey, updatePass } from "./store";
import { PASS_FOR_ALL, PASS_PREVIEW_FOR_ADMIN } from "./flags";

export { PASS_FOR_ALL, PASS_PREVIEW_FOR_ADMIN };

export const passAllowed = (me: { isAdmin: boolean } | null | undefined) =>
  PASS_FOR_ALL || (PASS_PREVIEW_FOR_ADMIN && !!me?.isAdmin);

/** Cosa si può vincere a sorpresa: niente personaggi né esclusivi del pass. */
const POOL = ITEMS.filter((i) => i.slot !== "skin" && !i.esclusivo);

function pickRarity(odds: Record<Rarity, number>, r: () => number): Rarity {
  let x = r() * 100;
  for (const k of RARITIES) {
    x -= odds[k];
    if (x < 0) return k;
  }
  return "comune";
}

/**
 * Un oggetto a sorpresa: prima la rarità con le probabilità scritte, poi un oggetto che non
 * hai. Se di quella rarità li hai tutti, il doppione diventa Spicchi (metà prezzo).
 */
export function surprise(
  odds: Record<Rarity, number>,
  owned: Set<string>,
  seed: string,
): { item: Item; duplicate: boolean } {
  const r = seeded(seed);
  const rarity = pickRarity(odds, r);
  const same = POOL.filter((i) => i.rarity === rarity);
  const fresh = same.filter((i) => !owned.has(i.id));
  const list = fresh.length ? fresh : same.length ? same : POOL;
  const item = list[Math.floor(r() * list.length)];
  return { item, duplicate: !fresh.length };
}

/** Riscatta un livello. Ritorna cosa è successo, per l'animazione. */
export function claimLevel(
  playerId: string,
  level: number,
  boostsNow: number,
): "ok" | "boost-full" {
  const lv = PASS_LEVELS[level - 1];
  if (lv.reward.kind === "boost" && boostsNow >= MAX_BOOSTS) return "boost-full";
  updatePass(playerId, (s) => ({
    ...s,
    claimed: [...new Set([...s.claimed, level])],
    boosts: lv.reward.kind === "boost" ? s.boosts + 1 : s.boosts,
    pendingBoost: s.pendingBoost.filter((n) => n !== level),
  }));
  return "ok";
}

/** Il boost non entra: lo lasci lì (si riscatta quando liberi un posto). */
export function keepBoostForLater(playerId: string, level: number) {
  updatePass(playerId, (s) => ({ ...s, pendingBoost: [...new Set([...s.pendingBoost, level])] }));
}

/** Scambi il boost che non entra con un oggetto a sorpresa. */
export function swapBoost(
  playerId: string,
  level: number,
  odds: Record<Rarity, number>,
  owned: Set<string>,
) {
  const res = surprise(odds, owned, `${playerId}:swap:${level}`);
  updatePass(playerId, (s) => ({
    ...s,
    claimed: [...new Set([...s.claimed, level])],
    pendingBoost: s.pendingBoost.filter((n) => n !== level),
    owned: res.duplicate ? s.owned : [...new Set([...s.owned, res.item.id])],
    bonus: res.duplicate ? s.bonus + duplicateRefund(res.item.rarity) : s.bonus,
  }));
  return res;
}

/** Accendi un boost: raddoppia i punti della prossima giornata che giochi. */
export function activateBoost(playerId: string) {
  updatePass(playerId, (s) =>
    s.boosts > 0
      ? { ...s, boosts: s.boosts - 1, boostActivations: [...s.boostActivations, new Date().toISOString()] }
      : s,
  );
}

export function equip(playerId: string, slot: Slot, id: string | null) {
  updatePass(playerId, (s) => {
    const outfit = { ...s.outfit };
    if (id) outfit[slot] = id;
    else delete outfit[slot];
    return { ...s, outfit };
  });
}

/** La bancarella del giorno: 4 oggetti, prima quelli che non hai. Si fissa per tutto il giorno. */
export function stallOf(playerId: string, owned: Set<string>, day = todayKey()): string[] {
  const r = seeded(`${playerId}:bancarella:${day}`);
  const pool = POOL.map((i) => ({ i, k: r() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.i);
  const fresh = pool.filter((i) => !owned.has(i.id));
  return [...fresh, ...pool.filter((i) => owned.has(i.id))].slice(0, 4).map((i) => i.id);
}

/** La bancarella di oggi (la fissa la prima volta che la apri). */
export function ensureStall(playerId: string, ids: string[], day = todayKey()) {
  updatePass(playerId, (s) => (s.stall?.day === day ? s : { ...s, stall: { day, ids } }));
}

export function buy(playerId: string, id: string, balance: number): boolean {
  const it = ITEM_BY_ID.get(id);
  if (!it || balance < PRICE[it.rarity]) return false;
  updatePass(playerId, (s) => ({
    ...s,
    spent: s.spent + PRICE[it.rarity],
    owned: [...new Set([...s.owned, id])],
  }));
  return true;
}

/** Il premio del tiro del giorno, deciso dai canestri fatti. */
export function shotPrize(
  playerId: string,
  made: number,
  odds: Record<Rarity, number>,
  owned: Set<string>,
) {
  const day = todayKey();
  const res = surprise(odds, owned, `${playerId}:tiro:${day}:${made}`);
  const coins = made * 2;
  updatePass(playerId, (s) => ({
    ...s,
    shot: { day, made, prize: res.item.id },
    owned: res.duplicate ? s.owned : [...new Set([...s.owned, res.item.id])],
    bonus: s.bonus + coins + (res.duplicate ? duplicateRefund(res.item.rarity) : 0),
  }));
  return { ...res, coins };
}

export function markLockerSeen(playerId: string, day: string) {
  updatePass(playerId, (s) => (s.lockerSeen.includes(day) ? s : { ...s, lockerSeen: [...s.lockerSeen, day] }));
}
