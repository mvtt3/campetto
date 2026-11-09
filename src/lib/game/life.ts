import type { GameState, Post, PostKind, PostTone } from "./types";
import { LEVELS, clamp, dow, pick, seeded, type Rng } from "./economy";
import { moveClub, moveMates } from "./career";

/**
 * La vita fuori dal campo, sul telefono: i Motori (bici, scooter, auto, anche a rate),
 * la Mappa della città (dove vai cambia cosa succede, e il mezzo che hai cambia quanto
 * costa arrivarci) e Instacampo (pubblichi, ti seguono, arrivano gli sponsor).
 */

// ———————————— Motori ————————————

export interface Vehicle {
  id: string;
  name: string;
  emoji: string;
  price: number;
  /** Quanto costa muoversi in città rispetto ad andare a piedi o in bus (1). */
  travel: number;
  /** Fama la prima volta che lo compri. */
  fame: number;
  /** Assicurazione e benzina, a settimana. */
  weekly: number;
  /** Arrivi puntuale: il coach lo nota agli allenamenti. */
  punctual: boolean;
  line: string;
}

export const VEHICLES: Vehicle[] = [
  { id: "bici", name: "Bici da città", emoji: "🚲", price: 120, travel: 0.8, fame: 0, weekly: 0, punctual: false, line: "Fa bene alle gambe, piove sempre quando serve" },
  { id: "monopattino", name: "Monopattino elettrico", emoji: "🛴", price: 390, travel: 0.6, fame: 1, weekly: 3, punctual: false, line: "Silenzioso, veloce, un po' da fighetto" },
  { id: "scooter", name: "Scooter 125", emoji: "🛵", price: 1900, travel: 0.4, fame: 3, weekly: 14, punctual: true, line: "In città non lo batte nessuno" },
  { id: "utilitaria", name: "Utilitaria usata", emoji: "🚗", price: 5400, travel: 0.3, fame: 4, weekly: 28, punctual: true, line: "Ci stanno tre compagni e il borsone" },
  { id: "suv", name: "SUV da campione", emoji: "🚙", price: 39000, travel: 0.25, fame: 10, weekly: 120, punctual: true, line: "Si nota da lontano, anche al parcheggio" },
  { id: "cabrio", name: "Cabrio rossa", emoji: "🏎️", price: 98000, travel: 0.2, fame: 18, weekly: 320, punctual: true, line: "Quando arrivi, si girano tutti" },
];
export const VEHICLE_BY_ID = new Map(VEHICLES.map((v) => [v.id, v]));

/** A rate: il 20% subito, il resto (più il 10%) in 10 settimane. */
export const LOAN_WEEKS = 10;
export function loanPlan(v: Vehicle) {
  const down = Math.round(v.price * 0.2);
  const total = Math.round((v.price - down) * 1.1);
  return { down, weekly: Math.ceil(total / LOAN_WEEKS), total };
}

export const ride = (s: Pick<GameState, "ride">) => (s.ride ? VEHICLE_BY_ID.get(s.ride) ?? null : null);

export function buyVehicle(s: GameState, id: string, financed: boolean): { s: GameState; note: string } | null {
  const v = VEHICLE_BY_ID.get(id);
  if (!v || s.garage.includes(id)) return null;
  const plan = loanPlan(v);
  const pay = financed ? plan.down : v.price;
  if (s.money < pay) return null;
  if (financed && s.loans.some((l) => l.id === id)) return null;
  let st: GameState = {
    ...s,
    money: s.money - pay,
    garage: [...s.garage, id],
    ride: id,
    fame: clamp(s.fame + v.fame, 0, 100),
    bank: [...s.bank, { day: s.day, label: `${v.name}${financed ? " · anticipo" : ""}`, amount: -pay }].slice(-60),
  };
  if (financed) st = { ...st, loans: [...st.loans, { id, label: `Rata ${v.name}`, weekly: plan.weekly, weeksLeft: LOAN_WEEKS }] };
  return { s: st, note: v.fame ? `${v.emoji} ${v.name}! +${v.fame} fama` : `${v.emoji} ${v.name}: da oggi ti muovi meglio` };
}

