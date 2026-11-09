# Statistiche di tiro da un video della partita, fotogramma per fotogramma.
#
# Segue il ferro (anche se il telefono si muove un po') e la palla attorno al ferro, e per ogni
# tiro che arriva al ferro dice: quando, se è entrato, e se è partito da sotto o da fuori.
# Non sa CHI ha tirato: il nome lo mette chi compila il tabellino.
#
# Uso:
#   python scripts/video/tiri.py partita.mp4 tiri.json T X0 Y0 X1 Y1 [DA A]
#     T            un secondo del video in cui il ferro si vede bene
#     X0 Y0 X1 Y1  il riquadro del ferro in quel fotogramma (in pixel)
#     DA A         facoltativi: analizza solo questo tratto (secondi)
#   Variabili: NOROT=1 per i video salvati con la rotazione sbagliata,
#              PALLA_SAT (default 70) quanto deve essere arancione la palla.
#
# Limiti noti: i tiri stoppati e le palle che non arrivano al ferro non si vedono; con tanta gente
# davanti al ferro la palla si perde; "da fuori" non separa la media dalla tripla (con un solo
# telefono la distanza non si misura bene).
import sys, os, json, cv2, numpy as np

if sys.argv[1].endswith(".json"):
    # Rifà solo il conteggio dei tiri da una traccia già salvata (per provare regole diverse in un attimo).
    old = json.load(open(sys.argv[1]))
    v, out, (x0, y0, x1, y1), track = old["video"], sys.argv[2], old["ferro"], [tuple(p) for p in old["traccia"]]
else:
    v, out, tref = sys.argv[1], sys.argv[2], float(sys.argv[3])
    x0, y0, x1, y1 = map(int, sys.argv[4:8])
    t_from = float(sys.argv[8]) if len(sys.argv) > 8 else 0.0
    t_to = float(sys.argv[9]) if len(sys.argv) > 9 else 1e9
    track = None
SAT = int(os.environ.get("PALLA_SAT", "70"))
rw, rh = x1 - x0, y1 - y0

