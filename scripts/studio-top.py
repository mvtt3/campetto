"""Studio Campetto: il video della sezione "i migliori della giornata".

Le azioni scelte (canestri e assist), una dopo l'altra, in un solo video 3:4 a tutto schermo con il
misuratore di tiro stile NBA 2K disegnato dentro i fotogrammi: si riempie prima del tiro e diventa
verde nel fotogramma esatto del rilascio. Ogni azione dura quanto la battuta dei conduttori che la
commenta: il tempo in più lo si prende dal gioco prima del tiro, mai fermando l'immagine.

Uso: python3 scripts/studio-top.py puntata.json
Legge show["top"]["items"] (scritti da studio-genera.py) con, per ciascuna azione:
  video      il file sorgente (percorso assoluto), norot: true se la rotazione del file è sbagliata
  release    il secondo del rilascio nel video sorgente
  shot       {"x","y"}: la testa di chi tira al rilascio (frazioni del fotogramma)
  hoop       [x, y] del canestro (frazioni)
  t, d       quando parte e quanto dura nella puntata (il rilascio cade a t + d - POST)
Scrive <id>-top.mp4 e <id>-top-<n>.jpg (il fotogramma del verde, per le schede del voto) e aggiorna
il JSON con src/poster.
"""
import importlib.util, json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("muro", os.path.join(HERE, "studio-muro.py"))
muro = importlib.util.module_from_spec(spec)
spec.loader.exec_module(muro)

FPS = 30
W, H = 720, 960                 # 3:4, largo quanto lo schermo di un telefono (390 pt × ~1,85)
SRC_W, SRC_H = 1440, 810        # i fotogrammi si leggono a questa misura: il ritaglio 3:4 è largo 607 px
POST = 2.2                      # secondi dopo il rilascio: la palla entra e si vede la retina
CUT = 0.0                       # stacco netto tra un'azione e l'altra (le dissolvenze le fa la grafica sopra)

# Il misuratore si disegna con le funzioni del maxischermo, ma alla scala di questo video.
muro.W, muro.H = W, H
muro.PX = W / 390
muro.SRC_W, muro.SRC_H = SRC_W, SRC_H


