"""Studio Campetto: dalla scaletta (battute + grafiche) alla puntata pronta per l'app.

Per ogni battuta genera la voce (Kokoro, gratis e in locale: if_sara per lei, im_nicola per lui),
ne misura la durata e l'apertura della bocca fotogramma per fotogramma, mette tutto in fila
(inquadrature, grafiche, clip) e mixa voci e musica in un solo audio.

Uso: python3 scripts/studio-genera.py scaletta.json cartella-uscita [public/hl-musica.m4a]

Serve: pip install kokoro-onnx soundfile, ffmpeg, e i file del modello (kokoro-v1.0.onnx e
voices-v1.0.bin, dalle release di thewh1teagle/kokoro-onnx) nella cartella KOKORO_DIR.
La scaletta (battute e grafiche con i dati della serata) e l'uscita restano fuori dal
repository: vanno in public/studio solo sul computer da cui si pubblica, come i video in public/h.
"""
import json, os, subprocess, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SR = 24000
FPS = 30
VOICE = {"lui": "im_nicola", "lei": "if_sara"}
SPEED = {"lui": 1.12, "lei": 1.12}
GAP = 0.38          # pausa tra due battute
SEG_LEAD = 0.55     # stacco quando cambia la grafica

src, out = sys.argv[1], sys.argv[2]
music_path = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
plan = json.load(open(src))
KOKORO_DIR = os.environ.get("KOKORO_DIR", os.path.expanduser("~/tts"))
k = Kokoro(os.path.join(KOKORO_DIR, "kokoro-v1.0.onnx"), os.path.join(KOKORO_DIR, "voices-v1.0.bin"))
cache = os.path.join(out, "voci")
os.makedirs(cache, exist_ok=True)


def speak(who, text, idx):
    path = os.path.join(cache, f"{idx:02d}-{who}.wav")
    meta = path + ".txt"
    key = f"{SPEED[who]}|{text}"
    if os.path.exists(path) and os.path.exists(meta) and open(meta).read() == key:
        a, _ = sf.read(path, dtype="float32")
        return a
    a, sr = k.create(text, voice=VOICE[who], speed=SPEED[who], lang="it")
    assert sr == SR
    # Via i silenzi in testa e in coda: le pause le decide la scaletta.
    env = np.abs(a)
    on = np.where(env > 0.01)[0]
    if len(on):
        a = a[max(0, on[0] - int(0.03 * SR)): on[-1] + int(0.08 * SR)]
    sf.write(path, a, SR)
    open(meta, "w").write(key)
    return a


def mouth(a):
    """Quanto è aperta la bocca, 30 volte al secondo: una cifra 0-9 per fotogramma."""
    n = int(np.ceil(len(a) / SR * FPS))
    hop = SR // FPS
    rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    ref = np.percentile(rms, 92) or 1
    v = np.clip(rms / ref, 0, 1) ** 0.8
    return "".join(str(int(round(x * 9))) for x in v)


t = 0.0
lines, shots, props = [], [], []
voice_track = []  # (inizio, campioni)
music_marks = []  # (inizio, fine, volume)
idx = 0
for si, seg in enumerate(plan["segments"]):
    seg_start = t
    screen = dict(seg["screen"])
    shots.append({"t": round(seg_start, 2), "cam": seg["cam"], "screen": si})
    t += seg.get("lead", SEG_LEAD)
    cur = seg["cam"]
    for li, line in enumerate(seg["lines"]):
        a = speak(line["who"], line.get("say", line["text"]), idx)
        idx += 1
        d = len(a) / SR
        cam = line.get("cam", seg["cam"])
        if cam != cur:
            shots.append({"t": round(max(seg_start, t - 0.3), 2), "cam": cam, "screen": si})
            cur = cam
        lines.append({"who": line["who"], "t": round(t, 3), "d": round(d, 3), "text": line["text"], "mouth": mouth(a)})
        if line.get("act"):
            props.append({"t": round(t + 0.2, 2), "who": line["who"], "act": line["act"]})
        voice_track.append((t, a))
        if line.get("camDur") and cam != seg["cam"]:
            shots.append({"t": round(t + line["camDur"], 2), "cam": seg["cam"], "screen": si})
            cur = seg["cam"]
        t += d + GAP
    if seg.get("hold"):
        hold_start = t - GAP + 0.25
        if screen.get("clips"):
            ct = hold_start
            for c in screen["clips"]:
                c["t"] = round(ct, 2)
                ct += c["dur"]
        if cur != "schermo":
            shots.append({"t": round(hold_start - 0.3, 2), "cam": "schermo", "screen": si})
        music_marks.append((hold_start - 0.4, hold_start + seg["hold"], seg.get("music", 0.5)))
        t = hold_start + seg["hold"]
    t += seg.get("tail", 0.0)
    seg["screen_out"] = screen

duration = round(t, 2)
total = int(np.ceil(duration * SR)) + SR
mix = np.zeros(total, dtype=np.float32)
for start, a in voice_track:
    i = int(start * SR)
    mix[i:i + len(a)] += a * 0.95

if music_path:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", music_path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    m = np.frombuffer(raw, dtype=np.float32)
    m = np.tile(m, int(np.ceil(total / len(m))) + 1)[:total]
    # Il volume della musica nel tempo: forte in sigla e nel montaggio, bassa sotto le voci.
    vol = np.full(total, 0.09, dtype=np.float32)
    first = lines[0]["t"]
    def ramp(a, b, v0, v1):
        i0, i1 = int(a * SR), int(b * SR)
        vol[i0:i1] = np.linspace(v0, v1, max(1, i1 - i0))
    vol[: int(first * SR)] = 0.5
    ramp(max(0, first - 0.5), first + 0.2, 0.5, 0.09)
    for a0, b0, v in music_marks:
        ramp(a0, a0 + 0.6, 0.09, v)
        vol[int((a0 + 0.6) * SR): int((b0 - 0.6) * SR)] = v
        ramp(b0 - 0.6, b0, v, 0.09)
    last = lines[-1]["t"] + lines[-1]["d"]
    ramp(last, last + 0.6, 0.09, 0.42)
    vol[int((last + 0.6) * SR):] = 0.42
    ramp(duration - 1.4, duration, 0.42, 0.0)
    vol[int(duration * SR):] = 0
    vol[:int(0.4 * SR)] *= np.linspace(0, 1, int(0.4 * SR))
    mix += m * vol

peak = np.max(np.abs(mix)) or 1
mix = mix / max(1.0, peak / 0.97)
wav = os.path.join(out, "mix.wav")
sf.write(wav, mix[: int(duration * SR)], SR)
audio_name = f"{plan['id']}.m4a"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", os.path.join(out, audio_name)], check=True)

show = {
    "id": plan["id"],
    "day": plan["day"],
    "hosts": plan["hosts"],
    "audio": f"/studio/{audio_name}",
    "duration": duration,
    "screens": [seg["screen_out"] for seg in plan["segments"]],
    "shots": shots,
    "lines": lines,
    "props": props,
}
json.dump(show, open(os.path.join(out, f"{plan['id']}.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"id": plan["id"], "day": plan["day"], "duration": duration}, open(os.path.join(out, "ultima.json"), "w"))
print("durata", duration, "battute", len(lines), "inquadrature", len(shots))