/** Rivendi: il 60% del prezzo, meno quello che manca da pagare se era a rate. */
export function sellVehicle(s: GameState, id: string): GameState {
  const v = VEHICLE_BY_ID.get(id);
  if (!v || !s.garage.includes(id)) return s;
  const loan = s.loans.find((l) => l.id === id);
  const back = Math.max(0, Math.round(v.price * 0.6) - (loan ? loan.weekly * loan.weeksLeft : 0));
  return {
    ...s,
    money: s.money + back,
    garage: s.garage.filter((x) => x !== id),
    ride: s.ride === id ? (s.garage.find((x) => x !== id) ?? null) : s.ride,
    loans: s.loans.filter((l) => l.id !== id),
    bank: [...s.bank, { day: s.day, label: `Venduto: ${v.name}`, amount: back }].slice(-60),
  };
}

/**
 * Il lunedì: rate e spese dei mezzi. Se non hai i soldi per una rata, il mezzo se lo
 * riprendono (e lo sanno tutti).
 */
export function weeklyLife(s: GameState): { s: GameState; notes: string[] } {
  if (dow(s.day) !== 0 || s.day <= 1) return { s, notes: [] };
  let st = s;
  const notes: string[] = [];
  const upkeep = st.garage.reduce((a, id) => a + (VEHICLE_BY_ID.get(id)?.weekly ?? 0), 0);
  if (upkeep) {
    const v = Math.min(upkeep, st.money);
    st = { ...st, money: st.money - v, bank: [...st.bank, { day: st.day, label: "Benzina e assicurazione", amount: -v }].slice(-60) };
  }
  for (const loan of st.loans) {
    if (st.money >= loan.weekly) {
      st = {
        ...st,
        money: st.money - loan.weekly,
        bank: [...st.bank, { day: st.day, label: loan.label, amount: -loan.weekly }].slice(-60),
        loans: st.loans.map((l) => (l.id === loan.id ? { ...l, weeksLeft: l.weeksLeft - 1 } : l)).filter((l) => l.weeksLeft > 0),
      };
    } else {
      const v = VEHICLE_BY_ID.get(loan.id);
      st = {
        ...st,
        garage: st.garage.filter((x) => x !== loan.id),
        ride: st.ride === loan.id ? null : st.ride,
        loans: st.loans.filter((l) => l.id !== loan.id),
        fame: clamp(st.fame - 3, 0, 100),
        happiness: clamp(st.happiness - 8, 0, 100),
      };
      notes.push(`Rata non pagata: si sono ripresi ${v ? v.name.toLowerCase() : "il mezzo"}`);
    }
  }
  return { s: st, notes };
}

// ———————————— Mappa ————————————

export type PlaceId = "casa" | "campetto" | "palestra" | "palazzetto" | "parco" | "pizzeria" | "discoteca" | "centro" | "lei";

export interface Place {
  id: PlaceId;
  name: string;
  emoji: string;
  /** Posizione sulla mappa (0–100). */
  x: number;
  y: number;
  /** Distanza da casa: 0 vicino, 3 lontano. */
  dist: number;
  line: string;
}

