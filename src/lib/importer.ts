import { emptyBox, type Box, type BoxKey, type Player, type Team } from "./types";

export interface ImportRow {
  rawName: string;
  playerId: string | null;
  team: Team | null;
  box: Box;
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
  scoreA: number | null;
  scoreB: number | null;
}

const ALIASES: Record<string, BoxKey | "name" | "team" | "reb" | "fgm" | "fga"> = {
  nome: "name",
  giocatore: "name",
  player: "name",
  name: "name",
  squadra: "team",
  team: "team",
  punti: "pts",
  pts: "pts",
  points: "pts",
  p: "pts",
  "2pm": "fg2m",
  "2ptm": "fg2m",
  "2pa": "fg2a",
  "2pta": "fg2a",
  "3pm": "fg3m",
  "3ptm": "fg3m",
  triple: "fg3m",
  "3pa": "fg3a",
  "3pta": "fg3a",
  "triple tentate": "fg3a",
  fgm: "fgm",
  fga: "fga",
  oreb: "oreb",
  "rimbalzi offensivi": "oreb",
  dreb: "dreb",
  "rimbalzi difensivi": "dreb",
  reb: "reb",
  rimbalzi: "reb",
  rebounds: "reb",
  ast: "ast",
  assist: "ast",
  assists: "ast",
  stl: "stl",
  rubate: "stl",
  "palle rubate": "stl",
  steals: "stl",
  blk: "blk",
  stoppate: "blk",
  blocks: "blk",
  tov: "tov",
  to: "tov",
  perse: "tov",
  "palle perse": "tov",
  turnovers: "tov",
  pf: "fouls",
  falli: "fouls",
  fouls: "fouls",
};

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Best match for a free-text name among the players (full name, first name, nickname, typos). */
export function matchPlayer(raw: string, players: Player[]): string | null {
  const n = normalizeName(raw);
  if (!n) return null;
  // A bare first name shared by two players is ambiguous.
  if (players.filter((p) => normalizeName(p.firstName) === n && !p.nickname).length > 1) return null;
  let best: { id: string; score: number } | null = null;
  for (const p of players) {
    const candidates = [
      normalizeName(`${p.firstName} ${p.lastName ?? ""}`),
      normalizeName(`${p.lastName ?? ""} ${p.firstName}`),
      normalizeName(p.firstName),
      p.lastName ? normalizeName(p.lastName) : "",
      p.nickname ? normalizeName(p.nickname) : "",
    ].filter(Boolean);
    for (const c of candidates) {
      let score: number;
      if (c === n) score = 0;
      else if (c.startsWith(n) || n.startsWith(c)) score = 1;
      else score = levenshtein(c, n) + 1;
      if (score <= 3 && (!best || score < best.score)) best = { id: p.id, score };
    }
  }
  return best?.id ?? null;
}

function parseTeam(v: unknown): Team | null {
  const s = String(v ?? "").trim().toUpperCase();
  if (["A", "1", "BIANCHI", "CASA", "HOME"].includes(s)) return "A";
  if (["B", "2", "NERI", "OSPITI", "AWAY"].includes(s)) return "B";
  return null;
}

function num(v: unknown): number {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function rowFromRecord(rec: Record<string, unknown>, players: Player[]): ImportRow | null {
  const box = emptyBox();
  let name = "";
  let team: Team | null = null;
  let reb = 0;
  let fgm = 0;
  let fga = 0;
  for (const [k, v] of Object.entries(rec)) {
    const key = ALIASES[normalizeName(k)] ?? ALIASES[k.trim().toLowerCase()];
    if (!key) continue;
    if (key === "name") name = String(v ?? "").trim();
    else if (key === "team") team = parseTeam(v);
    else if (key === "reb") reb = num(v);
    else if (key === "fgm") fgm = num(v);
    else if (key === "fga") fga = num(v);
    else box[key] = num(v);
  }
  if (!name) return null;
  if (reb && !box.oreb && !box.dreb) box.dreb = reb;
  // Only total field goals: treat them as 2-pointers beyond the known threes.
  if (fgm && !box.fg2m) box.fg2m = Math.max(0, fgm - box.fg3m);
  if (fga && !box.fg2a) box.fg2a = Math.max(0, fga - box.fg3a);
  if (box.fg2m + box.fg2a > 0) box.pts = box.fg2m * 2 + box.fg3m * 3;
  else box.pts = Math.max(box.pts, box.fg3m * 3);
  return { rawName: name, playerId: matchPlayer(name, players), team, box };
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses pasted CSV (comma, semicolon or tab separated) or JSON into rows. */
export function parseImport(text: string, players: Player[]): ImportResult {
  const errors: string[] = [];
  const t = text.trim();
  let records: Record<string, unknown>[] = [];
  let scoreA: number | null = null;
  let scoreB: number | null = null;
  if (!t) return { rows: [], errors: ["Incolla prima i dati."], scoreA, scoreB };

  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const data = JSON.parse(t);
      if (Array.isArray(data)) records = data;
      else {
        records = data.players ?? data.giocatori ?? data.rows ?? [];
        const sa = data.scoreA ?? data.punteggioA ?? data.score?.A;
        const sb = data.scoreB ?? data.punteggioB ?? data.score?.B;
        if (sa !== undefined) scoreA = num(sa);
        if (sb !== undefined) scoreB = num(sb);
      }
    } catch {
      return { rows: [], errors: ["JSON non valido."], scoreA, scoreB };
    }
  } else {
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    const sep = lines[0].includes("\t") ? "\t" : lines[0].split(";").length > lines[0].split(",").length ? ";" : ",";
    const header = splitCsvLine(lines[0], sep);
    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line, sep);
      const rec: Record<string, unknown> = {};
      header.forEach((h, i) => (rec[h] = cells[i]));
      records.push(rec);
    }
  }

  const rows: ImportRow[] = [];
  records.forEach((r, i) => {
    const row = rowFromRecord(r, players);
    if (!row) errors.push(`Riga ${i + 1}: manca il nome del giocatore.`);
    else rows.push(row);
  });
  for (const r of rows) if (!r.playerId) errors.push(`"${r.rawName}" non corrisponde a nessun giocatore: sceglilo a mano.`);
  return { rows, errors, scoreA, scoreB };
}