def frames(path, t0, dur, norot):
    """I fotogrammi di un pezzo di video, uno alla volta (niente memoria piena)."""
    rot = ["-noautorotate"] if norot else []
    p = subprocess.Popen(["ffmpeg", "-v", "error", *rot, "-ss", f"{t0:.3f}", "-i", path, "-t", f"{dur + 0.3:.3f}",
                          "-vf", f"fps={FPS},scale={SRC_W}:{SRC_H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10 ** 7)  # si legge solo quanto serve: il resto del flusso si chiude senza lamenti
    size = SRC_W * SRC_H * 3
    while True:
        buf = p.stdout.read(size)
        if len(buf) < size:
            break
        yield np.frombuffer(buf, dtype=np.uint8).reshape(SRC_H, SRC_W, 3)
    p.stdout.close()
    p.terminate()
    p.wait()


def build(show_path):
    show = json.load(open(show_path))
    top = show.get("top")
    if not top or not top.get("items"):
        print("top: niente azioni")
        return
    sid = show["id"]
    out_dir = os.path.dirname(os.path.abspath(show_path))
    out_mp4 = os.path.join(out_dir, f"{sid}-top.mp4")
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-preset", "slow", "-crf", "27", "-profile:v", "main", "-pix_fmt", "yuv420p",
                            "-g", str(FPS), "-movflags", "+faststart", "-an", out_mp4], stdin=subprocess.PIPE)
    crop_w = SRC_H * W / H
    k = W / crop_w
    t0 = top["items"][0]["t"]
    written = 0
    for i, it in enumerate(top["items"]):
        d = it["d"]
        lead = d - it.get("post", POST)   # "post": secondi dopo il momento chiave (se servono più dei soliti)
        src_from = it["release"] - lead
        # Per la regia e il misuratore l'azione è una "clip" come quelle del maxischermo.
        clip = {"shot": {"t": lead, "x": it["shot"]["x"], "y": it["shot"]["y"]}, "hoop": it.get("hoop")}
        n = int(round(d * FPS))
        path = muro.center_path(clip, n, crop_w)
        # "wide" (gli assist): inquadratura ferma e più larga, da x0 a x1 del fotogramma, così si vedono
        # chi passa e chi tira. Più larga del 3:4: il video sta al centro e dietro c'è lo stesso
        # fotogramma sfocato e scurito (come i reel con i video orizzontali).
        # "pan" (gli assist): l'inquadratura parte su chi passa (x = dov'è, before = quanti secondi prima
        # del rilascio parte il passaggio) e segue la palla fino a chi tira, così si vede tutta l'azione.
        pan = it.get("pan")
        if pan:
            half = crop_w / 2 / SRC_W
            px = min(max(pan["x"], half), 1 - half)
            tp = lead - pan["before"]
            span = max(0.45, pan["before"] - 0.15)
            path = np.array(path, dtype=float)
            for fi in range(len(path)):
                u = min(1.0, max(0.0, (fi / FPS - tp) / span))
                u = u * u * (3 - 2 * u)
                path[fi] = px + (path[fi] - px) * u
        wide = it.get("wide")
        if wide:
            wx0, wx1 = wide[0] * SRC_W, wide[1] * SRC_W
            wk = W / (wx1 - wx0)
            wh = min(H, int(round(SRC_H * wk / 2)) * 2)
            wy = (H - wh) // 2
        # Il video parte al fotogramma giusto anche se le azioni non sono perfettamente contigue.
        want_start = int(round((it["t"] - t0) * FPS))
        # Lo spazio prima di un'azione (l'attimo tra il rientro dallo studio e la prima battuta) si
        # riempie con l'azione stessa che parte un po' prima: mai un fotogramma nero o quello fermo
        # dell'azione precedente.
        pre = min(max(0, want_start - written), int(FPS * 1.5), int(src_from * FPS))
        while written < want_start - pre:
            enc.stdin.write(last.tobytes() if written else np.zeros((H, W, 3), np.uint8).tobytes())
            written += 1
        poster = None
        # L'ultima azione di un blocco continua per un secondo oltre la sua durata: tra la fine della
        # battuta e il ritorno in studio il video va avanti, invece di fermarsi sull'ultimo fotogramma.
        nxt = top["items"][i + 1]["t"] if i + 1 < len(top["items"]) else None
        tail = int(FPS * 1.0) if nxt is None or nxt - (it["t"] + d) > 1.2 else 0
        for fj, fr in enumerate(frames(it["video"], src_from - pre / FPS, d + (pre + tail) / FPS, it.get("norot", False))):
            fi = fj - pre
            if fi >= n + tail:
                break
            local = fi / FPS
            x0 = path[min(max(fi, 0), len(path) - 1)] * SRC_W - crop_w / 2
            if wide:
                src = Image.fromarray(fr)
                strip = src.resize((W, wh), Image.BILINEAR, box=(wx0, 0, wx1, SRC_H))
                if wh < H:
                    cx = min(max((wx0 + wx1) / 2, crop_w / 2), SRC_W - crop_w / 2)
                    bg = src.resize((W // 8, H // 8), Image.BILINEAR, box=(cx - crop_w / 2, 0, cx + crop_w / 2, SRC_H))
                    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(3))).enhance(0.42).resize((W, H), Image.BILINEAR)
                    bg.paste(strip, (0, wy))
                    img = bg
                else:
                    img = strip
            elif it.get("zoom"):
                # "zoom" (un momento che non è un tiro): l'inquadratura si stringe piano sul punto x,y
                # fino a k volte, partendo "before" secondi prima del momento chiave.
                zm = it["zoom"]
                u = min(1.0, max(0.0, (local - (lead - zm.get("before", 1.5))) / zm.get("span", 1.5)))
                u = u * u * (3 - 2 * u)
                z = 1 + (zm["k"] - 1) * u
                cw, ch = crop_w / z, SRC_H / z
                cx = (x0 + crop_w / 2) + (zm["x"] * SRC_W - (x0 + crop_w / 2)) * u
                cy = SRC_H / 2 + (zm["y"] * SRC_H - SRC_H / 2) * u
                cx = min(max(cx, cw / 2), SRC_W - cw / 2)
                cy = min(max(cy, ch / 2), SRC_H - ch / 2)
                img = Image.fromarray(fr).resize((W, H), Image.BICUBIC, box=(cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2))
            else:
                img = Image.fromarray(fr).resize((W, H), Image.BILINEAR, box=(x0, 0, x0 + crop_w, SRC_H))
            st, fill, fade, since = muro.meter_state(clip["shot"], local) if it.get("meter", True) else ("off", 0, 0, 0)
            if st != "off":
                m, pad = muro.draw_meter(st, fill, fade, since)
                sx = (clip["shot"]["x"] * SRC_W - x0) * k
                sy = clip["shot"]["y"] * SRC_H * k
                if wide:
                    sx = (clip["shot"]["x"] * SRC_W - wx0) * wk
                    sy = clip["shot"]["y"] * SRC_H * wk + wy
                x = sx + 13 * muro.PX
                y = min(H - 50 * muro.PX, max(8 * muro.PX, sy - 44 * muro.PX))
                img.paste(m.convert("RGB"), (int(round(x - pad)), int(round(y - pad))), m.getchannel("A"))
                if poster is None and st == "green" and since >= 0.12:
                    poster = img.copy()
            last = np.asarray(img, dtype=np.uint8)
            enc.stdin.write(last.tobytes())
            written += 1
        while written < want_start + n:  # il sorgente finiva prima: tiene l'ultimo fotogramma
            enc.stdin.write(last.tobytes())
            written += 1
        name = f"{sid}-top-{i + 1}.jpg"
        (poster or img).resize((360, 480), Image.LANCZOS).save(os.path.join(out_dir, name), quality=82, optimize=True)
        it["poster"] = f"/studio/{name}"
        it.pop("video", None)
        it.pop("norot", None)
        it.pop("wide", None)
        it.pop("pan", None)
        it.pop("meter", None)
        it.pop("zoom", None)
        print(f"top {i + 1}: {it['kind']} {it['label']} — {d:.1f} s, rilascio a +{lead:.2f} s")
    enc.stdin.close()
    enc.wait()
    top["src"] = f"/studio/{sid}-top.mp4"
    top["t0"] = round(t0, 3)
    json.dump(show, open(show_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"top: {out_mp4} ({os.path.getsize(out_mp4) // 1024} KB, {written / FPS:.1f} s da {t0:.2f})")


if __name__ == "__main__":
    build(sys.argv[1])
