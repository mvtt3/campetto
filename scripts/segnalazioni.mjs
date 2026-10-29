// Legge le segnalazioni nuove arrivate dall'app ("Segnala un problema") e le segna come lette.
// Pensato per il controllo programmato di Claude ogni due giorni, sul PC di Matteo.
//
// Uso (dal PC, nella cartella del progetto):
//   node scripts/segnalazioni.mjs            → mostra le nuove e le segna come lette
//   node scripts/segnalazioni.mjs --prova    → mostra le nuove senza segnarle
// La password del database si legge dalla variabile d'ambiente PGPW (mai nel codice).

import pg from "pg";

if (!process.env.PGPW) {
  console.error("Manca la variabile PGPW con la password del database.");
  process.exit(1);
}
const mark = !process.argv.includes("--prova");
const c = new pg.Client({
  host: "aws-1-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.kniylvcfeckeabsjbzbe",
  password: process.env.PGPW,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const { rows } = await c.query(`
  select f.id, f.created_at, f.kind, f.message, f.screen, f.device, f.app_version,
         coalesce(p.nickname, p.first_name) as nome, p.first_name, p.last_name
    from public.feedback f left join public.players p on p.id = f.player_id
   where f.status = 'nuova'
   order by f.created_at`);
if (!rows.length) console.log("Nessuna segnalazione nuova.");
for (const r of rows) {
  console.log("—".repeat(40));
  console.log(`${new Date(r.created_at).toLocaleString("it-IT", { timeZone: "Europe/Rome" })} · ${r.kind} · ${r.nome} (${r.first_name}${r.last_name ? " " + r.last_name : ""})`);
  console.log(`Schermata: ${r.screen ?? "?"} · Telefono: ${r.device ?? "?"}`);
  console.log(r.message);
}
if (mark && rows.length) await c.query("update public.feedback set status = 'letta' where id = any($1)", [rows.map((r) => r.id)]);
console.log(`\n${rows.length} segnalazioni${mark && rows.length ? " (segnate come lette)" : ""}.`);
await c.end();
