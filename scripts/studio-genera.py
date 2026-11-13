"""Studio Campetto: dalla scaletta (battute + grafiche) alla puntata pronta per l'app.

Per ogni battuta genera la voce, con i tempi di ogni parola per i sottotitoli e l'apertura della
bocca fotogramma per fotogramma. Due motori: Edge (voci neurali gratuite, per battuta) oppure, con
"tts": "gemini" nella scaletta, Gemini TTS (più naturale, con la regia in "regia"): il dialogo si
genera a pezzi da una o due voci sul PC con la chiave (gemini-batch.mjs), e qui si ritrovano
battute e parole col riconoscimento vocale (faster-whisper). Prima volta: scrive tts-jobs.json ed
esce; si lancia gemini-batch.mjs, si copiano i .wav in <uscita>/gemini e si rilancia.
Mette in fila sigla, battute, grafiche, replay e chiusura, e mixa voci e musica:
voci pulite e compresse, musica senza bassi pesanti che si abbassa sotto le voci (ducking),
loudness finale -15 LUFS con picchi sotto -1,5 dBTP, come i video brevi sui social.

Uso: python3 scripts/studio-genera.py scaletta.json cartella-uscita musica.mp3 [cartella-public]

L'ospite: un giocatore delle ultime partite entra con la sua sedia, si siede tra i conduttori,
risponde con la sua voce (sempre la stessa per lui) e poi saluta ed esce; all'ingresso la musica
sale un attimo. Il replay ha una regia calcolata dal movimento: tiene dentro canestro e giocatori.
La scaletta deve parlare un po' di tutti: se un giocatore ha più di una grafica tutta per sé, o
qualcuno che ha giocato non ne ha nessuna, la puntata non si genera (STUDIO_FORZA=1 per farlo lo stesso).

Serve: pip install edge-tts soundfile numpy, e ffmpeg. La scaletta (con i dati della serata)
e l'uscita restano fuori dal repository: vanno in public/studio solo sul computer da cui si
pubblica, come i video in public/h.
"""
import asyncio, base64, difflib, hashlib, json, os, re, subprocess, sys
import numpy as np
import soundfile as sf

try:  # dietro un proxy con il suo certificato (il nostro ambiente di lavoro)
    import certifi
    if os.environ.get("SSL_CERT_FILE"):
        certifi.where = lambda: os.environ["SSL_CERT_FILE"]
except ImportError:
    pass
import edge_tts

SR = 44100
FPS = 30
GAP = 0.2         # pausa tra due battute: una conversazione, non una lettura
SEG_GAP = 0.45    # quando cambia la grafica
DEFAULT_RATE = "+10%"
WALK_IN = 3.4     # quanto ci mette l'ospite a entrare e sedersi
WALK_OUT = 2.6    # e ad alzarsi e uscire
INTRO_CUT = 1.7   # tra due grafiche: stacco su chi parla, poi zoom sulla nuova

src, out, music_path = sys.argv[1], sys.argv[2], sys.argv[3]
public_dir = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
os.makedirs(out, exist_ok=True)
cache = os.path.join(out, "voci")
os.makedirs(cache, exist_ok=True)
plan = json.load(open(src))


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, **kw)


def decode(path, channels=1):
    raw = run(["ffmpeg", "-v", "error", "-i", path, "-ac", str(channels), "-ar", str(SR), "-f", "f32le", "-"]).stdout
    a = np.frombuffer(raw, dtype=np.float32)
    return a.reshape(-1, channels) if channels > 1 else a


async def tts(voice, rate, pitch, text):
    key = hashlib.sha1(f"{voice}|{rate}|{pitch}|{text}".encode()).hexdigest()[:16]
    mp3, meta = os.path.join(cache, key + ".mp3"), os.path.join(cache, key + ".json")
    if not (os.path.exists(mp3) and os.path.exists(meta)):
        # Il servizio delle voci ogni tanto non risponde (soprattutto Giuseppe): si riprova.
        for attempt in range(8):
            try:
                c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
                words = []
                with open(mp3, "wb") as f:
                    async for ch in c.stream():
                        if ch["type"] == "audio":
                            f.write(ch["data"])
                        elif ch["type"] == "WordBoundary":
                            words.append([ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7])
                break
            except edge_tts.exceptions.NoAudioReceived:
                if attempt == 7:
                    os.remove(mp3)
                    raise
                await asyncio.sleep(1.5 + attempt * 1.5)
        json.dump(words, open(meta, "w"), ensure_ascii=False)
    return mp3, json.load(open(meta))


def clean_voice(mp3, tempo=1.0):
    """Voce pulita: via i bassi inutili, compressione leggera, un filo di presenza.
    tempo > 1 accelera un filo senza cambiare il tono (per stare nella durata giusta)."""
    wav = mp3[:-4] + (f"-t{tempo:.3f}" if tempo != 1 else "") + ".wav"
    if not os.path.exists(wav):
        run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af",
             (f"atempo={tempo:.3f}," if tempo != 1 else "") +
             "highpass=f=85,equalizer=f=3200:t=q:w=1.2:g=2,"
             "acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2",
             "-ac", "1", "-ar", str(SR), wav])
    a, _ = sf.read(wav, dtype="float32")
    return a


