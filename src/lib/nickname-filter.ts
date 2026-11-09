/**
 * Niente parole offensive nei soprannomi (italiano e inglese, anche scritte storpiate:
 * "c4zz0", "c.a.z.z.o", "caaazzo"). Lista fatta a mano e corta, pensata per i nomi:
 * le librerie generiche bloccano anche nomi innocenti (Assist, Figaro, Pompeo,
 * Polentone, Ficarra) e lasciano passare il gergo italiano (diocane, vaffa).
 * Lo stesso controllo c'è nel database, così non si aggira.
 */

/** Radici che bastano da sole, anche dentro una parola più lunga. */
const ROOTS = [
  // volgarità
  "cazz",
  "merd",
  "puttan",
  "troion",
  "coglion",
  "stronz",
  "minchi",
  "pompin",
  "bocchin",
  "mignott",
  "baldracc",
  "bagasc",
  "sborr",
  "sburr",
  "segaiol",
  "leccacul",
  "vaffancul",
  "fancul",
  "inculat",
  "zoccolon",
  // insulti e discriminazione
  "froci",
  "ricchion",
  "culatton",
  "frocett",
  "handicappat",
  "mongoloid",
  "spastic",
  "cerebrolés",
  "cerebroles",
  "subnormal",
  "imbecill",
  "zingar",
  "terron",
  "bastard",
  // bestemmie
  "porcodi",
  "porcoddi",
  "porcaddi",
  "diocan",
  "dioboi",
  "dioporc",
  "diomerd",
  "porcamadonn",
  "madonnaputt",
  "cristodi",
  "diobestia",
  // odio
  "nazist",
  "hitler",
  "mussolin",
  "kkk",
  // inglese
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "pussy",
  "whore",
  "slut",
  "nigg",
  "fagg",
  "retard",
  "porn",
  "asshole",
  "wank",
  "dildo",
  "jizz",
] as const;

/** Parole da sole (per non bloccare nomi innocenti che le contengono: "Assist", "Figaro", "Dickens"). */
const WORDS = [
  "figa",
  "fica",
  "fregna",
  "culo",
  "culona",
  "tette",
  "tettona",
  "troia",
  "troie",
  "zoccola",
  "zoccole",
  "checca",
  "finocchio",
  "finocchi",
  "negro",
  "negra",
  "negri",
  "negre",
  "polentone",
  "polentoni",
  "ritardato",
  "ritardata",
  "ritardati",
  "deficiente",
  "deficienti",
  "idiota",
  "idioti",
  "cretino",
  "cretina",
  "cretini",
  "cornuto",
  "cornuta",
  "nazi",
  "duce",
  "heil",
  "isis",
  "porco dio",
  "dio cane",
  "dio porco",
  "dio boia",
  "fag",
  "ass",
  "dick",
  "cock",
  "rape",
  "cum",
  "milf",
  "tits",
  "boobs",
  "penis",
  "vagina",
] as const;

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "!": "i",
  "|": "i",
  "3": "e",
  "4": "a",
  "@": "a",
  "5": "s",
  $: "s",
  "7": "t",
  "8": "b",
  "9": "g",
  "€": "e",
};

function letters(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0-9!|@$€]/g, (c) => LEET[c] ?? c);
}

/** Ogni lettera può ripetersi ("caaazzzo"); le doppie della parola restano almeno doppie. */
function loose(word: string): RegExp {
  const body = [...word.normalize("NFD").replace(/[̀-ͯ]/g, "")]
    .map((c) =>
      c === " " ? "" : `${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`,
    )
    .join("");
  return new RegExp(body);
}

const ROOT_RE = ROOTS.map((r) => loose(r));
const WORD_RE = WORDS.map((w) => new RegExp(`^${loose(w).source}$`));

/** true se il soprannome contiene una parola che può offendere. */
export function isOffensive(name: string): boolean {
  const l = letters(name);
  // Tutto attaccato: anche "c.a.z.z.o" o "porco dio" scritto staccato.
  const joined = l.replace(/[^a-z]/g, "");
  if (!joined) return false;
  if (ROOT_RE.some((re) => re.test(joined))) return true;
  const tokens = l.split(/[^a-z]+/).filter(Boolean);
  // Le parole da sole, e le coppie di parole ("porco dio") lette insieme.
  const candidates = [
    ...tokens,
    ...tokens.slice(1).map((t, i) => tokens[i] + t),
    joined,
  ];
  return candidates.some((t) => WORD_RE.some((re) => re.test(t)));
}

/** Qualche idea al posto di un soprannome che non va. */
export const NICK_IDEAS = [
  "Splash",
  "Il Muro",
  "Mamba",
  "Treccia",
  "Ciuff",
  "Bomber",
  "Cecchino",
  "Ferro",
] as const;

export function nickIdeas(firstName: string, taken: string[], n = 3): string[] {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()));
  const base = firstName.trim().split(/\s+/)[0] ?? "";
  const own = base ? [`${base} Splash`, `Mister ${base}`, `${base}23`] : [];
  const pool = [...NICK_IDEAS, ...own].filter(
    (x) => !used.has(x.toLowerCase()) && x.length <= 16,
  );
  // Ogni volta un po' diverse, ma sempre le stesse per lo stesso nome.
  let h = 0;
  for (const ch of base) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from(
    { length: Math.min(n, pool.length) },
    (_, i) => pool[(h + i * 3) % pool.length],
  ).filter((x, i, a) => a.indexOf(x) === i);
}
