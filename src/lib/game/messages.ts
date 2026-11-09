import type { Contact, GameState, Role, Skill, Tone } from "./types";
import { LEVELS, addXp, clamp, fmtEuro, pick, type Rng } from "./economy";

/**
 * I messaggi del telefono: chat a risposte scelte (gratis, niente intelligenza
 * artificiale a pagamento). Ogni risposta ha un tono (dolce, sbruffone, sincero,
 * freddo) e cambia il rapporto con quella persona. A forza di risposte cambia
 * anche il suo carattere: diventa affettuosa, fredda o ti prende in giro.
 */

export type Mood = "affettuoso" | "normale" | "freddo" | "ironico";

export interface Ctx {
  s: GameState;
  c: Contact;
  data: Record<string, string | number>;
}

type Text = string | ((x: Ctx) => string);
export type Variants = Text | ({ normale: Text } & Partial<Record<Mood, Text>>);

export interface Fx {
  rel?: number;
  coach?: number;
  happiness?: number;
  energy?: number;
  fame?: number;
  /** Euro al livello Campetto: crescono col livello. */
  money?: number;
  label?: string;
  xp?: Partial<Record<Skill, number>>;
  tonight?: "serata";
  breakup?: boolean;
  reconcile?: boolean;
  girlfriend?: boolean;
  /** Sponsor in euro a settimana (già al livello giusto). */
  sponsor?: number;
}

export interface Choice {
  tone: Tone;
  text: Text;
  reply: Variants | ((x: Ctx) => string | null) | null;
  fx?: Fx | ((x: Ctx) => Fx);
}

export interface ChatEvent {
  role: Role;
  text: Variants[];
  choices: Choice[];
  onSend?: Fx;
  /** Se non rispondi entro `days` giorni. */
  ignore?: { days: number; fx: Fx; text?: Variants };
}

export const TONES: Record<Tone, { label: string; emoji: string }> = {
  dolce: { label: "Dolce", emoji: "🥰" },
  sbruffone: { label: "Sbruffone", emoji: "😎" },
  sincero: { label: "Sincero", emoji: "🙂" },
  freddo: { label: "Freddo", emoji: "🧊" },
};

export const MOOD_LABEL: Record<Mood, string> = {
  affettuoso: "Affettuoso",
  normale: "Tranquillo",
  freddo: "Freddo",
  ironico: "Ti prende in giro",
};

export function mood(c: Contact): Mood {
  if (c.rel <= -25) return "freddo";
  const sb = c.tones.sbruffone ?? 0;
  const tot = Object.values(c.tones).reduce((a, b) => a + (b ?? 0), 0);
  if (sb >= 3 && sb * 2 >= tot) return "ironico";
  if (c.rel >= 40) return "affettuoso";
  return "normale";
}

function render(v: Variants | ((x: Ctx) => string | null), x: Ctx): string | null {
  if (typeof v === "function") return v(x);
  if (typeof v === "string") return v;
  const t = v[mood(x.c)] ?? v.normale;
  return typeof t === "function" ? t(x) : t;
}

const lvName = (x: Ctx) => LEVELS[x.s.contract.level].name;
const euro = (x: Ctx, base: number) => fmtEuro(base * LEVELS[x.s.contract.level].mult);

const SERATA: Fx = {
  rel: 8,
  happiness: 10,
  energy: -20,
  fame: 2,
  money: -40,
  label: "Serata al Sottosopra",
  tonight: "serata",
};

