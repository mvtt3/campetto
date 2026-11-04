// Manda un avviso a tutti quelli che hanno le notifiche dell'app (lo invia il giro di
// ogni 10 minuti, solo di giorno, una volta per telefono). Pensato per Claude o Matteo, dal PC.
//
// Pioggia sulla partita di oggi (guarda le previsioni e scrive il messaggio da solo):
//   PGPW='password-del-database' node scripts/avviso.mjs meteo            ← solo anteprima
//   PGPW='password-del-database' node scripts/avviso.mjs meteo --invia    ← lo manda
//   (--forza lo manda anche se la pioggia è poco probabile)
//
// Un avviso scritto a mano (facoltativo il link dentro l'app):
//   PGPW='…' node scripts/avviso.mjs testo "Titolo" "Testo" [/organizza] --invia
//
// Rispetta l'interruttore "Promemoria partite" di ognuno. Se l'avviso riguarda una
// proposta, la notifica ha i bottoni "Ci sono" e "No" (la risposta arriva nell'app).

const NICHELINO = { lat: 44.995, lon: 7.646 };
const PLACE = { niche: "al Niche", decathlon: "al Decathlon", indoor: "al campetto indoor" };

const args = process.argv.slice(2);
const send = args.includes("--invia");
const force = args.includes("--forza");
const rest = args.filter((a) => !a.startsWith("--"));
const mode = rest[0];

/** Ore e minuti all'ora italiana: "18" se è in punto, altrimenti "18:30". */
export function hourLabel(iso) {
  const t = new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  return t.endsWith(":00") ? String(Number(t.slice(0, 2))) : t;
}

/** Il giorno (AAAA-MM-GG) all'ora italiana. */
export function romeDay(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(d);
}

const RAINY = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;

/**
 * Il messaggio sul meteo di una partita: prima il fatto e l'ora (come le app meteo),
 * poi una sola domanda. `hours`: le ore attorno all'inizio, con probabilità e codice WMO.
 */
export function composeAlert(p, hours) {
  const prob = Math.max(0, ...hours.map((h) => h.prob));
  const mm = hours.reduce((a, h) => a + (h.mm || 0), 0);
  const rainy = hours.some((h) => RAINY(h.code));
  const storm = hours.some((h) => h.code >= 95);
  const hh = hourLabel(p.starts_at);
  let level = "basso";
  if (storm) level = "temporale";
  else if (prob >= 60 || (rainy && prob >= 40)) level = "pioggia";
  else if (prob >= 25 || rainy) level = "forse";
  const title =
    level === "temporale"
      ? `⛈️ Temporale previsto alle ${hh}`
      : level === "pioggia"
        ? `🌧️ Pioggia prevista alle ${hh}`
        : level === "forse"
          ? `🌦️ Alle ${hh} potrebbe piovere`
          : `☁️ Tempo incerto per le ${hh}`;
  const where = PLACE[p.place] ? ` ${PLACE[p.place]}` : "";
  const body = `Partita di oggi${where}: ci sei lo stesso? Rispondi, così sappiamo se si gioca.`;
  return { level, prob, mm: Math.round(mm * 10) / 10, title, body };
}

async function forecast(day) {
  const q = new URLSearchParams({
    latitude: String(NICHELINO.lat),
    longitude: String(NICHELINO.lon),
    hourly: "precipitation_probability,precipitation,weather_code",
    timezone: "Europe/Rome",
    start_date: day,
    end_date: day,
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!r.ok) throw new Error(`Previsioni non raggiungibili (${r.status})`);
  const j = await r.json();
  return j.hourly.time.map((t, i) => ({
    hour: Number(t.slice(11, 13)),
    prob: j.hourly.precipitation_probability[i] ?? 0,
    mm: j.hourly.precipitation[i] ?? 0,
    code: j.hourly.weather_code[i] ?? 0,
  }));
}

async function main() {
  if (!process.env.PGPW || !["meteo", "testo"].includes(mode)) {
    console.error('Uso: PGPW=… node scripts/avviso.mjs meteo [--invia] [--forza]\n     PGPW=… node scripts/avviso.mjs testo "Titolo" "Testo" [/url] [--invia]');
    process.exit(1);
  }
  const { default: pg } = await import("pg");
  const c = new pg.Client({
    host: "aws-1-eu-west-3.pooler.supabase.com",
    port: 5432,
    user: "postgres.kniylvcfeckeabsjbzbe",
    password: process.env.PGPW,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const { rows: who } = await c.query(
    `select count(*)::int as n from public.push_subscriptions s join public.players p on p.id = s.player_id
      where not p.archived and coalesce((p.notify_prefs ->> 'promemoria')::boolean, true)`,
  );
  const alerts = [];
  if (mode === "testo") {
    const [, title, body, url = "/"] = rest;
    if (!title || !body) throw new Error("Servono titolo e testo");
    alerts.push({ title, body, url, proposal_id: null, expires: null });
  } else {
    const today = romeDay(new Date());
    const { rows } = await c.query(
      `select p.id, p.starts_at, p.place, p.format,
              (select count(*) from public.proposal_responses r where r.proposal_id = p.id and r.response = 'si')::int as yes
         from public.proposals p
        where p.status = 'aperta'
          and p.starts_at > now()
          and (p.starts_at at time zone 'Europe/Rome')::date = $1::date
        order by p.starts_at`,
      [today],
    );
    if (!rows.length) console.log("Oggi non ci sono partite in programma.");
    const hours = rows.some((r) => r.place !== "indoor") ? await forecast(today) : [];
    for (const p of rows) {
      if (p.place === "indoor") {
        console.log(`Partita delle ${hourLabel(p.starts_at)} indoor: niente avviso meteo.`);
        continue;
      }
      const h = Number(new Date(p.starts_at).toLocaleString("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Rome" }));
      const around = hours.filter((x) => x.hour >= h - 1 && x.hour <= h + 1);
      const a = composeAlert(p, around);
      console.log(`Partita delle ${hourLabel(p.starts_at)}${PLACE[p.place] ? ` ${PLACE[p.place]}` : ""} (${p.yes} ci sono)`);
      console.log(`  Previsioni ${h - 1}–${h + 1}: pioggia ${a.prob}% · ${a.mm} mm · livello ${a.level}`);
      if (a.level === "basso" && !force) {
        console.log("  Pioggia poco probabile: niente avviso (usa --forza per mandarlo lo stesso).");
        continue;
      }
      alerts.push({ title: a.title, body: a.body, url: `/organizza?giorno=${today}`, proposal_id: p.id, expires: p.starts_at });
    }
  }
  for (const a of alerts) {
    console.log(`\n  ${a.title}\n  ${a.body}\n  → ${who[0].n} telefoni con i promemoria attivi`);
    if (send) {
      await c.query(
        `insert into public.push_alerts (title, body, url, proposal_id, expires_at)
         values ($1, $2, $3, $4, coalesce($5::timestamptz, now() + interval '6 hours'))`,
        [a.title, a.body, a.url, a.proposal_id, a.expires],
      );
      console.log("  ✓ In coda: parte entro 10 minuti.");
    }
  }
  if (alerts.length && !send) console.log("\nSolo anteprima: aggiungi --invia per mandarlo.");
  await c.end();
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("avviso.mjs")) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