export const PLACES: Place[] = [
  { id: "casa", name: "Casa", emoji: "🏠", x: 22, y: 64, dist: 0, line: "Divano, frigo, letto" },
  { id: "campetto", name: "Campetto del parco", emoji: "🏀", x: 38, y: 36, dist: 1, line: "Partitelle con chi c'è" },
  { id: "parco", name: "Parco Boschetto", emoji: "🌳", x: 52, y: 58, dist: 1, line: "Corsa e scatti, gratis" },
  { id: "palestra", name: "Palestra", emoji: "🏋️", x: 70, y: 28, dist: 2, line: "Allenamento con la squadra" },
  { id: "palazzetto", name: "Palazzetto", emoji: "🏟️", x: 80, y: 62, dist: 3, line: "Dove si gioca il campionato" },
  { id: "pizzeria", name: "Pizzeria da Gino", emoji: "🍕", x: 40, y: 82, dist: 1, line: "Il posto della squadra" },
  { id: "discoteca", name: "Discoteca Ferro", emoji: "🪩", x: 86, y: 14, dist: 3, line: "Musica fino all'alba" },
  { id: "centro", name: "Centro commerciale", emoji: "🛍️", x: 18, y: 18, dist: 2, line: "Vestiti, scarpe, tutto" },
  { id: "lei", name: "Da lei", emoji: "❤️", x: 64, y: 86, dist: 2, line: "Ti aspetta" },
];
export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/** Quanto costa arrivare: energia e minuti, meno se hai un mezzo. */
export function travel(s: Pick<GameState, "ride">, p: Place): { energy: number; minutes: number } {
  const f = ride(s)?.travel ?? 1;
  return { energy: Math.round(p.dist * 5 * f), minutes: Math.round(p.dist * 15 * (0.4 + f * 0.6)) };
}

export interface MapEvent {
  id: "torneo" | "scout" | "dj" | "cena" | "fotografo";
  place: PlaceId;
  title: string;
  line: string;
}

const MAP_EVENTS: MapEvent[] = [
  { id: "torneo", place: "parco", title: "Torneo 3 contro 3", line: "Premio in soldi e un po' di fama a chi vince" },
  { id: "scout", place: "campetto", title: "Un osservatore al campetto", line: "Gioca oggi e ti notano: le squadre ti seguono di più" },
  { id: "dj", place: "discoteca", title: "Serata col DJ famoso", line: "Più fama, ma domani sei a pezzi" },
  { id: "cena", place: "pizzeria", title: "Cena di squadra", line: "Ci sono tutti: il morale sale il doppio" },
  { id: "fotografo", place: "campetto", title: "Fotografo al campetto", line: "Il post di domani fa il doppio dei like" },
];

/** L'evento del giorno sulla mappa (non tutti i giorni). Mai il giorno della partita. */
export function mapEvent(s: Pick<GameState, "day" | "createdAt" | "season">): MapEvent | null {
  if (s.season.matches.some((m) => m.day === s.day && !m.result)) return null;
  const r = seeded(`${s.createdAt}:evento:${s.day}`);
  if (r() > 0.6) return null;
  return pick(r, MAP_EVENTS);
}

// ———————————— Instacampo ————————————

export interface PostIdea {
  kind: PostKind;
  emoji: string;
  title: string;
  captions: Record<PostTone, string>;
  /** Quanto piace, da 0,5 a 2. */
  quality: number;
}

const TONE_NAME: Record<PostTone, string> = { umile: "Umile", spaccone: "Spaccone", dedica: "Dedica" };
export const toneName = (t: PostTone) => TONE_NAME[t];