def follow():
    """Segue ferro e palla: restituisce [(secondo, x, y)] della palla, relativi al ferro."""
    cap = cv2.VideoCapture(v)
    if os.environ.get("NOROT") == "1":
        cap.set(cv2.CAP_PROP_ORIENTATION_AUTO, 0)
    cap.set(cv2.CAP_PROP_POS_MSEC, tref * 1000)
    ok, f = cap.read()
    if not ok:
        sys.exit("non riesco a leggere il video")
    H, W = f.shape[:2]

    # 1) Il ferro: ritaglio di riferimento (ferro + un po' di tabellone) da ritrovare in ogni fotogramma.
    P = 50
    tpl = cv2.cvtColor(f[max(0, y0 - 2 * P):y1 + P, max(0, x0 - P):x1 + P], cv2.COLOR_BGR2GRAY)
    # Zona in cui si cerca la palla, relativa al ferro.
    dx0, dx1 = -int(1.6 * rw), rw + int(1.6 * rw)
    dy0, dy1 = -int(2.4 * rw), rh + int(2.0 * rw)
    r_ball = 0.26 * rw  # la palla è larga circa metà ferro
    amin, amax = (0.35 * r_ball) ** 2 * 3.14, (1.8 * r_ball) ** 2 * 3.14

    cap.set(cv2.CAP_PROP_POS_MSEC, t_from * 1000)
    pos, lost, SR = (x0, y0), 0, 140
    hist, track = [], []
    while True:
        if not cap.grab():
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if t > t_to:
            break
        ok, f = cap.retrieve()
        if not ok:
            break
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        sx0, sy0 = max(0, pos[0] - P - SR), max(0, pos[1] - 2 * P - SR)
        sx1, sy1 = min(W, pos[0] + rw + P + SR), min(H, pos[1] + rh + P + SR)
        area, ox, oy = (g, 0, 0) if lost > 15 else (g[sy0:sy1, sx0:sx1], sx0, sy0)
        if area.shape[0] >= tpl.shape[0] and area.shape[1] >= tpl.shape[1]:
            _, mv, _, ml = cv2.minMaxLoc(cv2.matchTemplate(area, tpl, cv2.TM_CCOEFF_NORMED))
            if mv > 0.55:
                npos = (ml[0] + ox + P, ml[1] + oy + 2 * P)
                if abs(npos[0] - pos[0]) > 25 or abs(npos[1] - pos[1]) > 25:
                    hist = []  # il telefono si è spostato: lo sfondo si ricalcola
                pos, lost = npos, 0
            else:
                lost += 1
        else:
            lost += 1
        if lost:
            continue

        # 2) La palla: arancione, tonda, della misura giusta e in movimento rispetto allo sfondo.
        rx, ry = pos
        X0, X1 = max(0, rx + dx0), min(W, rx + dx1)
        Y0, Y1 = max(0, ry + dy0), min(H, ry + dy1)
        roi = f[Y0:Y1, X0:X1]
        if roi.shape[0] < 40 or roi.shape[1] < 40:
            continue
        m = cv2.inRange(cv2.cvtColor(roi, cv2.COLOR_BGR2HSV), (3, SAT, 40), (26, 255, 255))
        small = cv2.resize(roi, (max(1, roi.shape[1] // 4), max(1, roi.shape[0] // 4))).astype(np.int16)
        if hist and hist[-1].shape != small.shape:
            hist = []
        hist.append(small)
        if len(hist) > 90:
            hist.pop(0)
        if len(hist) < 15:
            continue
        bg = np.median(np.stack(hist[::6]), axis=0)
        moving = cv2.resize((np.abs(small - bg).sum(axis=2) > 60).astype(np.uint8) * 255,
                            (roi.shape[1], roi.shape[0]), interpolation=cv2.INTER_NEAREST)
        m = cv2.morphologyEx(cv2.bitwise_and(m, moving), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, _, st, cen = cv2.connectedComponentsWithStats(m)
        best = None
        for k in range(1, n):
            a, w, h = st[k, cv2.CC_STAT_AREA], st[k, cv2.CC_STAT_WIDTH], st[k, cv2.CC_STAT_HEIGHT]
            if not (amin <= a <= amax) or w > 2.4 * h or h > 2.4 * w or a / float(w * h) < 0.45:
                continue
            if best is None or a > best[2]:
                best = (cen[k][0] + X0, cen[k][1] + Y0, a)
        if best:  # coordinate relative al ferro: il movimento del telefono non conta
            track.append((round(t, 3), round(best[0] - rx, 1), round(best[1] - ry, 1)))
    return track


if track is None:
    track = follow()

# 3) I tiri: la palla scende sul ferro dall'alto. È canestro se, entro mezzo secondo da quando era
#    sopra il ferro e dentro la sua larghezza, esce sotto il ferro più o meno alla stessa altezza
#    orizzontale (non è rimbalzata via di lato). Le soglie sono tarate sulle partite del 7/11/2026.
rim_top, rim_bot = rh * 0.3, rh + 0.35 * rw
MERGE, MIN_PATH, MIN_APEX = 2.0, 3, 0.3      # stesso tiro entro 2 s; traiettoria di almeno 3 punti
GAP, DX = 0.5, 0.7                            # sopra -> sotto il ferro in 0,5 s, spostandosi poco di lato

def over_rim(x, y):    # sopra il ferro, nella zona in cui arriva un tiro
    return -1.2 * rw < y < rim_top and -0.35 * rw <= x <= rw + 0.35 * rw
def above_ring(x, y):  # sopra il ferro e dentro la sua larghezza
    return -1.2 * rw < y < rim_top and 0 <= x <= rw
def through(x, y):     # sotto il ferro, dentro la retina
    return rim_bot < y < rh + 1.4 * rw and 0.05 * rw <= x <= 0.95 * rw

def made_after(k):
    for b in range(k, len(track)):
        tb, xb, yb = track[b]
        if tb - track[k][0] > 0.8:
            return False
        if through(xb, yb) and any(tb - p[0] <= GAP and above_ring(p[1], p[2]) and abs(p[1] - xb) <= DX * rw
                                   for p in track[max(0, b - 40):b]):
            return True
    return False

shots = []
for a, (ta, xa, ya) in enumerate(track):
    if not over_rim(xa, ya):
        continue
    if shots and ta - shots[-1]["t"] < MERGE:
        if not shots[-1]["dentro"] and made_after(a):  # stesso tiro, che poi entra (o il tap-in)
            shots[-1]["dentro"] = True
        continue
    # da dove arriva: la traiettoria continua (buchi < 0.3 s) prima di questo punto
    i = a
    while i > 0 and track[i][0] - track[i - 1][0] < 0.3 and ta - track[i - 1][0] < 2.0:
        i -= 1
    path = track[i:a + 1]
    apex = min(p[2] for p in path)
    if len(path) < MIN_PATH or apex > -MIN_APEX * rw:
        continue  # non è una palla che scende sul ferro (un rimbalzo, una mano, un palleggio)
    vicino = path[0][2] > rim_top and apex > -1.6 * rw  # sale da sotto il ferro senza volare alta: terzo tempo
    shots.append({"t": round(ta, 2), "dentro": made_after(a), "da": "sotto" if vicino else "fuori"})

def tot(sel):
    s = [x for x in shots if sel(x)]
    return {"canestri": sum(x["dentro"] for x in s), "tiri": len(s)}
summary = {"tutti": tot(lambda x: True), "sotto": tot(lambda x: x["da"] == "sotto"),
           "fuori": tot(lambda x: x["da"] == "fuori")}
json.dump({"video": v, "ferro": [x0, y0, x1, y1], "palla_vista_in": len(track),
           "tiri": shots, "riepilogo": summary, "traccia": track}, open(out, "w"))
a = summary["tutti"]
print(f"{a['tiri']} tiri al ferro, {a['canestri']} canestri"
      f" | da sotto {summary['sotto']['canestri']}/{summary['sotto']['tiri']}"
      f" | da fuori {summary['fuori']['canestri']}/{summary['fuori']['tiri']}"
      f" | palla vista in {len(track)} fotogrammi")
