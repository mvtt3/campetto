"""Studio Campetto: il video del maxischermo (le azioni che passano mentre i conduttori parlano).

Un solo video piccolo per puntata, già tagliato per il maxischermo e con il misuratore di tiro stile
NBA 2K disegnato dentro i fotogrammi: si riempie dal basso e diventa verde nel fotogramma in cui la
palla parte. Così rilascio e verde coincidono per costruzione, anche su un telefono lento, e il
telefono scarica poco (un paio di MB invece dei video interi da 5 MB l'uno).

Uso: python3 scripts/studio-muro.py puntata.json [cartella-public]
Scrive <id>-muro.mp4 accanto al JSON e ci aggiunge "muro": {"src", "t0"}.
Il misuratore va dove c'è "shot" nella clip: {"t": rilascio dall'inizio della clip, "x", "y": testa
di chi tira, da 0 a 1 sul fotogramma intero}.
"""
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

FPS = 30
# Il maxischermo nello studio è 200×242 punti: il video è il doppio, nitido sui telefoni.
W, H = 400, 484
PX = W / 200  # pixel del video per punto dello studio
SRC_W, SRC_H = 1280, 720

VOLT = (255, 197, 49)
BALL = (242, 106, 27)
GREEN_LO = (31, 191, 110)
GREEN_HI = (77, 255, 159)
INK = (29, 26, 22)


def meter_state(shot, local):
    """Come si vede il misuratore a `local` secondi dall'inizio della clip: (stato, pieno, opacità, da quanto è verde)."""
    if not shot:
        return "off", 0.0, 0.0, 0.0
    fill_t = 0.6
    d = local - shot["t"]
    if d < -fill_t - 0.12 or d > 1.0:
        return "off", 0.0, 0.0, 0.0
    if d < 0:
        u = min(1.0, max(0.0, (d + fill_t) / fill_t))
        return "fill", u * u * (0.35 + 0.65 * u), min(1.0, (d + fill_t + 0.12) / 0.12), 0.0
    fade = 1.0 if d < 0.75 else max(0.0, 1 - (d - 0.75) / 0.25)
    return "green", 1.0, fade, d


def cam_at(cam, local):
    """La regia della clip (centro dell'azione) al tempo local, come replayFrame nell'app."""
    if not cam:
        return 0.5, 1.0, 0.5
    if local <= cam[0][0]:
        return cam[0][1], cam[0][2], cam[0][3]
    for a, b in zip(cam, cam[1:]):
        if local <= b[0]:
            u = (local - a[0]) / max(1e-6, b[0] - a[0])
            return tuple(a[i] + (b[i] - a[i]) * u for i in (1, 2, 3))
    return cam[-1][1], cam[-1][2], cam[-1][3]


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def crop_center(clip, local, crop_w):
    """Dove sta il centro dell'inquadratura (da 0 a 1 sulla larghezza del video intero).

    Di base segue la regia della clip. Prima del tiro si sposta piano su chi tira (un po' a sinistra
    del centro, così il misuratore alla sua destra è dentro); dopo il rilascio accompagna la palla
    verso il canestro. Se il canestro è vicino a chi tira, li tiene dentro tutti e due e resta lì.
    """
    hw = crop_w / SRC_W / 2
    cx, _, _ = cam_at(clip.get("cam"), local)
    c = ((SRC_W - crop_w) * cx + crop_w / 2) / SRC_W
    shot = clip.get("shot")
    if shot:
        sx = shot["x"]
        hoop = clip.get("hoop")
        hx = hoop[0] if hoop else None
        pre = sx + 0.06
        near = hx is not None and abs(hx - sx) < 0.22
        if near:
            pre = min(max(pre, hx - hw + 0.05), hx + hw - 0.05)
        post = pre if (near or hx is None) else hx + 0.13 * (1 if sx > hx else -1)
        w_in = smooth((local - (shot["t"] - 2.1)) / 1.2)
        w_out = smooth((local - (shot["t"] + 0.1)) / 1.0)
        c = c + (pre - c) * w_in
        c = c + (post - c) * w_out
    return min(1 - hw, max(hw, c))


