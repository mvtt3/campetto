// Inserisce una o più partite direttamente nel database, come l'amministratore.
// Pensato per Claude (o per Matteo) quando le statistiche arrivano da un video,
// da HoopIQ o da un foglio: stesse regole di controllo dell'app (funzione save_match).
//
// Uso (dal PC, nella cartella del progetto):
//   PGPW='password-del-database' node scripts/inserisci-partita.mjs partite.json
//
// partite.json: una partita o un elenco di partite, per esempio
// [{
//   "data": "2026-10-29T17:30:00+01:00",
//   "formato": "2v2",
//   "punteggio": [21, 17],
//   "squadraA": ["Matteo Pepe", "Valerio"],
//   "squadraB": ["Simone", "Mattia"],
//   "statistiche": { "Valerio": { "pts": 9, "fg3m": 1, "ast": 3, "dreb": 4 } }
// }]
// Le statistiche sono facoltative. Nomi: il nome scelto nell'app, nome e cognome, solo nome se unico, o cognome.
// Date: dal 1° ottobre 2026 in poi (prima l'app non esisteva).

import fs from "node:fs";
import pg from "pg";

const file = process.argv[2];
if (!file || !process.env.PGPW) {
  console.error("Uso: PGPW='password' node scripts/inserisci-partita.mjs partite.json");
  process.exit(1);
}
const input = JSON.parse(fs.readFileSync(file, "utf8"));
const matches = Array.isArray(input) ? input : [input];

const c = new pg.Client({
  host: "aws-1-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.kniylvcfeckeabsjbzbe",
  password: process.env.PGPW,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const players = (await c.query("select id, first_name, last_name, nickname, user_id, is_admin from public.players where not archived")).rows;
const admin = players.find((p) => p.is_admin && p.user_id);
if (!admin) throw new Error("Nessun amministratore collegato a un account.");

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
// Come ci chiamiamo tra noi.
const ALIAS = { matti: "mattia", cande: "lorenzo candela" };
function find(name) {
  const n = ALIAS[norm(name)] ?? norm(name);
  const hits = players.filter(
    (p) =>
      (p.nickname && norm(p.nickname) === n) ||
      norm(`${p.first_name} ${p.last_name ?? ""}`) === n ||
      norm(p.first_name) === n ||
      (p.last_name && norm(p.last_name) === n),
  );
  if (hits.length !== 1) throw new Error(`"${name}": ${hits.length ? "ambiguo, usa nome e cognome" : "giocatore non trovato"}`);
  return hits[0].id;
}

for (const m of matches) {
  const stats = m.statistiche ?? {};
  const hasStats = Object.keys(stats).length > 0;
  const line = (name, team) => {
    const box = stats[name] ?? {};
    return { player_id: find(name), team, has_stats: hasStats, box };
  };
  const payload = {
    played_at: m.data,
    format: m.formato,
    target_points: m.finoA ?? 21,
    score_a: m.punteggio[0],
    score_b: m.punteggio[1],
    stats_source: hasStats ? "importata" : "solo_risultato",
    notes: m.note ?? null,
    players: [...m.squadraA.map((n) => line(n, "A")), ...m.squadraB.map((n) => line(n, "B"))],
    events: [],
  };
  await c.query("begin");
  try {
    // Le funzioni del database riconoscono l'utente da questi valori, come fa l'app.
    await c.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [
      admin.user_id,
      JSON.stringify({ sub: admin.user_id, role: "authenticated" }),
    ]);
    const r = await c.query("select public.save_match($1::jsonb) as id", [JSON.stringify(payload)]);
    await c.query("commit");
    console.log(`Salvata ${m.formato} ${m.punteggio.join("-")} del ${m.data}: ${r.rows[0].id}`);
  } catch (e) {
    await c.query("rollback");
    console.error(`Errore per la partita del ${m.data}: ${e.message}`);
  }
}
await c.end();