export const EVENTS: Record<string, ChatEvent> = {
  "mamma-scarpe": {
    role: "mamma",
    text: [
      "Amore, quelle scarpe sono bucate da due anni 😩",
      "Ti ho fatto un bonifico di 100 €. Comprati delle scarpe nuove, mi raccomando!",
    ],
    onSend: { money: 100, label: "Bonifico da Mamma" },
    choices: [
      { tone: "dolce", text: "Grazie ma', sei la migliore ❤️", reply: "Fai il bravo. E mangia!", fx: { rel: 8, happiness: 3 } },
      { tone: "sincero", text: "Grazie, mi servivano davvero", reply: "Lo so, ti conosco 😄", fx: { rel: 5 } },
      { tone: "sbruffone", text: "Tra un anno te le compro io, le scarpe. D'oro.", reply: "Intanto compra le tue 😂", fx: { rel: 2 } },
      { tone: "freddo", text: "Ok", reply: "…prego, eh.", fx: { rel: -5 } },
    ],
  },
  "coach-benvenuto": {
    role: "coach",
    text: [
      "Sono il coach Ferretti. Mercoledì c'è la prima partita.",
      "Ti voglio in palestra, non al bar.",
    ],
    choices: [
      { tone: "sincero", text: "Ci sarò, coach.", reply: "Bene. Puntuale.", fx: { rel: 5 } },
      { tone: "dolce", text: "Grazie per l'occasione, coach!", reply: "Ringraziami facendo canestro.", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Coach, palla a me e si siede tranquillo.", reply: "Vediamo mercoledì, fenomeno.", fx: { rel: -3, fame: 1 } },
      { tone: "freddo", text: "👍", reply: "Un pollice. Bene. Ci vediamo in campo.", fx: { rel: -2 } },
    ],
  },
  "ragazza-ciao": {
    role: "ragazza",
    text: [
      {
        normale: "Allora stasera ci vediamo o hai di nuovo il campetto? 🙄",
        affettuoso: "Stasera ci vediamo? Mi manchi 🥺",
        freddo: "Immagino che stasera tu abbia di nuovo il campetto.",
        ironico: "Ciao star. Stasera hai tempo per i comuni mortali?",
      },
    ],
    choices: [
      { tone: "dolce", text: "Stasera sono tutto tuo ❤️", reply: "Era ora 😍", fx: { rel: 10, happiness: 5 } },
      { tone: "sincero", text: "Ho allenamento, ma domani sì, promesso", reply: "Ok… ma domani è domani 😒", fx: { rel: 2 } },
      { tone: "sbruffone", text: "Le stelle si allenano, amore 😎", reply: "La stella stasera dorme sul divano", fx: { rel: -6 } },
      { tone: "freddo", text: "Vediamo", reply: "Vediamo cosa? 😑", fx: { rel: -10 } },
    ],
    ignore: { days: 2, fx: { rel: -8 }, text: "Ok, ho capito. Ciao." },
  },
  "amico-serata": {
    role: "amico",
    text: [
      {
        normale: "Stasera serata al Sottosopra, c'è mezzo mondo 🍾 Vieni?",
        affettuoso: "Fratellooo stasera Sottosopra, tavolo già preso. Ci sei vero?",
        freddo: "Stasera esco. Se vuoi venire, vieni.",
        ironico: "Stasera Sottosopra. Vieni o devi fare il professionista? 😂",
      },
    ],
    choices: [
      { tone: "sbruffone", text: "Arrivo. Preparate il tavolo 😎", reply: "Questo è il mio uomo 🍾", fx: SERATA },
      { tone: "dolce", text: "Stasera no, ma la prossima offro io!", reply: "Segnato. Offri tu 😏", fx: { rel: 2 } },
      { tone: "sincero", text: "Sono a pezzi, passo. Divertitevi!", reply: "Ok, riposati campione", fx: {} },
      { tone: "freddo", text: "No.", reply: "Che noia che sei", fx: { rel: -6 } },
    ],
  },
  "coach-serata": {
    role: "coach",
    text: [
      "Mi dicono che ieri sera eri in giro fino alle tre.",
      "Oggi si gioca. Vediamo come stai.",
    ],
    choices: [
      { tone: "sincero", text: "Ha ragione, coach. Non succederà più.", reply: "Lo spero.", fx: { rel: 2 } },
      { tone: "dolce", text: "Ero a letto alle undici, giuro 😇", reply: "Certo. Come no.", fx: { rel: -4 } },
      { tone: "sbruffone", text: "Gioco meglio da stanco, coach.", reply: "Lo spero per te.", fx: { rel: -8 } },
      { tone: "freddo", text: "Sono affari miei.", reply: "In panchina sono affari miei.", fx: { rel: -15 } },
    ],
  },
  "coach-extra": {
    role: "coach",
    text: [
      {
        normale: "Domani allenamento extra alle 7. Ci sei?",
        affettuoso: "Domani alle 7 lavoriamo solo io e te. Ci tengo.",
        freddo: "Domani alle 7 allenamento extra. Ti conviene esserci.",
        ironico: "Domani alle 7, fenomeno. O le star dormono fino a tardi?",
      },
    ],
    choices: [
      { tone: "sincero", text: "Ci sono.", reply: "Bravo.", fx: { rel: 5, energy: -10, xp: { fisico: 6 } } },
      { tone: "dolce", text: "Certo coach, anche alle 6!", reply: "Non esagerare. Alle 7.", fx: { rel: 7, energy: -10, xp: { fisico: 6 } } },
      { tone: "sbruffone", text: "Alle 7 dormo, coach.", reply: "Anche in partita, mi pare.", fx: { rel: -6 } },
      { tone: "freddo", text: "No.", reply: "Me lo segno.", fx: { rel: -8 } },
    ],
  },
  "coach-panchina": {
    role: "coach",
    text: [
      {
        normale: "Oggi ti ho tolto perché non eri in partita.",
        freddo: "Oggi ti ho tolto. Sai benissimo perché.",
        affettuoso: "Oggi ti ho tolto, ma so che sai fare di meglio.",
      },
      "Allenati e torna a giocare come sai.",
    ],
    choices: [
      { tone: "sincero", text: "Ha ragione, lavorerò.", reply: "Così mi piaci.", fx: { rel: 6 } },
      { tone: "dolce", text: "Grazie per la fiducia, coach. Rimedio.", reply: "Ci conto.", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Mi ha tolto perché ha paura di me.", reply: "Ho paura dei tuoi tiri, sì.", fx: { rel: -10 } },
      { tone: "freddo", text: "Ok.", reply: "Ok.", fx: { rel: -3 } },
    ],
  },
  "coach-bravo": {
    role: "coach",
    text: [
      {
        normale: "Così si gioca. Continua così.",
        affettuoso: "Partita enorme. Sono fiero di te.",
        freddo: "Bene. Finalmente.",
        ironico: "Bene, fenomeno. Non montarti la testa.",
      },
    ],
    choices: [
      { tone: "dolce", text: "Grazie coach, merito della squadra!", reply: "Bravo anche a dirlo.", fx: { rel: 6 } },
      { tone: "sincero", text: "Mi sentivo bene oggi.", reply: "Si è visto.", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Ve l'avevo detto 😎", reply: "Ripetiti mercoledì, poi parliamo.", fx: { rel: -2, fame: 1 } },
      { tone: "freddo", text: "👍", reply: "👍", fx: {} },
    ],
  },
  "mamma-mangiato": {
    role: "mamma",
    text: [
      {
        normale: "Hai mangiato? Ti vedo sciupato",
        affettuoso: "Amore hai mangiato? Ti ho messo da parte le lasagne ❤️",
        freddo: "Non chiami mai. Hai almeno mangiato?",
        ironico: "Il campione ha mangiato o vive di gloria?",
      },
    ],
    choices: [
      { tone: "dolce", text: "Sì ma', ma le tue lasagne sono un'altra cosa ❤️", reply: "Domenica ti aspetto 😘", fx: { rel: 6, happiness: 3 } },
      { tone: "sincero", text: "Una piadina al volo…", reply: "Domenica vieni a pranzo. Non è una domanda.", fx: { rel: 3 } },
      { tone: "sbruffone", text: "Ho un nutrizionista ora, ma'", reply: "Il nutrizionista ti fa le lasagne?", fx: { rel: -2 } },
      { tone: "freddo", text: "Sì.", reply: "Ok…", fx: { rel: -5 } },
    ],
    ignore: { days: 3, fx: { rel: -4 }, text: "Vabbè, ho capito che sei impegnato." },
  },
  "mamma-orgogliosa": {
    role: "mamma",
    text: [
      "Ti ho visto!!! Sei stato bravissimo 😭❤️",
      "Ho fatto vedere il video a tutta la parrocchia",
    ],
    choices: [
      { tone: "dolce", text: "Grazie ma' ❤️ era per te", reply: "Il mio campione 😭", fx: { rel: 8, happiness: 5 } },
      { tone: "sincero", text: "La parrocchia no, che vergogna 😅", reply: "Troppo tardi 😂", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Normale amministrazione 😎", reply: "Sì sì, intanto chiama la nonna", fx: { rel: 2 } },
      { tone: "freddo", text: "Ok ma'", reply: "…ok", fx: { rel: -3 } },
    ],
  },
  "mamma-spesa": {
    role: "mamma",
    text: ["Mi ha detto tua zia che ti sei comprato roba di lusso. È vero?! 😳"],
    choices: [
      { tone: "sincero", text: "Un regalo per me, me lo sono meritato", reply: "Va bene, ma metti da parte qualcosa!", fx: { rel: 1 } },
      { tone: "dolce", text: "Ti porto a cena fuori per farmi perdonare ❤️", reply: "Accetto! 😍", fx: { rel: 8, money: -30, label: "Cena con Mamma" } },
      { tone: "sbruffone", text: "Mamma, sono una star ormai 😎", reply: "La star mi deve ancora 50 euro", fx: { rel: -2, fame: 1 } },
      { tone: "freddo", text: "Sono soldi miei", reply: "Certo. Ciao.", fx: { rel: -8 } },
    ],
  },
  "mamma-promozione": {
    role: "mamma",
    text: [(x) => `Mio figlio in ${lvName(x)}!! 😭`, "Ho già chiamato tutti i parenti"],
    choices: [
      { tone: "dolce", text: "È anche merito tuo, ma' ❤️", reply: "Ti ho cresciuto bene 😭", fx: { rel: 8, happiness: 5 } },
      { tone: "sincero", text: "Non ci credo ancora", reply: "Credici! 😘", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Questo è solo l'inizio 😎", reply: "Intanto domenica vieni a pranzo", fx: { rel: 2 } },
      { tone: "freddo", text: "Sì", reply: "Che entusiasmo…", fx: { rel: -4 } },
    ],
  },
  "ragazza-cena": {
    role: "ragazza",
    text: [
      {
        normale: "Mi porti a cena fuori stasera? 🍝",
        affettuoso: "Stasera cena fuori, solo noi due? ❤️",
        freddo: "Sarebbe carino uscire a cena, ogni tanto.",
        ironico: "Stasera la star mi porta a cena o devo chiedere al suo agente?",
      },
    ],
    choices: [
      { tone: "dolce", text: "Certo, scegli tu il posto ❤️", reply: "Ti amo 😍", fx: { rel: 12, happiness: 6, money: -50, label: "Cena fuori" } },
      { tone: "sincero", text: "Stasera no, sono distrutto. Sabato?", reply: "Ok… sabato però è sabato", fx: { rel: -2 } },
      { tone: "sbruffone", text: "Solo se paghi tu 😏", reply: "Ahah. No.", fx: { rel: -8 } },
      { tone: "freddo", text: "Non ho tempo", reply: "Non hai mai tempo.", fx: { rel: -12 } },
    ],
    ignore: { days: 2, fx: { rel: -8 }, text: "Ok. Ceno da sola." },
  },
  "ragazza-film": {
    role: "ragazza",
    text: [
      {
        normale: "Stasera film sul divano? Scelgo io 😇",
        affettuoso: "Stasera copertina, film e te. Va bene? 🥰",
        freddo: "Stasera c'è un film. Se ti va.",
        ironico: "Stasera film. Niente partite registrate, campione.",
      },
    ],
    choices: [
      { tone: "dolce", text: "Basta che non sia horror ❤️", reply: "È horror 😈", fx: { rel: 8, happiness: 4, energy: 5 } },
      { tone: "sincero", text: "Sì, ma alle 23 dormo, domani mi alleno", reply: "Va bene, nonno 😄", fx: { rel: 4 } },
      { tone: "sbruffone", text: "Mettiamo le mie partite, così impari", reply: "Scelgo io, ho detto.", fx: { rel: -4 } },
      { tone: "freddo", text: "Esco con Dario", reply: "Ah. Bene.", fx: { rel: -10 } },
    ],
    ignore: { days: 2, fx: { rel: -6 } },
  },
  "ragazza-consola": {
    role: "ragazza",
    text: [
      {
        normale: "Ho visto il risultato… vuoi che passo da te?",
        affettuoso: "Amore, ho visto. Arrivo con la pizza? ❤️",
        freddo: "Ho visto il risultato. Se vuoi parlare ci sono.",
        ironico: "Ho visto. Ti consolo o ti dico che hai giocato da cani? 😅",
      },
    ],
    choices: [
      { tone: "dolce", text: "Sì, ti prego ❤️", reply: "Arrivo 🍕", fx: { rel: 8, happiness: 8 } },
      { tone: "sincero", text: "Grazie, stasera ho bisogno di stare da solo", reply: "Ok, ti capisco. Ti voglio bene", fx: { rel: 1 } },
      { tone: "sbruffone", text: "Colpa degli arbitri", reply: "Certo amore, sempre colpa loro 🙃", fx: { rel: -2 } },
      { tone: "freddo", text: "Non ho voglia di parlare", reply: "Ok.", fx: { rel: -6 } },
    ],
  },
  "ragazza-regalo": {
    role: "ragazza",
    text: [
      {
        normale: "Ho visto cosa ti sei comprato… e a me niente? 🙄",
        affettuoso: "Bello il regalino che ti sei fatto! La prossima volta un pensierino anche per me? 🥺",
        freddo: "Ho visto cosa ti sei comprato. Per me invece mai niente.",
        ironico: "La star si fa i regali da sola 😂 e la fidanzata?",
      },
    ],
    choices: [
      { tone: "dolce", text: "Domani ti porto a cena, promesso ❤️", reply: "Ti prendo in parola 😍", fx: { rel: 10, money: -40, label: "Cena fuori" } },
      { tone: "sincero", text: "Hai ragione, scusa. Mi faccio perdonare", reply: "Vedremo 😏", fx: { rel: 3 } },
      { tone: "sbruffone", text: "Il regalo sono io 😎", reply: "Che fortuna. 🙄", fx: { rel: -6 } },
      { tone: "freddo", text: "Sono soldi miei", reply: "Infatti. Tienteli.", fx: { rel: -12 } },
    ],
  },
  lascia: {
    role: "ragazza",
    text: ["Non mi rispondi, non ci sei mai.", "È finita. Ciao."],
    onSend: { breakup: true },
    choices: [
      {
        tone: "dolce",
        text: "Aspetta, ti prego. Possiamo parlarne ❤️",
        reply: (x) =>
          x.s.once.includes(`riconciliati:${x.c.id}`) ? "No. Basta così." : "…ok. Ultima possibilità.",
        fx: (x) => (x.s.once.includes(`riconciliati:${x.c.id}`) ? { happiness: -8 } : { reconcile: true }),
      },
      { tone: "sincero", text: "Hai ragione. Mi dispiace.", reply: "Anche a me.", fx: { happiness: -8 } },
      { tone: "sbruffone", text: "Ce ne sono mille come te 😎", reply: "Auguri a tutte e mille.", fx: { fame: 1, happiness: -3 } },
      { tone: "freddo", text: "Ok, ciao.", reply: null, fx: { happiness: -5 } },
    ],
  },
  "nuova-ragazza": {
    role: "nuova",
    text: ["Ciao! Ti ho visto giocare sabato 👀", "Sei sempre così bravo o era fortuna?"],
    choices: [
      { tone: "sbruffone", text: "Fortuna? Vieni a vedermi mercoledì 😎", reply: "Ok, vengo. Non deludermi 😏", fx: { girlfriend: true, rel: 5 } },
      { tone: "dolce", text: "Un po' tutte e due 😄 Ti va un caffè?", reply: "Volentieri ☕", fx: { girlfriend: true, rel: 10 } },
      { tone: "sincero", text: "Fortuna, decisamente", reply: "Simpatico. Mi piaci 😄", fx: { girlfriend: true } },
      { tone: "freddo", text: "Chi sei?", reply: "Nessuno, scusa.", fx: { rel: -10 } },
    ],
  },
  "socio-campetto": {
    role: "socio",
    text: [
      {
        normale: "Oh, ma al campetto vero quando vieni? Lì la panchina non c'è 😂",
        affettuoso: "Fra, sabato campetto? Senza di te non è lo stesso",
        ironico: "Ecco il professionista. Al campetto vieni o ti fai pagare anche lì? 😂",
        freddo: "Sabato campetto. Se ti degni.",
      },
    ],
    choices: [
      { tone: "dolce", text: "Per il campetto ci sono sempre ❤️", reply: "Grande! Porta il pallone buono", fx: { rel: 6 } },
      { tone: "sbruffone", text: "Vengo, ma preparatevi a perdere 😎", reply: "Lo dici ogni volta 😂", fx: { rel: 1, fame: 1 } },
      { tone: "sincero", text: "Se riesco vengo, sono pieno", reply: "Ok, facci sapere", fx: {} },
      { tone: "freddo", text: "Vediamo", reply: "Il solito", fx: { rel: -5 } },
    ],
  },
  "socio-sfida": {
    role: "socio",
    text: [
      {
        normale: "Hai visto le classifiche delle sfide? Prova a battermi, se ci riesci 😏",
        ironico: "Alla gara delle triple ti sto umiliando. Così, per dire 😂",
        affettuoso: "Stasera sfida alle triple? Chi perde paga la pizza 🍕",
        freddo: "Le classifiche parlano chiaro. Io sopra.",
      },
    ],
    choices: [
      { tone: "sbruffone", text: "Stasera ti distruggo", reply: "Parole parole parole 😂", fx: { rel: 2 } },
      { tone: "dolce", text: "Complimenti! Ci provo 😄", reply: "Ti aspetto 😏", fx: { rel: 4 } },
      { tone: "sincero", text: "Sei forte, ma ci provo", reply: "Così si fa", fx: { rel: 3 } },
      { tone: "freddo", text: "Non mi interessa", reply: "Paura eh", fx: { rel: -5 } },
    ],
  },
  "socio-grande": {
    role: "socio",
    text: [
      {
        normale: "Oh ma che partita hai fatto?! Sei un animale 🔥",
        ironico: "Ok, oggi te lo concedo: hai giocato bene. Solo oggi.",
        freddo: "Bella partita.",
        affettuoso: "FRATELLO. Che partita. Sono senza parole 🔥",
      },
    ],
    choices: [
      { tone: "sbruffone", text: "Lo so 😎", reply: "Umiltà zero, come sempre 😂", fx: { rel: -1, fame: 1 } },
      { tone: "dolce", text: "Grazie fra ❤️ al campetto vero però vinci tu", reply: "Ovvio 😂 ma bravo davvero", fx: { rel: 6 } },
      { tone: "sincero", text: "Mi è entrato tutto, giornata giusta", reply: "Si è visto!", fx: { rel: 3 } },
      { tone: "freddo", text: "👍", reply: "Ok…", fx: { rel: -4 } },
    ],
  },
  "socio-vero": {
    role: "socio",
    text: [
      "Bella partita al campetto, quello vero! 🏀",
      (x) => `Nel gioco ti hanno dato ${x.data.bonus ?? "un bonus"}: la pizza la offri tu 🍕`,
    ],
    choices: [
      { tone: "dolce", text: "Offro io, ovvio 🍕", reply: "Grande!!", fx: { rel: 8, happiness: 5, money: -20, label: "Pizza con gli amici" } },
      { tone: "sbruffone", text: "Offro a chi ha segnato più di me 😎", reply: "Quindi a nessuno 😂", fx: { rel: 2 } },
      { tone: "sincero", text: "Che fatica oggi però", reply: "Si invecchia 😂", fx: { rel: 2 } },
      { tone: "freddo", text: "Vedremo", reply: "Tirchio", fx: { rel: -4 } },
    ],
  },
  "amico-prima-vittoria": {
    role: "amico",
    text: ["PRIMA VITTORIA! 🍾", "Stasera si festeggia, non accetto un no"],
    choices: [
      { tone: "sbruffone", text: "Stappate tutto 🍾", reply: "Così si fa!", fx: SERATA },
      { tone: "sincero", text: "Una birra e a casa, promesso", reply: "Una. Come no 😂", fx: { rel: 4, happiness: 5, energy: -8, money: -15, label: "Una birra (forse due)" } },
      { tone: "dolce", text: "Grazie fratè ❤️ stasera però riposo", reply: "Ok… ma la prossima la festeggiamo", fx: { rel: 2 } },
      { tone: "freddo", text: "No", reply: "Pesante", fx: { rel: -6 } },
    ],
  },
  "agente-offerte": {
    role: "agente",
    text: [
      (x) =>
        x.c.thread.length === 0
          ? "Ciao campione, sono Lo Bianco, il tuo procuratore 📑"
          : "Campione, sono io 📑",
      (x) =>
        x.data.promoted
          ? "Fine stagione: c'è anche una promozione! Guarda in Contratti."
          : "Fine stagione: sono arrivate le offerte. Guarda in Contratti e scegli.",
    ],
    choices: [
      { tone: "sincero", text: "Grazie, ci guardo subito", reply: "Bravo.", fx: { rel: 3 } },
      { tone: "dolce", text: "Grazie di tutto, sei un grande", reply: "Lo so 😄", fx: { rel: 5 } },
      { tone: "sbruffone", text: "Voglio solo le squadre grosse", reply: "Si fa coi voti, non con le parole.", fx: { rel: -1 } },
      { tone: "freddo", text: "Ok", reply: "Ok.", fx: {} },
    ],
  },
  "agente-sponsor": {
    role: "agente",
    text: [
      "Novità: Pasta Spicchio vuole la tua faccia sulle confezioni 🍝",
      (x) => `Offrono ${euro(x, 200)} a settimana. Accetto?`,
    ],
    choices: [
      { tone: "sincero", text: "Accetta!", reply: "Fatto. Firmato.", fx: (x) => ({ sponsor: 200 * LEVELS[x.s.contract.level].mult }) },
      { tone: "dolce", text: "Accetta e ringraziali da parte mia", reply: "Gli farà piacere. Fatto.", fx: (x) => ({ sponsor: 200 * LEVELS[x.s.contract.level].mult, fame: 1 }) },
      {
        tone: "sbruffone",
        text: "Chiedi il doppio.",
        reply: (x) => (x.s.fame >= 50 ? "Hanno detto sì. Non ci credo nemmeno io." : "Si sono tirati indietro. Complimenti."),
        fx: (x) => (x.s.fame >= 50 ? { sponsor: 300 * LEVELS[x.s.contract.level].mult } : { rel: -3 }),
      },
      { tone: "freddo", text: "Non mi interessa.", reply: "Contento tu.", fx: { rel: -3 } },
    ],
  },
  "coach-promozione": {
    role: "coach",
    text: ["Ho saputo. Ti vogliono più su.", "Vai e fatti valere. Ma ricordati da dove vieni."],
    choices: [
      { tone: "dolce", text: "Grazie coach, le devo tutto", reply: "Mi devi una pizza.", fx: { rel: 8 } },
      { tone: "sincero", text: "Mi mancherà questa squadra", reply: "Anche tu. Un po'.", fx: { rel: 5 } },
      { tone: "sbruffone", text: "Era ora 😎", reply: "Sempre il solito.", fx: { rel: -3 } },
      { tone: "freddo", text: "Ok", reply: "Ok. In bocca al lupo.", fx: { rel: -2 } },
    ],
  },
};

const GIRL_NAMES = ["Sara", "Chiara", "Martina", "Alessia", "Noemi", "Federica"];

export function initialContacts(friend: string): Contact[] {
  const base = (id: string, name: string, role: Contact["role"], rel: number): Contact => ({
    id,
    name,
    role,
    rel,
    tones: {},
    thread: [],
    unread: 0,
    pending: null,
  });
  return [
    base("mamma", "Mamma", "mamma", 40),
    base("giulia", "Giulia", "ragazza", 20),
    base("coach", "Coach Ferretti", "coach", 0),
    base("dario", "Dario", "amico", 10),
    base("socio", friend || "Il Socio", "socio", 20),
    base("agente", "Lo Bianco", "agente", 0),
  ];
}

export const girlfriend = (s: GameState) => s.contacts.find((c) => c.role === "ragazza");

function contactFor(s: GameState, role: Role): Contact | undefined {
  if (role === "nuova") return s.contacts.find((c) => c.role === "nuova" && !c.thread.length);
  return s.contacts.find((c) => c.role === role);
}

function patchContact(s: GameState, id: string, f: (c: Contact) => Contact): GameState {
  return { ...s, contacts: s.contacts.map((c) => (c.id === id ? f(c) : c)) };
}

export function applyFx(s: GameState, contactId: string, fx: Fx | undefined): GameState {
  if (!fx) return s;
  let st = s;
  const mult = LEVELS[st.contract.level].mult;
  if (fx.rel) st = patchContact(st, contactId, (c) => ({ ...c, rel: clamp(c.rel + fx.rel!, -100, 100) }));
  if (fx.coach) {
    const coach = st.contacts.find((c) => c.role === "coach");
    if (coach) st = patchContact(st, coach.id, (c) => ({ ...c, rel: clamp(c.rel + fx.coach!, -100, 100) }));
  }
  if (fx.happiness) st = { ...st, happiness: clamp(st.happiness + fx.happiness, 0, 100) };
  if (fx.energy) st = { ...st, energy: clamp(st.energy + fx.energy, 0, 100) };
  if (fx.fame) st = { ...st, fame: clamp(st.fame + fx.fame, 0, 100) };
  if (fx.money) {
    // Non si va in rosso per una pizza: al massimo si spende quello che si ha.
    const v = Math.max(-st.money, Math.round(fx.money * mult));
    if (v !== 0)
      st = {
        ...st,
        money: st.money + v,
        bank: [...st.bank, { day: st.day, label: fx.label ?? (v > 0 ? "Entrata" : "Uscita"), amount: v }].slice(-60),
        badges: v > 0 ? { ...st.badges, banca: st.badges.banca + 1 } : st.badges,
      };
  }
  if (fx.xp) for (const [k, v] of Object.entries(fx.xp)) st = addXp(st, k as Skill, v ?? 0);
  if (fx.tonight) st = { ...st, tonight: fx.tonight };
  if (fx.breakup)
    st = { ...patchContact(st, contactId, (c) => ({ ...c, role: "ex" })), singleSince: st.day };
  if (fx.reconcile)
    st = {
      ...patchContact(st, contactId, (c) => ({ ...c, role: "ragazza", rel: -15 })),
      singleSince: null,
      once: [...st.once, `riconciliati:${contactId}`],
    };
  if (fx.girlfriend)
    st = {
      ...patchContact(st, contactId, (c) => ({ ...c, role: "ragazza", rel: Math.max(c.rel, 25) })),
      singleSince: null,
    };
  if (fx.sponsor) st = { ...st, contract: { ...st.contract, sponsor: Math.round(fx.sponsor) } };
  return st;
}

/** Un messaggio arriva: le nuvolette, il pallino rosso, la risposta che aspetta. */
export function deliver(
  s: GameState,
  id: string,
  data: Record<string, string | number> = {},
  rng: Rng = Math.random,
): GameState {
  const ev = EVENTS[id];
  if (!ev) return s;
  let st = s;
  if (ev.role === "nuova") {
    const used = new Set(st.contacts.map((c) => c.name));
    const name = GIRL_NAMES.find((n) => !used.has(n)) ?? pick(rng, GIRL_NAMES);
    st = {
      ...st,
      contacts: [
        ...st.contacts,
        { id: `n${st.day}-${name.toLowerCase()}`, name, role: "nuova", rel: 0, tones: {}, thread: [], unread: 0, pending: null },
      ],
    };
  }
  let c = contactFor(st, ev.role);
  if (!c) return s;
  // Una cosa alla volta: la domanda vecchia senza risposta si chiude da sola.
  if (c.pending) {
    st = resolveIgnored(st, c.id, false);
    c = st.contacts.find((x) => x.id === c!.id)!;
  }
  const x: Ctx = { s: st, c, data };
  const bubbles = ev.text.map((t) => render(t, x)).filter((t): t is string => !!t);
  st = patchContact(st, c.id, (k) => ({
    ...k,
    thread: [...k.thread, ...bubbles.map((text) => ({ from: "them" as const, text, day: st.day }))].slice(-80),
    unread: k.unread + bubbles.length,
    pending: ev.choices.length ? { event: id, since: st.day, data } : null,
  }));
  st = applyFx(st, c.id, ev.onSend);
  return { ...st, sent: { ...st.sent, [id]: st.day } };
}

/** La tua risposta: la scrivi, ti rispondono, cambia il rapporto (e un po' il carattere). */
export function answer(s: GameState, contactId: string, choice: number): GameState {
  const c = s.contacts.find((k) => k.id === contactId);
  if (!c?.pending) return s;
  const ev = EVENTS[c.pending.event];
  const ch = ev?.choices[choice];
  if (!ch) return s;
  const x: Ctx = { s, c, data: c.pending.data ?? {} };
  const mine = render(ch.text, x)!;
  const reply = ch.reply === null ? null : render(ch.reply, x);
  const fx = typeof ch.fx === "function" ? ch.fx(x) : ch.fx;
  let st = patchContact(s, c.id, (k) => ({
    ...k,
    thread: [
      ...k.thread,
      { from: "me" as const, text: mine, day: s.day },
      ...(reply ? [{ from: "them" as const, text: reply, day: s.day }] : []),
    ].slice(-80),
    tones: { ...k.tones, [ch.tone]: (k.tones[ch.tone] ?? 0) + 1 },
    pending: null,
    unread: 0,
  }));
  st = applyFx(st, c.id, fx);
  return st;
}

/** Nessuna risposta: chi aspettava se la prende (un po'). */
export function resolveIgnored(s: GameState, contactId: string, withText: boolean): GameState {
  const c = s.contacts.find((k) => k.id === contactId);
  if (!c?.pending) return s;
  const ev = EVENTS[c.pending.event];
  const ig = ev?.ignore ?? {
    days: 3,
    fx: { rel: c.role === "ragazza" || c.role === "mamma" ? -3 : -1 },
  };
  const x: Ctx = { s, c, data: c.pending.data ?? {} };
  const text = withText && ig.text ? render(ig.text, x) : null;
  let st = patchContact(s, c.id, (k) => ({
    ...k,
    pending: null,
    thread: text ? [...k.thread, { from: "them" as const, text, day: s.day }] : k.thread,
    unread: k.unread + (text ? 1 : 0),
  }));
  st = applyFx(st, c.id, ig.fx);
  return st;
}

/** I giorni passano: chi aspetta da troppo tempo smette di aspettare. */
export function expireIgnored(s: GameState): GameState {
  let st = s;
  for (const c of s.contacts) {
    if (!c.pending) continue;
    const days = EVENTS[c.pending.event]?.ignore?.days ?? 3;
    if (st.day - c.pending.since >= days) st = resolveIgnored(st, c.id, true);
  }
  return st;
}

const RANDOM: { id: string; cd: number; when?: (s: GameState, matchToday: boolean) => boolean }[] = [
  { id: "amico-serata", cd: 4 },
  { id: "mamma-mangiato", cd: 7 },
  { id: "socio-campetto", cd: 6 },
  { id: "socio-sfida", cd: 9 },
  { id: "ragazza-cena", cd: 6, when: (s) => !!girlfriend(s) },
  { id: "ragazza-film", cd: 5, when: (s) => !!girlfriend(s) },
  { id: "coach-extra", cd: 7, when: (_s, m) => !m },
  {
    id: "agente-sponsor",
    cd: 14,
    when: (s) => s.contract.level !== "campetto" && s.fame >= 30 && !s.contract.sponsor,
  },
];

const cooled = (s: GameState, id: string, cd: number) =>
  s.sent[id] === undefined || s.day - s.sent[id] >= cd;

export const matchToday = (s: GameState) =>
  s.season.matches.some((m) => m.day === s.day && !m.result);

/** I messaggi di un giorno nuovo. */
export function dayEvents(s: GameState, rng: Rng): string[] {
  const out: string[] = [];
  const gf = girlfriend(s);
  const today = matchToday(s);
  if (s.day === 2 && gf && !s.sent["ragazza-ciao"]) out.push("ragazza-ciao");
  if (s.yesterday === "serata" && today) out.push("coach-serata");
  if (gf && gf.rel <= -40) out.push("lascia");
  if (
    !gf &&
    s.singleSince !== null &&
    s.day - s.singleSince >= 5 &&
    s.fame >= 8 &&
    cooled(s, "nuova-ragazza", 6)
  )
    out.push("nuova-ragazza");
  if (!out.length && s.day > 2 && rng() < 0.6) {
    const busy = new Set(s.contacts.filter((c) => c.pending).map((c) => c.role));
    const pool = RANDOM.filter(
      (e) =>
        cooled(s, e.id, e.cd) &&
        (!e.when || e.when(s, today)) &&
        !busy.has(EVENTS[e.id].role),
    );
    if (pool.length) out.push(pick(rng, pool).id);
  }
  return out;
}

/** Dopo una partita: chi ti scrive dipende da come hai giocato. */
export function matchEvents(
  s: GameState,
  r: { rating: number; us: number; them: number; benched: boolean; simulated: boolean },
  firstWin: boolean,
  rng: Rng,
): string[] {
  const out: string[] = [];
  const gf = girlfriend(s);
  if (r.benched) out.push("coach-panchina");
  else if (r.rating >= 8 && cooled(s, "coach-bravo", 6)) out.push("coach-bravo");
  if (r.rating >= 8.5 && cooled(s, "mamma-orgogliosa", 7)) out.push("mamma-orgogliosa");
  else if (r.rating >= 8 && cooled(s, "socio-grande", 5) && rng() < 0.7) out.push("socio-grande");
  if (r.us < r.them && r.rating < 6.5 && gf && cooled(s, "ragazza-consola", 6)) out.push("ragazza-consola");
  if (firstWin) out.push("amico-prima-vittoria");
  return out;
}

/** Un acquisto grosso non passa inosservato. */
export function purchaseEvents(s: GameState, price: number, before: number): string[] {
  const mult = LEVELS[s.contract.level].mult;
  if (price < Math.max(300 * mult, before * 0.5)) return [];
  if (girlfriend(s) && cooled(s, "ragazza-regalo", 5)) return ["ragazza-regalo"];
  if (cooled(s, "mamma-spesa", 7)) return ["mamma-spesa"];
  return [];
}

export const unreadCount = (s: GameState) =>
  s.contacts.reduce((a, c) => a + c.unread, 0);