def mouth(a):
    """Quanto è aperta la bocca, 30 volte al secondo: una cifra 0-9 per fotogramma."""
    n = int(np.ceil(len(a) / SR * FPS))
    hop = SR // FPS
    rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    ref = np.percentile(rms, 92) or 1
    v = np.clip(rms / ref, 0, 1) ** 0.8
    return "".join(str(int(round(x * 9))) for x in v)


def balance_check():
    """
    Un po' di tutti, nessuno troppo: al massimo una grafica tutta per sé a testa, e chi ha giocato
    deve comparire almeno da qualche parte (una sua grafica, oppure in un grafico condiviso:
    torta, coppie, risultati, tiro, Elo).
    """
    played = plan.get("played") or []
    focus, seen = {}, set()
    for seg in plan["segments"]:
        scr = seg["screen"]
        pid = scr.get("playerId")
        if pid:
            if scr.get("kind") != "mvp":  # il premio della serata non toglie spazio agli altri
                focus[pid] = focus.get(pid, 0) + 1
            seen.add(pid)
        for key in ("slices", "rows"):
            for r in scr.get(key, []):
                seen.update(x for x in (r.get("playerId"), r.get("a"), r.get("b")) if x)
        for g in scr.get("games", []):
            seen.update(g.get("a", []) + g.get("b", []))
    names = plan.get("names", {})
    problems = [f"troppo spazio a {names.get(p, p[:8])}: {n} grafiche tutte sue" for p, n in focus.items() if n > 1]
    problems += [f"{names.get(p, p[:8])} non compare in nessuna grafica" for p in played if p not in seen]
    for m in problems:
        print("scaletta:", m)
    if problems and os.environ.get("STUDIO_FORZA") != "1":
        sys.exit("La scaletta va riequilibrata (o STUDIO_FORZA=1).")


