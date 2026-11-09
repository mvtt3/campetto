// Esporta i dati del Campetto in public/dati-locali.json, per far girare l'app sul computer con i
// dati veri e senza database: npm run dev, poi http://localhost:3000/?mock=dati
//
// Uso: PGPW='password-del-database' node scripts/esporta-dati.mjs
//
// Il file NON contiene: email e link d'invito, account Google (user_id), foto profilo caricate,
// iscrizioni alle notifiche, codici segreti, segnalazioni, salvataggi del gioco.
// Contiene i nomi e le statistiche del gruppo: resta fuori dal repository (.gitignore).
import fs from "node:fs";
import pg from "pg";

const SITE = process.env.SITO ?? "https://campetto.vercel.app";
const c = new pg.Client({
  host: "aws-1-eu-west-3.pooler.supabase.com",
  port: 5432,
  user: "postgres.kniylvcfeckeabsjbzbe",
  password: process.env.PGPW,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const rows = async (sql) => (await c.query(sql)).rows.map((r) => r.j);

const players = (await rows("select row_to_json(p) j from public.players p order by created_at")).map((p) => ({
  ...p,
  user_id: null,
  // Le figurine (preset:…) restano; le foto caricate no.
  avatar_url: p.avatar_url && p.avatar_url.startsWith("preset:") ? p.avatar_url : null,
}));
const matches = await rows(`
  select row_to_json(m)::jsonb || jsonb_build_object(
    'match_players', (select coalesce(jsonb_agg(row_to_json(mp)), '[]') from public.match_players mp where mp.match_id = m.id),
    'match_events', (select coalesce(jsonb_agg(row_to_json(e) order by e.seq), '[]') from public.match_events e where e.match_id = m.id)
  )::jsonb j
  from public.matches m order by played_at`);
const proposals = await rows(`
  select row_to_json(p)::jsonb || jsonb_build_object(
    'proposal_responses', (select coalesce(jsonb_agg(row_to_json(r)), '[]') from public.proposal_responses r where r.proposal_id = p.id)
  ) j
  from public.proposals p order by starts_at`);
const news = await rows("select row_to_json(n) j from public.news n where n.created_at <= now() order by created_at desc");
// I video degli highlights restano sul sito: in locale si guardano da lì.
const highlights = (await rows("select row_to_json(h) j from public.highlights h order by created_at desc")).map((h) => ({
  ...h,
  video_url: h.video_url?.startsWith("/") ? SITE + h.video_url : h.video_url,
  poster_url: h.poster_url?.startsWith("/") ? SITE + h.poster_url : h.poster_url,
}));
const highlight_comments = await rows("select row_to_json(x) j from public.highlight_comments x order by created_at");
const highlight_likes = await rows("select row_to_json(x) j from public.highlight_likes x");
await c.end();

const out = { esportato: new Date().toISOString(), players, matches, proposals, news, highlights, highlight_comments, highlight_likes };
const text = JSON.stringify(out);
const leak = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|googleusercontent|p256dh/);
if (leak) throw new Error(`Nel file finirebbe un dato da non esportare: ${leak[0]}`);
fs.writeFileSync(new URL("../public/dati-locali.json", import.meta.url), text);
console.log(
  `public/dati-locali.json: ${players.length} giocatori, ${matches.length} partite, ${proposals.length} proposte, ` +
    `${news.length} notizie, ${highlights.length} highlights (${(text.length / 1024).toFixed(0)} KB)`,
);