def center_path(clip, n, crop_w):
    """Il centro dell'inquadratura per ogni fotogramma della clip, ammorbidito (niente scatti)."""
    raw = np.array([crop_center(clip, i / FPS, crop_w) for i in range(n)])
    sigma = 0.18 * FPS
    k = np.arange(-int(3 * sigma), int(3 * sigma) + 1)
    g = np.exp(-0.5 * (k / sigma) ** 2)
    g /= g.sum()
    pad = len(k) // 2
    ext = np.concatenate([np.full(pad, raw[0]), raw, np.full(pad, raw[-1])])
    return np.convolve(ext, g, mode="valid")


def ease_pop(u):
    """Il piccolo scatto quando diventa verde: 1 → 1,22 → 1 in 0,32 s, con un po' di rimbalzo."""
    if u <= 0 or u >= 1:
        return 1.0
    return 1 + 0.22 * math.sin(math.pi * u) * (1.15 - 0.3 * u)


def lerp(c1, c2, u):
    return tuple(int(round(c1[i] + (c2[i] - c1[i]) * u)) for i in range(3))


SS = 4  # disegno a 4× e poi rimpicciolisco: bordi morbidi


def draw_meter(state, fill, fade, since):
    """Il misuratore su un riquadro trasparente (a 1×), con il punto d'aggancio in alto a sinistra a (PAD, PAD)."""
    pad = 34
    mw, mh = 10 * PX, 42 * PX
    cw, ch = int(mw + 2 * pad), int(mh + 2 * pad)
    big = Image.new("RGBA", (cw * SS, ch * SS), (0, 0, 0, 0))
    green = state == "green"
    scale = ease_pop(since / 0.32) if green else 1.0
    cx, cy = (pad + mw / 2) * SS, (pad + mh / 2) * SS
    hw, hh = mw / 2 * scale * SS, mh / 2 * scale * SS
    box = (cx - hw, cy - hh, cx + hw, cy + hh)
    r = hw

    # Ombra (o bagliore verde) sotto.
    glow = Image.new("RGBA", big.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    if green:
        e = 3 * PX * SS
        gd.rounded_rectangle((box[0] - e, box[1] - e, box[2] + e, box[3] + e), radius=r + e, fill=(46, 232, 138, 200))
        glow = glow.filter(ImageFilter.GaussianBlur(7 * PX * SS / 2))
    else:
        gd.rounded_rectangle((box[0], box[1] + 2 * PX * SS, box[2], box[3] + 2 * PX * SS), radius=r, fill=(0, 0, 0, 115))
        glow = glow.filter(ImageFilter.GaussianBlur(3 * PX * SS))
    big = Image.alpha_composite(big, glow)
    d = ImageDraw.Draw(big)
    if green:
        # L'anello leggero attorno, come il box-shadow 0 0 0 2px.
        e = 2 * PX * SS
        d.rounded_rectangle((box[0] - e, box[1] - e, box[2] + e, box[3] + e), radius=r + e, fill=(46, 232, 138, 90))
    border = int(round(2 * PX * SS))
    d.rounded_rectangle(box, radius=r, fill=(0x0B, 0x3D, 0x22, 255) if green else INK + (255,))
    inner = (box[0] + border, box[1] + border, box[2] - border, box[3] - border)
    d.rounded_rectangle(inner, radius=max(1, r - border), fill=(255, 255, 255, 64))

    # Il riempimento dal basso: sfumato giallo → arancio, verde quando è il momento.
    ins = (box[0] + border + 1 * PX * SS * 0.5, box[1] + border + 1 * PX * SS * 0.5, box[2] - border - 1 * PX * SS * 0.5, box[3] - border - 1 * PX * SS * 0.5)
    fh = (ins[3] - ins[1]) * max(0.0, min(1.0, fill))
    if fh > 0.5:
        lo, hi = (GREEN_LO, GREEN_HI) if green else (VOLT, BALL)
        grad = Image.new("RGBA", (int(ins[2] - ins[0]) + 1, int(ins[3] - ins[1]) + 1))
        gh = grad.size[1]
        arr = np.zeros((gh, grad.size[0], 4), dtype=np.uint8)
        for y in range(gh):
            arr[y, :, :3] = lerp(lo, hi, 1 - y / max(1, gh - 1))  # in basso "lo", in alto "hi"
            arr[y, :, 3] = 255
        grad = Image.fromarray(arr, "RGBA")
        mask = Image.new("L", grad.size, 0)
        md = ImageDraw.Draw(mask)
        # Solo la parte piena (dal basso), dentro la forma a capsula.
        cap = Image.new("L", grad.size, 0)
        ImageDraw.Draw(cap).rounded_rectangle((0, 0, grad.size[0] - 1, grad.size[1] - 1), radius=grad.size[0] / 2, fill=255)
        md.rectangle((0, gh - fh, grad.size[0], gh), fill=255)
        mask = Image.fromarray(np.minimum(np.array(mask), np.array(cap)))
        big.paste(grad, (int(ins[0]), int(ins[1])), mask)

    if green and since < 0.5:
        # Lo scoppio: otto trattini verdi che si allargano e ruotano, poi spariscono.
        u = since / 0.5
        k = 1 - (1 - u) ** 3  # ease-out
        s = 0.4 + 1.1 * k
        alpha = int(242 * (1 - k))
        rot = math.radians(30 * k)
        R = 13 * PX * SS * s
        bx, by = cx, box[1] + (-4 + 13) * PX * SS
        rays = Image.new("RGBA", big.size, (0, 0, 0, 0))
        rd = ImageDraw.Draw(rays)
        for i in range(8):
            a0 = rot + math.radians(45 * i)
            a1 = a0 + math.radians(10)
            r0, r1 = R * 0.40, R * 0.62
            pts = [(bx + r0 * math.cos(a0), by + r0 * math.sin(a0)), (bx + r1 * math.cos(a0), by + r1 * math.sin(a0)),
                   (bx + r1 * math.cos(a1), by + r1 * math.sin(a1)), (bx + r0 * math.cos(a1), by + r0 * math.sin(a1))]
            rd.polygon(pts, fill=GREEN_HI + (alpha,))
        big = Image.alpha_composite(big, rays)

    small = big.resize((cw, ch), Image.LANCZOS)
    if fade < 1:
        a = np.array(small)
        a[:, :, 3] = (a[:, :, 3].astype(np.float32) * fade).astype(np.uint8)
        small = Image.fromarray(a, "RGBA")
    return small, pad


def read_frames(path, t0, dur):
    """I fotogrammi di un pezzo di video, a 30 al secondo, a grandezza piena."""
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t0:.3f}", "-i", path, "-t", f"{dur + 0.2:.3f}",
                        "-vf", f"fps={FPS},scale={SRC_W}:{SRC_H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       capture_output=True, check=True)
    n = len(p.stdout) // (SRC_W * SRC_H * 3)
    return np.frombuffer(p.stdout[: n * SRC_W * SRC_H * 3], dtype=np.uint8).reshape(n, SRC_H, SRC_W, 3)


