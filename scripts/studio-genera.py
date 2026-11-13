"""Studio Campetto: dalla scaletta (battute + grafiche) alla puntata pronta per l'app.

Per ogni battuta genera la voce (voci neurali italiane gratuite di Edge: Giuseppe e Isabella),
con i tempi di ogni parola per i sottotitoli e l'apertura della bocca fotogramma per fotogramma.
Mette in fila sigla, battute, grafiche, replay e chiusura, e mixa voci e musica:
voci pulite e compresse, musica senza bassi pesanti che si abbassa sotto le voci (ducking),
loudness finale -15 LUFS con picchi sotto -1,5 dBTP, come i video brevi sui social.

Uso: python3 scripts/studio-genera.py scaletta.json cartella-uscita musica.mp3

Serve: pip install edge-tts soundfile numpy, e ffmpeg. La scaletta (con i dati della serata)
e l'uscita restano fuori dal repository: vanno in public/studio solo sul computer da cui si
pubblica, come i video in public/h.
"""
import asyncio, hashlib, json, os, re, subprocess, sys
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

src, out, music_path = sys.argv[1], sys.argv[2], sys.argv[3]
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


async def tts(voice, text, rate, pitch):
    key = hashlib.sha1(f"{voice}|{rate}|{pitch}|{text}".encode()).hexdigest()[:16]
    mp3, meta = os.path.join(cache, key + ".mp3"), os.path.join(cache, key + ".json")
    if not (os.path.exists(mp3) and os.path.exists(meta)):
        c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
        words = []
        with open(mp3, "wb") as f:
            async for ch in c.stream():
                if ch["type"] == "audio":
                    f.write(ch["data"])
                elif ch["type"] == "WordBoundary":
                    words.append([ch["text"], ch["offset"] / 1e7, (ch["offset"] + ch["duration"]) / 1e7])
        json.dump(words, open(meta, "w"), ensure_ascii=False)
    return mp3, json.load(open(meta))


def clean_voice(mp3):
    """Voce pulita: via i bassi inutili, compressione leggera, un filo di presenza."""
    wav = mp3[:-4] + ".wav"
    if not os.path.exists(wav):
        run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-af",
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


async def main():
    voices = plan["voices"]
    t = plan.get("intro", 4.5)
    lines, shots, props, cues = [], [], [], []
    voice_track = []
    music_marks = []
    screens = []
    replay = None
    for si, seg in enumerate(plan["segments"]):
        screen = dict(seg["screen"])
        screens.append(screen)
        if si:
            t += SEG_GAP - GAP
        seg_start = t
        cur = seg["cam"]
        shots.append({"t": round(seg_start, 3), "cam": cur, "screen": si})
        if screen["kind"] != "sigla":
            cues.append({"t": round(seg_start, 3), "kind": "whoosh"})
        for line in seg["lines"]:
            text = line["text"]
            say = line.get("say", text)
            mp3, words = await tts(voices[line["who"]], say, line.get("rate", DEFAULT_RATE), line.get("pitch", "+0Hz"))
            a = clean_voice(mp3)
            # Via i silenzi in testa e in coda (le pause le decide la scaletta).
            env = np.abs(a)
            on = np.where(env > 0.012)[0]
            s0 = max(0, on[0] - int(0.02 * SR)) if len(on) else 0
            s1 = min(len(a), on[-1] + int(0.06 * SR)) if len(on) else len(a)
            a = a[s0:s1]
            shift = s0 / SR
            d = len(a) / SR
            # Le parole: tempi relativi all'inizio della battuta; i nomi come nel testo scritto.
            # Edge toglie la punteggiatura: la si riprende dal testo, così i sottotitoli
            # vanno a capo a fine frase e alle virgole, e i soprannomi restano scritti come nel testo anche se la pronuncia è diversa.
            shown = text.split()
            spoken = say.split()
            if len(shown) != len(spoken):
                shown = spoken
            norm = lambda x: re.sub(r"[^\w']", "", x.lower())
            ws = []
            j = 0
            for w, a0, a1 in words:
                k = next((k for k in range(j, min(j + 4, len(spoken))) if norm(spoken[k]) == norm(w)), None)
                if k is not None:
                    w = shown[k]
                    j = k + 1
                ws.append([w, round(max(0, a0 - shift), 3), round(max(0, a1 - shift), 3)])
            cam = line.get("cam", seg["cam"])
            if cam != cur:
                shots.append({"t": round(t, 3), "cam": cam, "screen": si})
                cur = cam
            lines.append({"who": line["who"], "t": round(t, 3), "d": round(d, 3), "text": text, "mouth": mouth(a), "words": ws})
            if line.get("act"):
                props.append({"t": round(t + 0.3, 2), "who": line["who"], "act": line["act"]})
            voice_track.append((t, a))
            if line.get("camDur") and cam != seg["cam"]:
                shots.append({"t": round(t + line["camDur"], 3), "cam": seg["cam"], "screen": si})
                cur = seg["cam"]
            t += d + line.get("gap", GAP)
        if seg.get("replay"):
            # I canestri, interi: ogni clip dall'inizio alla fine, uno dopo l'altro, a tutto schermo.
            r0 = t - GAP + 0.25
            shots.append({"t": round(r0, 3), "cam": "replay", "screen": si})
            cues.append({"t": round(r0, 3), "kind": "whoosh"})
            ct = r0
            for c in screen["clips"]:
                c["t"] = round(ct, 3)
                ct += c["to"] - c["from"]
            music_marks.append((r0, ct, 0.55))
            t = ct + 0.35
    last_voice = lines[-1]["t"] + lines[-1]["d"]
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
    run(["ffmpeg", "-v", "error", "-y", "-i", raw_wav, "-af",
         f"loudnorm=I=-15:TP=-1.5:LRA=9:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
         f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true,"
         # Il limitatore tiene i picchi sotto -1,5 dBTP anche dove la correzione lineare non basta.
         f"aresample=192000,alimiter=limit=0.8:attack=3:release=60:level=false,aresample={SR}",
         "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", os.path.join(out, audio_name)])

    show = {
        "v": 2,
        "id": plan["id"],
        "day": plan["day"],
        "hosts": plan["hosts"],
        "audio": f"/studio/{audio_name}",
        "duration": duration,
        "intro": plan.get("intro", 4.5),
        "outro": {"t": outro_t, "next": plan.get("next")},
        "credits": "Musica: «Werq» di Kevin MacLeod (incompetech.com), licenza CC BY 4.0",
        "screens": screens,
        "shots": shots,
        "lines": lines,
        "props": props,
    }
    json.dump(show, open(os.path.join(out, f"{plan['id']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"id": plan["id"], "day": plan["day"], "duration": duration}, open(os.path.join(out, "ultima.json"), "w"))
    check = run(["ffmpeg", "-v", "info", "-i", os.path.join(out, audio_name), "-af", "loudnorm=print_format=json", "-f", "null", "-"]).stderr.decode()
    cj = json.loads(check[check.rindex("{"): check.rindex("}") + 1])
    print("durata", duration, "battute", len(lines), "inquadrature", len(shots), "LUFS", cj["input_i"], "picco", cj["input_tp"])


asyncio.run(main())