/** Cosa puoi pubblicare oggi: l'ultima partita, quello che hai fatto ieri, il look, il mezzo. */
export function postIdeas(s: GameState): PostIdea[] {
  const ideas: PostIdea[] = [];
  const last = [...s.season.matches].reverse().find((m) => m.result && m.day >= s.day - 1);
  if (last?.result) {
    const won = last.result.us > last.result.them;
    ideas.push({
      kind: "partita",
      emoji: won ? "🏆" : "😤",
      title: won ? `Vittoria ${last.result.us}–${last.result.them}` : `Sconfitta ${last.result.us}–${last.result.them}`,
      quality: won ? 1.5 + (last.result.rating >= 8 ? 0.4 : 0) : 0.7,
      captions: won
        ? {
            umile: "Vittoria di squadra. Testa alla prossima 🏀",
            spaccone: `${last.result.pts} punti e tutti a casa. Chi è il prossimo? 😎`,
            dedica: "Questa è per i miei compagni. Siete pazzeschi 🤝",
          }
        : {
            umile: "Oggi non è andata. Si lavora e si torna più forti",
            spaccone: "Arbitro comprato, campo storto. Noi i più forti comunque",
            dedica: "A chi c'era sugli spalti anche oggi: grazie ❤️",
          },
    });
  }
  const y = s.yesterday;
  if (y === "allenamento" || y === "parco" || y === "campetto")
    ideas.push({
      kind: "allenamento",
      emoji: "💪",
      title: "Il sudore di ieri",
      quality: 1,
      captions: { umile: "Un giorno alla volta 💪", spaccone: "Mentre voi dormivate io mi allenavo", dedica: "Grazie coach, mi hai distrutto 😅" },
    });
  if (y === "serata")
    ideas.push({
      kind: "serata",
      emoji: "🪩",
      title: "La serata di ieri",
      quality: 1.3,
      captions: { umile: "Ogni tanto ci vuole", spaccone: "I re della notte 👑", dedica: "Con la mia gente, sempre" },
    });
  if (y === "ragazza")
    ideas.push({
      kind: "ragazza",
      emoji: "❤️",
      title: "Una foto in due",
      quality: 1.2,
      captions: { umile: "Le cose belle 🌙", spaccone: "Vinciamo anche fuori dal campo 😏", dedica: "Grazie di esserci, sempre ❤️" },
    });
  if (y === "amici" || y === "squadra")
    ideas.push({
      kind: "squadra",
      emoji: "🍕",
      title: "Pizza con la banda",
      quality: 1.1,
      captions: { umile: "Pizza e risate, ricarica fatta", spaccone: "La squadra più bella della città, e lo sappiamo", dedica: "Fratelli prima che compagni 🤝" },
    });
  const r = ride(s);
  if (r && s.social.posts.every((p) => p.kind !== "motori" || !p.caption.includes(r.name)))
    ideas.push({
      kind: "motori",
      emoji: r.emoji,
      title: `${r.name} nuova`,
      quality: 1 + r.fame / 10,
      captions: { umile: `Piccolo regalo: ${r.name.toLowerCase()} ${r.emoji}`, spaccone: `Guardate cosa guido adesso: ${r.name} ${r.emoji}`, dedica: `Mamma, questo è per te ${r.emoji}` },
    });
  ideas.push({
    kind: "look",
    emoji: "🧢",
    title: s.owned.length ? "Il look di oggi" : "Selfie al campetto",
    quality: 0.8 + Math.min(0.6, s.owned.length * 0.08),
    captions: { umile: "Pronto per il campetto", spaccone: "Il più stiloso del quartiere, ovvio", dedica: "Look approvato da mamma" },
  });
  return ideas;
}

export const postedToday = (s: GameState) => s.social.posts.some((p) => p.day === s.day);

const FANS = ["@tifosa_99", "@nichelino_hoops", "@zio_del_campetto", "@canestro_facile", "@la_curva_sud", "@basket_e_pizza", "@spicchio_fan"];
const HATERS = ["@haterz_torino", "@divano_coach", "@mattone_alert", "@sempre_critico"];

const GOOD = ["Fenomeno 🔥", "Che giocatore!", "Il futuro è tuo", "Lo sapevo io 👏", "Mi hai fatto vincere la scommessa con mio cugino", "Idolo"];
const BAD = ["Meno post e più tiri liberi", "Pensa a giocare", "Ma chi ti credi di essere?", "Ieri non pervenuto"];

/** Le soglie degli sponsor, in follower, e quanto pagano a settimana (al Campetto: poi si moltiplica). */
export const SPONSORS = [
  { at: 500, name: "Pasta Spicchio", weekly: 10 },
  { at: 2000, name: "Spicchio Cola", weekly: 30 },
  { at: 10000, name: "Scarpe Volo", weekly: 90 },
  { at: 50000, name: "Orologi Tic", weekly: 260 },
] as const;

/**
 * Pubblichi: i like dipendono da quanti ti seguono, dalla tua fama e da cosa posti; il
 * tono ha conseguenze (lo spaccone dopo una sconfitta fa arrabbiare tutti).
 */
