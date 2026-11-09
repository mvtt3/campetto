// Gli highlights di una partita: dai tiri trovati da tiri.py prende solo i canestri e li monta uno
// dopo l'altro, al massimo 40 secondi, senza audio (nell'app c'è la musica), con dissolvenze brevi.
//
// Uso: node scripts/video/highlights.mjs partita.mp4 tiri.json cartella-uscita
// Scrive: <id>.mp4, <id>.jpg (copertina) e highlight.json (durata, canestri, descrizione),
// pronti per la tabella highlights dell'app. Servono ffmpeg e ffprobe.
//
// Facoltativi: NOROT=1 per i video salvati con la rotazione sbagliata; DESCRIZIONE per scrivere
// la frase a mano; GEMINI_API_KEY per farla scrivere a Gemini (senza, ne fa una semplice).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";

const [, , video, shotsFile, outDir] = process.argv;
if (!video || !shotsFile || !outDir) {
  console.error("Uso: node scripts/video/highlights.mjs partita.mp4 tiri.json cartella-uscita");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });
// -display_rotation 0 azzera l'etichetta di rotazione sbagliata, così non finisce nell'mp4.
const NR = process.env.NOROT === "1" ? ["-display_rotation", "0"] : [];
const MAX = 40, XF = 0.22, POST = 0.9, PRE_MAX = 3.6, PRE_MIN = 1.5;
const probe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const dur = probe(video);

// tiri.json di tiri.py ({ tiri: [{ t, dentro, da }] }) oppure un elenco già scelto ([{ entra }]).
const raw = JSON.parse(readFileSync(shotsFile, "utf8"));
const list = (Array.isArray(raw) ? raw : raw.tiri.filter((s) => s.dentro).map((s) => ({ entra: s.t, da: s.da })))
  .sort((a, b) => a.entra - b.entra);
if (!list.length) throw new Error("nessun canestro da montare");

// Quanto prima del canestro si parte: il tiro e un attimo di costruzione; se si sfora, si stringe.
const want = list.map((c) => Math.min(PRE_MAX, Math.max(PRE_MIN, (c.tiro ? c.entra - c.tiro : 1.6) + 1.8)));
let scale = 1;
const total = (k) => want.reduce((s, p) => s + Math.max(PRE_MIN, p * k) + POST, 0) - XF * (list.length - 1);
while (total(scale) > MAX && scale > 0.3) scale -= 0.02;
const segs = list.map((c, i) => {
  const pre = Math.max(PRE_MIN, want[i] * scale);
  const s = Math.max(0, c.entra - pre), e = Math.min(dur, c.entra + POST);
  return { ...c, s, e, len: e - s };
});
// Due canestri attaccati (un tap-in subito dopo): il secondo parte dove finisce il primo.
for (let i = 1; i < segs.length; i++) if (segs[i].s < segs[i - 1].e) { segs[i].s = segs[i - 1].e; segs[i].len = segs[i].e - segs[i].s; }

const id = "hl_" + randomBytes(6).toString("hex");
const out = join(outDir, `${id}.mp4`);
const args = ["-y", "-v", "error"];
for (const g of segs) args.push("-ss", g.s.toFixed(3), "-t", g.len.toFixed(3), ...NR, "-i", video);
const parts = segs.map((_, i) => `[${i}:v]scale=1280:720:flags=lanczos:out_range=tv,hqdn3d=1.2:1.2:5:5,fps=30,format=yuv420p,setpts=PTS-STARTPTS[v${i}]`);
let chain = "[v0]", offset = segs[0].len - XF;
const starts = [0];
for (let i = 1; i < segs.length; i++) {
  parts.push(`${chain}[v${i}]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}[x${i}]`);
  starts.push(offset);
  chain = `[x${i}]`;
  offset += segs[i].len - XF;
}
args.push("-filter_complex", parts.join(";"), "-map", segs.length > 1 ? chain : "[v0]", "-an", "-pix_fmt", "yuv420p", "-color_range", "tv",
  "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-maxrate", "3200k", "-bufsize", "6400k",
  "-profile:v", "high", "-level", "4.0", "-g", "30", "-keyint_min", "15", "-movflags", "+faststart", out);
execFileSync("ffmpeg", args, { stdio: ["ignore", "inherit", "inherit"] });
const length = probe(out);

// La copertina: l'ultimo canestro, un attimo prima che entri.
const last = segs[segs.length - 1];
execFileSync("ffmpeg", ["-y", "-v", "error", "-ss", String(Math.max(0, last.entra - 0.4)), ...NR, "-i", video, "-frames:v", "1",
  "-vf", "scale=640:-2,hqdn3d=1.2:1.2:5:5", "-q:v", "5", join(outDir, `${id}.jpg`)]);

let description = process.env.DESCRIZIONE || `${segs.length} canestri, uno dopo l'altro.`;
if (!process.env.DESCRIZIONE && process.env.GEMINI_API_KEY) {
  try {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
      method: "POST", signal: AbortSignal.timeout(60000),
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text:
        `Scrivi UNA frase in italiano (massimo 130 caratteri), viva, da telecronista di basket di strada, per un video di ${segs.length} canestri di una partita al campetto tra amici. Niente nomi, hashtag o emoji.` }] }],
        generationConfig: { temperature: 0.7 } }),
    });
    const t = (await r.json()).candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim().replace(/^"|"$/g, "");
    if (t && t.length <= 200) description = t;
  } catch { /* resta quella semplice */ }
}

const meta = {
  id, video: `${id}.mp4`, poster: `${id}.jpg`, duration: +length.toFixed(2), description,
  clips: segs.map((c, i) => ({ t: +starts[i].toFixed(2), punti: 2, come: c.da ?? "", descrizione: "canestro" })),
};
writeFileSync(join(outDir, "highlight.json"), JSON.stringify(meta, null, 2));
console.log(`fatto: ${out} — ${segs.length} canestri, ${length.toFixed(1)} s`);