def frame_clip(path, t0, t1, hoop):
    """
    La regia di una clip: dove inquadrare, momento per momento, per tenere dentro canestro e
    giocatori. La telecamera dei video è ferma: lo sfondo è la mediana dei fotogrammi, i giocatori
    quello che se ne discosta. Restituisce [secondo, centro x, larghezza, centro y] ogni 0,2 s.
    """
    W, H, F = 192, 108, 10
    raw = run(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i", path,
               "-vf", f"fps={F},scale={W}:{H},format=gray", "-f", "rawvideo", "-"]).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
    if len(fr) < 3:
        return []
    bg = np.median(fr, axis=0)
    fg = np.abs(fr - bg) > 22
    fg[:, : int(H * 0.28), :] = False  # il cielo e i fari non contano: si guarda il campo
    # Via i puntini isolati: conta i vicini (3x3) e tiene solo le zone piene.
    pad = np.pad(fg.astype(np.int8), ((0, 0), (1, 1), (1, 1)))
    nb = sum(pad[:, 1 + dy: 1 + dy + H, 1 + dx: 1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    fg = fg & (nb >= 5)
    hx, hy = hoop
    xs = np.arange(W) / W
    raw_keys = []
    for i in range(len(fr)):
        # Mezzo secondo intorno: chi si muove ora o tra poco resta dentro.
        win = fg[max(0, i - 3): i + 4].any(axis=0)
        col = win.sum(axis=0).astype(np.float32)
        row = win.sum(axis=1).astype(np.float32)
        if col.sum() < 12:
            x0, x1, py = hx - 0.1, hx + 0.25, 0.6
        else:
            c = np.cumsum(col) / col.sum()
            x0, x1 = xs[np.searchsorted(c, 0.04)], xs[min(W - 1, np.searchsorted(c, 0.96))]
            py = float((row * np.arange(H)).sum() / row.sum() / H)
        # Il canestro deve esserci quando arriva il tiro (l'ultimo secondo e mezzo della clip);
        # prima si seguono i giocatori, più da vicino.
        if i / F >= (t1 - t0) - 1.7:
            x0, x1 = min(x0, hx - 0.07), max(x1, hx + 0.07)
        x0, x1 = x0 - 0.04, x1 + 0.04
        w = float(np.clip(x1 - x0, 0.28, 1.0))
        cx = float(np.clip((x0 + x1) / 2, w / 2, 1 - w / 2))
        cy = float(np.clip((hy + py) / 2, 0.3, 0.7))
        raw_keys.append((i / F, cx, w, cy))
    a = np.array(raw_keys)
    # Movimento morbido: media mobile avanti e indietro (niente scatti), poi un punto ogni 0,2 s.
    for col_i in (1, 2, 3):
        v = a[:, col_i]
        for _ in range(3):
            v = np.convolve(np.pad(v, 3, mode="edge"), np.ones(7) / 7, mode="valid")
        a[:, col_i] = v
    return [[round(float(r[0]), 2), round(float(r[1]), 3), round(float(r[2]), 3), round(float(r[3]), 3)] for r in a[::2]]


def shift(value, delta, unit):
    """'+10%' + 4 → '+14%'; '-2Hz' + 3 → '+1Hz'."""
    n = int(re.sub(r"[^\d-]", "", value) or 0) + delta
    return f"{'+' if n >= 0 else ''}{n}{unit}"


def voice_of(who, line):
    """
    Voce, velocità e tono di una battuta. Per suonare meno meccanici il tono segue la frase:
    un'esclamazione è un po' più veloce e più alta, una domanda un filo più alta, una battuta
    lunga e informativa un po' più calma. Si può sempre forzare con "rate"/"pitch".
    """
    v = plan["voices"][who]
    if isinstance(v, str):
        v = {"voice": v}
    rate, pitch = v.get("rate", DEFAULT_RATE), v.get("pitch", "+0Hz")
    text = (line.get("say") or line["text"]).strip()
    if text.endswith("!"):
        rate, pitch = shift(rate, 4, "%"), shift(pitch, 4, "Hz")
    elif text.endswith("?"):
        rate, pitch = shift(rate, 1, "%"), shift(pitch, 3, "Hz")
    elif len(text) > 90:
        rate = shift(rate, -3, "%")
    if len(text) < 22:  # le reazioni brevi vanno di getto
        rate = shift(rate, 6, "%")
    return v["voice"], line.get("rate", rate), line.get("pitch", pitch)


# Parole che la voce di lui (multilingue) tende a dire in inglese: scritte all'italiana, con
# l'accento, le legge come un telecronista italiano. Valgono per tutte le puntate.
ITALIANO = {"assist": "àssist", "record": "rècord", "Elo": "elo", "MVP": "emvipì", "replay": "riplèi"}


def pronounce(text):
    """
    Come si dicono le parole: prima quelle prese dall'inglese (tutte in italiano), poi i nomi
    della scaletta ("pronunce", es. Orcodio → Orcodìo, Puttens → Pùttens, un soprannome detto
    come si legge). I sottotitoli restano scritti come nel testo.
    """
    for word, said in {**ITALIANO, **plan.get("pronunce", {})}.items():
        text = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", said, text, flags=re.IGNORECASE if word.islower() else 0)
    return text


TTS = plan.get("tts", "edge")
REGIA = plan.get("regia") or (
    "Profilo audio: i conduttori dello Studio Campetto, il commento serale in italiano alle partite di basket "
    "tra amici, come in uno studio sportivo televisivo italiano. Regia: tono giornalistico, professionale e "
    "misurato, voce calda e sicura, intonazione naturale e varia; energia media e costante, sempre la stessa "
    "dall'inizio alla fine; ritmo scorrevole da notiziario, né lento né affrettato; pause naturali alle virgole "
    "e ai punti. Niente enfasi teatrale, niente toni da cartone animato, niente lettura piatta o robotica. "
    "Ogni battuta, compresi i saluti finali, ha lo stesso tono, la stessa energia e lo stesso ritmo delle altre: "
    "non rallentare, non abbassare la voce, non chiudere come a fine discorso. Ogni riga è una battuta a sé, "
    "con una breve pausa prima della successiva."
)
REGIA_OSPITE = plan.get("regiaOspite") or (
    "Profilo audio: l'ospite dello Studio Campetto, un ragazzo che ha giocato la serata, intervistato dai "
    "conduttori. Parla in italiano, spontaneo e alla mano ma chiaro, con la stessa energia media e costante "
    "dall'inizio alla fine, ritmo naturale, niente enfasi teatrale e niente lettura piatta. Ogni riga è una "
    "risposta a sé, con una breve pausa prima della successiva."
)
gem_dir = os.path.join(out, "gemini")
os.makedirs(gem_dir, exist_ok=True)


def speaker_name(who):
    if who == "ospite":
        return re.sub(r"[^\w]", "", plan["guest"]["name"]) or "Ospite"
    return re.sub(r"[^\w]", "", plan["hosts"][who])


def gemini_voice(who):
    v = plan["voices"][who]
    return v.get("gemini") if isinstance(v, dict) else v


def strip_accents(x):
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", x) if unicodedata.category(c) != "Mn")


def tok(x):
    return re.sub(r"[^\w]", "", strip_accents(x.lower()))


def gemini_jobs():
    """
    Il dialogo per Gemini, in poche richieste perché la voce resti uguale dall'inizio alla fine
    (ogni richiesta interpreta la regia a modo suo): tutte le battute dei conduttori insieme (al
    massimo 24 per richiesta), quelle dell'ospite in una richiesta sua, il coro a parte (una
    richiesta per voce). Ogni pezzo ha un id dal suo contenuto: se il .wav c'è già non si rifà.
    """
    hosts, guest_lines, chunks = [], [], []
    for si, seg in enumerate(plan["segments"]):
        for li, line in enumerate(seg["lines"]):
            say = pronounce(line.get("say") or line["text"])
            if line.get("with"):
                chunks.append({"coro": True, "lines": [(si, li, line["who"], say)], "who": [line["who"], *line["with"]]})
            elif line["who"] == "ospite":
                guest_lines.append((si, li, "ospite", say))
            else:
                hosts.append((si, li, line["who"], say))
    for k in range(0, len(hosts), 24):
        part = hosts[k:k + 24]
        chunks.append({"coro": False, "lines": part, "who": sorted({w for _, _, w, _ in part}, key=["lui", "lei"].index)})
    if guest_lines:
        chunks.append({"coro": False, "lines": guest_lines, "who": ["ospite"]})
    jobs = []
    for c in chunks:
        if c["coro"]:
            _, _, _, say = c["lines"][0]
            c["parts"] = []
            for who in c["who"]:
                prompt = (f"Fai, da solo, il tuo pezzo di un coro di attesa a due voci prima di una rivelazione in uno "
                          f"studio televisivo: una lunga O sostenuta, che cresce piano, divertita ma misurata, senza parole, "
                          f"di circa tre secondi.\n\n{say}")
                job = {"speakers": [{"name": speaker_name(who), "voice": gemini_voice(who)}], "prompt": prompt, "seed": 7}
                job["id"] = hashlib.sha1(json.dumps(job, sort_keys=True).encode()).hexdigest()[:16]
                c["parts"].append(job["id"])
                jobs.append(job)
            continue
        names = {w: speaker_name(w) for w in c["who"]}
        roles = plan.get("ruoli", {})
        if c["who"] == ["ospite"]:
            notes = REGIA_OSPITE
            body = "\n".join(say for _, _, _, say in c["lines"])
        else:
            notes = REGIA + " " + " ".join(f"{names[w]}: {roles.get(w, 'uno dei conduttori')}." for w in c["who"])
            body = "\n".join(f"{names[w]}: {say}" for _, _, w, say in c["lines"]) if len(c["who"]) > 1 else "\n".join(say for _, _, _, say in c["lines"])
        job = {"speakers": [{"name": names[w], "voice": gemini_voice(w)} for w in c["who"]], "prompt": notes + "\n\n" + body, "seed": 7}
        job["id"] = hashlib.sha1(json.dumps(job, sort_keys=True).encode()).hexdigest()[:16]
        c["parts"] = [job["id"]]
        jobs.append(job)
    return chunks, jobs


_whisper = None


def whisper_words(path):
    """Le parole dette, con inizio e fine, dal riconoscimento vocale (in cache accanto al .wav)."""
    global _whisper
    meta = path + ".words.json"
    if os.path.exists(meta):
        return json.load(open(meta))
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(os.environ.get("STUDIO_WHISPER", "small"), device="cpu", compute_type="int8")
    pcm = run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"]).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    segs, _ = _whisper.transcribe(audio, language="it", word_timestamps=True, vad_filter=False)
    words = [[w.word.strip(), float(w.start), float(w.end)] for sg in segs for w in sg.words]
    json.dump(words, open(meta, "w"), ensure_ascii=False)
    return words


def align_chunk(c):
    """
    Dal pezzo di dialogo alle battute: si allineano le parole riconosciute con quelle del copione
    (numeri e nomi detti in modo diverso si spalmano sul tratto corrispondente), poi ogni battuta
    prende il suo pezzo d'audio e i tempi delle sue parole.
    """
    path = os.path.join(gem_dir, c["parts"][0] + ".wav")
    heard = whisper_words(path)
    a, sr_in = sf.read(path, dtype="float32")
    script = [(k, w) for k, (_, _, _, say) in enumerate(c["lines"]) for w in say.split()]
    A, B = [tok(w) for _, w in script], [tok(w) for w, _, _ in heard]
    times = [None] * len(script)
    sm_ = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    for op, i1, i2, j1, j2 in sm_.get_opcodes():
        if op == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = [heard[j1 + k][1], heard[j1 + k][2]]
        elif op == "replace":
            t0, t1 = heard[j1][1], heard[j2 - 1][2]
            lens = [max(1, len(script[i][1])) for i in range(i1, i2)]
            acc, tot = 0, sum(lens)
            for n, i in enumerate(range(i1, i2)):
                times[i] = [t0 + (t1 - t0) * acc / tot, t0 + (t1 - t0) * (acc + lens[n]) / tot]
                acc += lens[n]
    # Le parole non sentite: tra la precedente e la successiva.
    for i in range(len(times)):
        if times[i] is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev + 0.3)
            times[i] = [prev, max(prev + 0.05, min(nxt, prev + 0.4))]
    total = len(a) / sr_in
    spans = []
    for k in range(len(c["lines"])):
        idx = [i for i, (kk, _) in enumerate(script) if kk == k]
        spans.append([times[idx[0]][0], times[idx[-1]][1]])
    res = []
    for k, (si, li, who, say) in enumerate(c["lines"]):
        s0 = max(0.0, spans[k][0] - 0.08)
        if k:
            s0 = max(s0, (spans[k - 1][1] + spans[k][0]) / 2)
        s1 = min(total, spans[k][1] + 0.18)
        if k + 1 < len(spans):
            s1 = min(s1, (spans[k][1] + spans[k + 1][0]) / 2)
        seg_a = a[int(s0 * sr_in):int(s1 * sr_in)]
        words = [[w, round(times[i][0] - s0, 3), round(times[i][1] - s0, 3)] for i, (kk, w) in enumerate(script) if kk == k]
        res.append((si, li, seg_a, sr_in, words))
    return res


GEM = {}


def gemini_prepare():
    """Le voci di tutta la puntata: se manca qualche pezzo scrive tts-jobs.json ed esce."""
    chunks, jobs = gemini_jobs()
    missing = [j for j in jobs if not os.path.exists(os.path.join(gem_dir, j["id"] + ".wav"))]
    if missing:
        json.dump(missing, open(os.path.join(out, "tts-jobs.json"), "w"), ensure_ascii=False, indent=1)
        sys.exit(f"Voci Gemini da generare: {len(missing)} richieste in {os.path.join(out, 'tts-jobs.json')}. "
                 f"Sul PC: node gemini-batch.mjs tts-jobs.json <cartella>, poi i .wav in {gem_dir} e si rilancia.")
    for c in chunks:
        if c["coro"]:
            si, li, who, say = c["lines"][0]
            parts = []
            for pid in c["parts"]:
                x, sr_in = sf.read(os.path.join(gem_dir, pid + ".wav"), dtype="float32")
                on = np.where(np.abs(x) > 0.01)[0]
                parts.append(x[on[0]:on[-1]] if len(on) else x)
            n = max(len(x) for x in parts)
            mix = sum(np.pad(x, (0, n - len(x))) for x in parts) * 0.72
            GEM[(si, li)] = (mix.astype(np.float32), sr_in, [[say, 0.05, round(n / sr_in - 0.1, 3)]])
        else:
            for si, li, seg_a, sr_in, words in align_chunk(c):
                GEM[(si, li)] = (seg_a, sr_in, words)


def gemini_line(si, li):
    """Il pezzo d'audio di una battuta, già pronto come file, e le sue parole (tempi dal suo inizio)."""
    seg_a, sr_in, words = GEM[(si, li)]
    key = hashlib.sha1(seg_a.tobytes()).hexdigest()[:16]
    raw = os.path.join(cache, f"g-{key}-raw.flac")
    if not os.path.exists(raw):
        sf.write(raw, seg_a, sr_in)
    return raw, words


def sign_off():
    """Ogni puntata finisce con la firma dei due conduttori, dopo i saluti."""
    if plan.get("firma") is False:
        return
    last = plan["segments"][-1]["lines"]
    if any("Un saluto da" in l["text"] for l in last):
        return
    lui, lei = plan["hosts"]["lui"], plan["hosts"]["lei"]
    last[-1].setdefault("gap", 0.25)
    # Tutti e due inquadrati insieme, per entrambe le metà della firma.
    last += [
        {"who": "lui", "cam": "coppia", "text": f"Un saluto da {lui}…", "gap": 0.04},
        {"who": "lei", "cam": "coppia", "text": f"…e {lei}!"},
    ]


async def main():
    balance_check()
    sign_off()
    if TTS == "gemini":
        gemini_prepare()
    line_t = {}
    t = plan.get("intro", 4.5)
    lines, shots, props, cues = [], [], [], []
    # Dopo la sigla: l'inquadratura larga sullo studio col logo sul maxischermo e le targhe dei due
    # conduttori; si comincia a parlare dopo (le presentazioni sono fatte).
    opening = plan.get("apertura", 3.4)
    if opening:
        shots.append({"t": round(t, 3), "cam": "ampio", "screen": 0})
        t += opening
    voice_track = []
    music_marks = []
    screens = []
    guest = None
    cur = "coppia"
    shown_screen = 0
    for si, seg in enumerate(plan["segments"]):
        screen = dict(seg["screen"])
        screens.append(screen)
        if si:
            t += SEG_GAP - GAP
        seg_start = t
        lines_in = [dict(l) for l in seg["lines"]]
        # Tra due grafiche non si passa da una all'altra a tutto schermo: si stacca su chi parla,
        # e la grafica nuova arriva con lo zoom (così si vede entrare, dall'inizio).
        if seg["cam"] == "schermo" and cur in ("schermo", "replay") and lines_in and "cam" not in lines_in[0]:
            lines_in[0]["cam"] = lines_in[0]["who"] if lines_in[0]["who"] in ("lui", "lei") else "trio"
            lines_in[0]["camDur"] = INTRO_CUT
        # Finché la telecamera non va sul maxischermo resta la grafica di prima.
        first_cam = lines_in[0].get("cam", seg["cam"]) if lines_in else seg["cam"]
        hold = seg["cam"] == "schermo" and first_cam != "schermo" and si > 0
        scr_now = shown_screen if hold else si
        cur = first_cam
        shots.append({"t": round(seg_start, 3), "cam": cur, "screen": scr_now})
        if not hold and screen["kind"] != "sigla":
            cues.append({"t": round(seg_start, 3), "kind": "whoosh"})
        shown_screen = scr_now
        entering = seg.get("guest") in ("enter", "both")
        if entering:
            g = plan["guest"]
            guest = {"playerId": g["playerId"], "name": g["name"], "enter": round(seg_start, 3), "sit": round(seg_start + WALK_IN, 3)}
            t = seg_start + 0.35
        for li, line in enumerate(lines_in):
            text = line["text"]
            say = pronounce(line.get("say") or text)
            if line["who"] == "ospite" and guest and t < guest["sit"] + 0.15:
                t = guest["sit"] + 0.15  # parla da seduto
            if TTS == "gemini":
                mp3, words = gemini_line(si, li)
                tempo = float(plan.get("tempo", 1.0))
                if tempo != 1:
                    words = [[w, w0 / tempo, w1 / tempo] for w, w0, w1 in words]
                a = clean_voice(mp3, tempo)
            else:
                mp3, words = await tts(*voice_of(line["who"], line), say)
                a = clean_voice(mp3)
            if TTS == "gemini":
                # Ogni richiesta esce a un volume suo: ogni battuta allo stesso livello (parti dette).
                # Prima del taglio dei silenzi, così le finali piano ("tut-ti") non vengono tagliate.
                fr = a[: len(a) // 441 * 441].reshape(-1, 441)
                r = np.sqrt((fr ** 2).mean(1))
                act = r[r > 10 ** (-45 / 20)]
                if len(act):
                    g = 10 ** (-20 / 20) / float(np.sqrt((act ** 2).mean()))
                    a = (a * min(max(g, 10 ** (-12 / 20)), 10 ** (12 / 20))).astype(np.float32)
            # Via i silenzi in testa e in coda (le pause le decide la scaletta).
            env = np.abs(a)
            on = np.where(env > 0.012)[0]
            tail = 0.14 if TTS == "gemini" else 0.06
            s0 = max(0, on[0] - int(0.02 * SR)) if len(on) else 0
            s1 = min(len(a), on[-1] + int(tail * SR)) if len(on) else len(a)
            a = a[s0:s1]
            shift = s0 / SR
            d = len(a) / SR
            # Le parole: tempi relativi all'inizio della battuta, scritte come nel testo.
            # Edge toglie la punteggiatura e legge quello che c'è in "say": si allinea il detto con
            # lo scritto (es. "ci acca quattro" → "CH4."), così i sottotitoli vanno a capo a fine
            # frase e i nomi restano come li scriviamo.
            norm = lambda x: re.sub(r"[^\w']", "", x.lower())
            shown, spoken = text.split(), say.split()
            disp = [""] * len(spoken)
            sm_ = difflib.SequenceMatcher(a=[norm(x) for x in spoken], b=[norm(x) for x in shown], autojunk=False)
            for op, i1, i2, j1, j2 in sm_.get_opcodes():
                if op == "equal" or (op == "replace" and i2 - i1 == j2 - j1):
                    for k in range(i2 - i1):
                        disp[i1 + k] = shown[j1 + k]
                elif op == "replace":
                    disp[i1] = " ".join(shown[j1:j2])
                elif op == "insert" and i1 > 0:
                    disp[i1 - 1] = (disp[i1 - 1] + " " + " ".join(shown[j1:j2])).strip()
            ws = []
            j = 0
            for w, a0, a1 in words:
                k = next((k for k in range(j, min(j + 4, len(spoken))) if norm(spoken[k]) == norm(w)), None)
                a0, a1 = round(max(0, a0 - shift), 3), round(max(0, a1 - shift), 3)
                if k is not None:
                    j = k + 1
                    if not disp[k]:
                        if ws:
                            ws[-1][2] = a1  # parola detta in più: allunga quella scritta prima
                        continue
                    w = disp[k]
                ws.append([w, a0, a1])
            cam = line.get("cam", seg["cam"])
            if cam != cur:
                # camDelay: lo stacco arriva a battuta già iniziata (la grafica resta un po' di più).
                ts = t + line.get("camDelay", 0)
                if cam == "schermo" and shown_screen != si:
                    shown_screen = si
                    cues.append({"t": round(ts, 3), "kind": "whoosh"})
                shots.append({"t": round(ts, 3), "cam": cam, "screen": shown_screen})
                cur = cam
            out_line = {"who": line["who"], "t": round(t, 3), "d": round(d, 3), "text": text, "mouth": mouth(a), "words": ws}
            if line.get("with"):
                out_line["with"] = line["with"]  # il coro: si muove la bocca a tutti
            lines.append(out_line)
            line_t[(si, li)] = t
            if line.get("act") and line["who"] in ("lui", "lei"):
                props.append({"t": round(t + 0.3, 2), "who": line["who"], "act": line["act"]})
            voice_track.append((t, a))
            if line.get("camDur") and cam != seg["cam"]:
                back = seg["cam"]
                if back == "schermo" and shown_screen != si:
                    shown_screen = si
                    cues.append({"t": round(t + line["camDur"], 3), "kind": "whoosh"})
                shots.append({"t": round(t + line["camDur"], 3), "cam": back, "screen": shown_screen})
                cur = back
            if entering and li == 0:
                # L'ospite arriva mentre lo presentano: si siede appena detto il suo nome.
                guest["enter"] = round(max(seg_start, t + d + 0.25 - WALK_IN), 3)
                guest["sit"] = round(guest["enter"] + WALK_IN, 3)
                # La musica sale un attimo per l'ingresso, poi torna sotto le voci.
                music_marks.append((guest["enter"] - 0.1, guest["enter"] + 2.4, 0.5))
            t += d + line.get("gap", GAP)
        if seg.get("guest") in ("exit", "both") and guest:
            # Saluti fatti: si alza, riprende la sedia ed esce; intanto la puntata va avanti.
            guest["rise"] = round(t - GAP + 0.25, 3)
            guest["exit"] = round(guest["rise"] + WALK_OUT, 3)
            music_marks.append((guest["rise"], guest["exit"] - 0.6, 0.42))
            t = guest["rise"] + seg.get("afterExit", 1.3)
        if seg.get("replay"):
            # Due modi. Classico: i canestri, interi, uno dopo l'altro a tutto schermo dopo le battute.
            # "muro": le azioni passano già sul maxischermo mentre si parla (dall'inizio del pezzo);
            # finite le battute la telecamera entra nel maxischermo e le azioni vanno a tutto schermo,
            # al massimo "pieno" secondi (15), poi si stacca. Nessuno le annuncia.
            muro = seg.get("replay") == "muro"
            if muro:
                zoom_t = t - GAP + 0.2
                shots.append({"t": round(zoom_t, 3), "cam": "schermo", "screen": si})
                r0 = zoom_t + 1.0
                ct = seg_start
            else:
                r0 = t - GAP + 0.25
                ct = r0
            shots.append({"t": round(r0, 3), "cam": "replay", "screen": si})
            cues.append({"t": round(r0, 3), "kind": "whoosh"})
            for c in screen["clips"]:
                c["t"] = round(ct, 3)
                path = os.path.join(public_dir, c["src"].lstrip("/"))
                hoop = tuple(c.pop("hoop", (0.2, 0.25)))
                if os.path.exists(path):
                    c["cam"] = frame_clip(path, c["from"], c["to"], hoop)
                    # Lo sfondo sfocato: un fotogramma a metà clip, 48×27, come immagine dentro il JSON.
                    jpg = run(["ffmpeg", "-v", "error", "-ss", f"{(c['from'] + c['to']) / 2:.2f}", "-i", path, "-frames:v", "1",
                               "-vf", "scale=48:27,gblur=sigma=1.2", "-q:v", "6", "-f", "image2", "-c:v", "mjpeg", "-"]).stdout
                    c["bg"] = "data:image/jpeg;base64," + base64.b64encode(jpg).decode()
                else:
                    print("replay: video non trovato, si vede il campo intero:", path)
                ct += c["to"] - c["from"]
            end_r = min(ct, r0 + seg.get("pieno", 15)) if muro else ct
            if muro and ct < r0 + 3:
                print("replay muro: poche azioni dopo lo zoom (servono più clip o battute più corte)")
            music_marks.append((r0, end_r, 0.55))
            t = end_r + 0.35
            cur = "replay"  # dopo il replay si torna in studio con uno stacco su chi parla
    # MVP: "reveal": {"line": n} = la rivelazione arriva con la battuta n del suo pezzo, a zoom finito.
    for si, scr in enumerate(screens):
        rv = scr.get("reveal")
        if scr.get("kind") == "mvp" and isinstance(rv, dict):
            since = min(sh["t"] for sh in shots if sh["screen"] == si)
            target = line_t[(si, rv["line"])] + rv.get("after", 1.0)
            scr["reveal"] = round(max(3.2, target - since), 2)
    last_voice = lines[-1]["t"] + lines[-1]["d"]
    end_move = plan.get("allargata", 2.4)
    if end_move:
        # Finiti i saluti la telecamera si allarga piano fino all'inquadratura dell'apertura (il logo
        # sul maxischermo), poi la sigla di chiusura.
        shots.append({"t": round(last_voice + 0.35, 3), "cam": "ampio", "screen": shots[-1]["screen"], "move": end_move})
        last_voice += 0.35 + end_move + 0.5
    outro_t = round(last_voice + 0.4, 3)
    duration = round(outro_t + plan.get("outro", 5.0), 2)
    shots.append({"t": outro_t, "cam": "fine", "screen": len(screens) - 1})
    cues.append({"t": outro_t, "kind": "whoosh"})

    total = int(np.ceil(duration * SR)) + SR
    voice = np.zeros(total, dtype=np.float32)
    for start, a in voice_track:
        i = int(start * SR)
        voice[i:i + len(a)] += a

    # Effetti: un fruscio leggero quando cambia la grafica (rumore filtrato che sale e scende).
    sfx = np.zeros(total, dtype=np.float32)
    rng = np.random.default_rng(7)
    n = int(0.42 * SR)
    noise = rng.standard_normal(n).astype(np.float32)
    # Passa-banda che sale: si ottiene con una media mobile che si accorcia (semplice e morbido).
    sweep = np.zeros(n, dtype=np.float32)
    acc = 0.0
    for i in range(n):
        k = 0.02 + 0.5 * (i / n) ** 2
        acc += k * (noise[i] - acc)
        sweep[i] = noise[i] - acc
    envw = np.sin(np.linspace(0, np.pi, n)) ** 2
    whoosh = (sweep * envw).astype(np.float32)
    whoosh /= np.max(np.abs(whoosh)) or 1
    for c in cues:
        i = int(max(0, c["t"] - 0.25) * SR)
        sfx[i:i + n] += whoosh * 0.05

    # Musica: tagliati i bassi pesanti, dinamica più uniforme.
    mus_file = os.path.join(out, "musica.wav")
    run(["ffmpeg", "-v", "error", "-y", "-i", music_path, "-t", str(duration + 1), "-af",
         "highpass=f=110,equalizer=f=220:t=q:w=1:g=-4,equalizer=f=3000:t=q:w=1.5:g=-3,"
         "acompressor=threshold=-18dB:ratio=2.5:attack=20:release=250",
         "-ac", "2", "-ar", str(SR), mus_file])
    m, _ = sf.read(mus_file, dtype="float32")
    if len(m) < total:
        m = np.concatenate([m, np.zeros((total - len(m), 2), dtype=np.float32)])
    m = m[:total]

    # Volume della musica nel tempo: piena in sigla e nei replay, bassa sotto le voci (-20 dB circa),
    # e in più si abbassa da sola quando qualcuno parla (ducking dall'inviluppo della voce).
    hop = SR // 100
    venv = np.array([np.sqrt(np.mean(voice[i:i + hop] ** 2)) for i in range(0, total, hop)])
    speaking = (venv > 0.01).astype(np.float32)
    # Attacco veloce, rilascio lento: niente "pompaggio".
    sm = np.zeros_like(speaking)
    for i in range(len(speaking)):
        prev = sm[i - 1] if i else 0
        sm[i] = prev + (speaking[i] - prev) * (0.35 if speaking[i] > prev else 0.025)
    base = np.full(len(sm), 0.32, dtype=np.float32)       # tra una battuta e l'altra
    duck = 0.13                                            # mentre parlano
    intro_end = plan.get("intro", 4.5)
    first = lines[0]["t"]
    for i in range(len(base)):
        ts = i / 100
        if ts < intro_end - 0.3:
            base[i] = 0.9
        elif ts < first:
            base[i] = 0.9 + (0.32 - 0.9) * min(1, (ts - (intro_end - 0.3)) / max(0.3, first - intro_end + 0.3))
        for a0, b0, v in music_marks:
            if a0 - 0.5 <= ts <= b0 + 0.5:
                u = min(1, (ts - (a0 - 0.5)) / 0.5, (b0 + 0.5 - ts) / 0.5)
                base[i] = max(base[i], 0.32 + (v - 0.32) * u)
        if ts >= outro_t - 0.2:
            base[i] = max(base[i], 0.32 + (0.8 - 0.32) * min(1, (ts - outro_t + 0.2) / 0.6))
        if ts > duration - 1.6:
            base[i] *= max(0, (duration - ts) / 1.6)
    gain = base * (1 - sm) + np.minimum(base, duck) * sm
    gain = np.repeat(gain, hop)[:total]
    mix = m * gain[:, None] + (voice + sfx)[:, None] * 1.0
    mix[: int(0.15 * SR)] *= np.linspace(0, 1, int(0.15 * SR))[:, None]
    mix = mix[: int(duration * SR)]
    raw_wav = os.path.join(out, "mix-grezzo.wav")
    sf.write(raw_wav, mix, SR)

    # Loudness finale in due passaggi (misura, poi correzione lineare): -15 LUFS, picchi sotto -1,5 dBTP.
    meas = run(["ffmpeg", "-v", "info", "-i", raw_wav, "-af", "loudnorm=I=-15:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"]).stderr.decode()
    js = json.loads(meas[meas.rindex("{"): meas.rindex("}") + 1])
    audio_name = f"{plan['id']}.m4a"
    # Guadagno fisso fino a -15 LUFS, poi il limitatore (a 192 kHz, così prende anche i picchi
    # tra un campione e l'altro). Dopo la compressione AAC i picchi possono risalire: si misura e,
    # se serve, si limita un po' di più.
    gain = -15.0 - float(js["input_i"])
    for limit in (0.74, 0.66, 0.58, 0.5):
        run(["ffmpeg", "-v", "error", "-y", "-i", raw_wav, "-af",
             f"volume={gain:.2f}dB,aresample=192000,alimiter=limit={limit}:attack=2:release=80:level=false,aresample={SR}",
             "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", os.path.join(out, audio_name)])
        chk = run(["ffmpeg", "-v", "info", "-i", os.path.join(out, audio_name), "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr.decode()
        tp = float(json.loads(chk[chk.rindex("{"): chk.rindex("}") + 1])["input_tp"])
        if tp <= -1.5:
            break

    show = {
        "v": 2,
        "id": plan["id"],
        "day": plan["day"],
        "hosts": plan["hosts"],
        "audio": f"/studio/{audio_name}",
        "duration": duration,
        "intro": plan.get("intro", 4.5),
        "opening": opening,
        "outro": {"t": outro_t, "next": plan.get("next")},
        "credits": "Musica: «Werq» di Kevin MacLeod (incompetech.com), licenza CC BY 4.0"
        + (". Le risposte dell'ospite sono inventate per gioco." if guest else ""),
        "screens": screens,
        "shots": shots,
        "lines": lines,
        "props": props,
        "guest": guest,
    }
    json.dump(show, open(os.path.join(out, f"{plan['id']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    entry = {"id": plan["id"], "day": plan["day"], "duration": duration}
    json.dump(entry, open(os.path.join(out, "ultima.json"), "w"))
    # L'elenco di tutte le puntate (una per serata): si aggiunge o si aggiorna questa, dalla più recente.
    try:
        episodes = json.load(open(os.path.join(public_dir, "studio", "puntate.json")))
    except (OSError, ValueError):
        episodes = []
    # Una puntata per serata: una nuova versione dello stesso giorno prende il posto della vecchia.
    episodes = sorted([e for e in episodes if e.get("id") != plan["id"] and e.get("day") != plan["day"]] + [entry], key=lambda e: e["day"], reverse=True)
    json.dump(episodes, open(os.path.join(out, "puntate.json"), "w"))
    check = run(["ffmpeg", "-v", "info", "-i", os.path.join(out, audio_name), "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr.decode()
    cj = json.loads(check[check.rindex("{"): check.rindex("}") + 1])
    print("durata", duration, "battute", len(lines), "inquadrature", len(shots), "LUFS", cj["input_i"], "picco", cj["input_tp"])


asyncio.run(main())