export function publish(s: GameState, idea: PostIdea, tone: PostTone, rng: Rng, mamma = "Mamma"): { s: GameState; post: Post; note: string | null } {
  const lost = idea.kind === "partita" && idea.quality < 1;
  let q = idea.quality;
  if (tone === "spaccone") q *= lost ? 0.55 : 1.15;
  if (tone === "dedica") q *= 1.08;
  if (s.yesterday === "campetto" && s.once.includes(`fotografo-${s.day - 1}`)) q *= 2;
  const reach = 30 + s.social.followers * 0.22 + s.fame * 22;
  const likes = Math.max(1, Math.round(reach * q * (0.8 + rng() * 0.4)));
  const haters = lost && tone === "spaccone" ? 3 : tone === "spaccone" ? 1 : lost ? 1 : 0;
  const gained = Math.round(likes * 0.16 * (q >= 1 ? 1.2 : 0.6)) - (haters >= 3 ? Math.round(s.social.followers * 0.03) : 0);
  const comments: Post["comments"] = [];
  for (let i = 0; i < 3; i++) {
    const hater = i < haters;
    comments.push({ who: pick(rng, hater ? HATERS : FANS), text: pick(rng, hater ? BAD : GOOD), hater });
  }
  if (idea.kind === "partita" || tone === "dedica") comments[2] = { who: mamma, text: "Bravo amore mio ❤️ Hai mangiato?" };
  const post: Post = { id: `p${s.day}-${s.social.posts.length}`, day: s.day, kind: idea.kind, tone, caption: idea.captions[tone], likes, gained, comments };
  const followers = Math.max(0, s.social.followers + gained);
  let st: GameState = { ...s, social: { ...s.social, followers, posts: [post, ...s.social.posts].slice(0, 40) } };
  // Le conseguenze del tono.
  if (tone === "spaccone") {
    st = moveClub(st, lost ? -4 : -1);
    if (lost) st = moveMates(st, -3);
  }
  if (tone === "umile") st = moveClub(st, 1);
  if (tone === "dedica" && (idea.kind === "partita" || idea.kind === "squadra")) st = moveMates(st, 3);
  if (idea.kind === "serata" && tone === "spaccone") st = moveClub(st, -2);
  if (likes >= 400) st = { ...st, fame: clamp(st.fame + 1, 0, 100) };
  // Gli sponsor arrivano coi follower.
  let note: string | null = null;
  const next = SPONSORS[st.social.sponsor];
  if (next && followers >= next.at) {
    const weekly = Math.round(next.weekly * LEVELS[st.contract.level].mult);
    st = {
      ...st,
      social: { ...st.social, sponsor: st.social.sponsor + 1 },
      contract: { ...st.contract, sponsor: (st.contract.sponsor ?? 0) + weekly },
    };
    note = `Nuovo sponsor: ${next.name}, +${weekly} € a settimana`;
  }
  return { s: st, post, note };
}

/** I post degli altri nel feed: compagni, avversari, il campetto. Sempre gli stessi per il giorno. */
export function othersFeed(s: GameState, mates: string[]): { who: string; text: string; likes: number; emoji: string }[] {
  const r = seeded(`${s.createdAt}:feed:${s.day}`);
  const lines = [
    { emoji: "🏀", text: "Allenamento alle 7. Chi c'è?" },
    { emoji: "🍕", text: "Pizza dopo la partita, offre chi perde" },
    { emoji: "💪", text: "Giorno di gambe. Non parlatemi" },
    { emoji: "🔥", text: "Sabato si vince. Punto" },
    { emoji: "👟", text: "Scarpe nuove, salto più alto (forse)" },
    { emoji: "📸", text: "Tramonto al campetto, il posto più bello" },
  ];
  const who = [...mates].sort(() => r() - 0.5);
  const said = [...lines].sort(() => r() - 0.5);
  return Array.from({ length: Math.min(3, who.length) }, (_, k) => ({
    who: `@${who[k].toLowerCase().replace(/[^a-z]/g, "")}_${Math.floor(r() * 90 + 10)}`,
    text: said[k].text,
    emoji: said[k].emoji,
    likes: Math.floor(20 + r() * 300),
  }));
}