def build(show_path, public_dir):
    show = json.load(open(show_path))
    sid = show["id"]
    # Tutte le clip che passano sul maxischermo, con il loro momento nella puntata.
    items = []
    # Le vecchie puntate (replay a tutto schermo) hanno un'inquadratura "replay": quelle non vanno sul muro.
    full = {sh["screen"] for sh in show.get("shots", []) if sh.get("cam") == "replay"}
    for si, scr in enumerate(show["screens"]):
        if scr.get("kind") == "replay" and si not in full:
            for c in scr.get("clips", []):
                items.append(c)
    items = [c for c in items if os.path.exists(os.path.join(public_dir, c["src"].lstrip("/")))]
    if not items:
        print("muro: nessuna clip")
        show.pop("muro", None)
        json.dump(show, open(show_path, "w"), ensure_ascii=False, separators=(",", ":"))
        return
    t0 = min(c["t"] for c in items)
    t1 = max(c["t"] + c["to"] - c["from"] for c in items)
    n = int(math.ceil((t1 - t0) * FPS)) + 1
    out_mp4 = os.path.join(os.path.dirname(os.path.abspath(show_path)), f"{sid}-muro.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-profile:v", "main", "-pix_fmt", "yuv420p",
                            "-g", str(FPS), "-movflags", "+faststart", "-an", out_mp4], stdin=subprocess.PIPE)
    cache = {}
    crop_w = SRC_H * W / H  # il video copre il maxischermo in altezza

    def frame(clip, local):
        key = (clip["src"], clip["from"], clip["to"])
        if key not in cache:
            fr = read_frames(os.path.join(public_dir, clip["src"].lstrip("/")), clip["from"], clip["to"] - clip["from"])
            cache[key] = (fr, center_path(clip, len(fr), crop_w))
        frames, path = cache[key]
        fi = min(len(frames) - 1, max(0, int(round(local * FPS))))
        x0 = path[min(fi, len(path) - 1)] * SRC_W - crop_w / 2
        img = Image.fromarray(frames[fi]).resize((W, H), Image.BILINEAR, box=(x0, 0, x0 + crop_w, SRC_H))
        st, fill, fade, since = meter_state(clip.get("shot"), local)
        if st != "off":
            m, pad = draw_meter(st, fill, fade, since)
            k = W / crop_w
            sx = (clip["shot"]["x"] * SRC_W - x0) * k
            sy = clip["shot"]["y"] * SRC_H * k
            # Attaccato alla scena: se l'inquadratura si sposta, si sposta con lei (anche fuori dal bordo).
            x = sx + 13 * PX
            y = min(H - 50 * PX, max(8 * PX, sy - 44 * PX))
            img.paste(m.convert("RGB"), (int(round(x - pad)), int(round(y - pad))), m.getchannel("A"))
        return np.asarray(img, dtype=np.uint8)

    for i in range(n):
        T = t0 + i / FPS
        clip = None
        for c in items:
            if c["t"] <= T < c["t"] + (c["to"] - c["from"]):
                clip = c
        if clip is not None:
            enc.stdin.write(frame(clip, T - clip["t"]).tobytes())
            continue
        # Tra un gruppo di azioni e l'altro il maxischermo mostra la grafica: qui il video resta
        # fermo sul fotogramma più vicino (se il telefono è un attimo in ritardo, niente nero).
        prev = max((c for c in items if c["t"] + c["to"] - c["from"] <= T), key=lambda c: c["t"], default=None)
        nxt = min((c for c in items if c["t"] > T), key=lambda c: c["t"], default=None)
        if prev is not None and (nxt is None or T - (prev["t"] + prev["to"] - prev["from"]) < nxt["t"] - T):
            enc.stdin.write(frame(prev, prev["to"] - prev["from"] - 1 / FPS).tobytes())
        else:
            enc.stdin.write(frame(nxt, 0).tobytes())
    enc.stdin.close()
    enc.wait()
    show["muro"] = {"src": f"/studio/{sid}-muro.mp4", "t0": round(t0, 3)}
    json.dump(show, open(show_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"muro: {out_mp4} ({os.path.getsize(out_mp4) // 1024} KB, {n / FPS:.1f} s da {t0:.2f})")


if __name__ == "__main__":
    pub = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
    build(sys.argv[1], pub)
