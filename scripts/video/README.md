# Dal video alle statistiche

Gli script di questa cartella lavorano sui video delle partite girati col telefono e girano sul PC
(Python 3 con OpenCV, Node, ffmpeg). Il loro risultato si usa nell'app: `tiri.json` nella schermata
**Segna dal video**, gli highlights nella tabella `highlights`.

| Script | Cosa fa |
| --- | --- |
| `tiri.py` | Guarda il video fotogramma per fotogramma: segue il ferro e la palla, trova ogni tiro che arriva al ferro, dice se è entrato e se è partito da sotto o da fuori. Scrive un `tiri.json` con l'elenco dei tiri e il riepilogo, da aprire nell'app in **Segna dal video**. |
| `highlights.mjs` | Prende i canestri di `tiri.json` e monta il video degli highlights (massimo 40 secondi, con copertina), pronto per la tabella `highlights` dell'app. |

## Come si usa

```bash
pip install opencv-python numpy

# 1) i tiri: secondo in cui il ferro si vede bene e riquadro del ferro in pixel
python scripts/video/tiri.py partita.mp4 tiri.json 150 808 430 876 450

# 2) il tabellino: nell'app, Segna dal video -> scegli il video e tiri.json

# 3) gli highlights
node scripts/video/highlights.mjs partita.mp4 tiri.json uscita/
```

Per i video che il telefono salva con la rotazione sbagliata (escono di lato) si mette `NOROT=1`
davanti a tutti e due i comandi.

## Come funziona `tiri.py`

1. **Il ferro.** Si prende un ritaglio del ferro col tabellone attorno e lo si ritrova in ogni
   fotogramma: se il telefono scivola o viene spostato, il ferro si insegue.
2. **La palla.** Attorno al ferro si cerca una macchia arancione, tonda, grande circa metà ferro e
   in movimento rispetto allo sfondo (lo sfondo è la mediana degli ultimi 3 secondi). Le posizioni
   si salvano relative al ferro, così il movimento del telefono non conta.
3. **I tiri.** Un tiro è la palla che scende sul ferro dall'alto. È canestro se, entro mezzo secondo
   da quando era sopra il ferro e dentro la sua larghezza, esce sotto il ferro più o meno in verticale
   (una palla che rimbalza via di lato non conta). Rimbalzi sul ferro e tap-in entro 2 secondi
   contano come un solo tiro. Se la traiettoria parte da sotto il ferro senza
   volare alta è un tiro da sotto (terzo tempo, appoggio), altrimenti da fuori.

## Quanto è preciso

Sulle partite del 7 novembre 2026, confrontate col tabellino:

| Partita | Canestri (video / tabellino) | Tiri al ferro (video / tabellino) |
| --- | --- | --- |
| 3 contro 3, 10:08 | 22 / 16 | 64 / 58 |
| 3 contro 3, 10:24 | 12 / 14 | 45 / 41 |
| 3 contro 3, 10:35 | 19 / 17 | 65 / 61 |
| 3 contro 3, 10:51 | 13 / 13 | 47 / 41 |
| 2 contro 2, 11:00 | 9 / 9 | 16 / 20 |
| **Totale** | **75 / 69** | **237 / 221** |

Sul totale della giornata sbaglia di meno del 10%, ma la singola partita può scostarsi di più:
quella delle 10:08 è girata col telefono di lato e che si muove, e lì conta 6 canestri di troppo.
La divisione sotto/fuori è ancora grossolana.

Cosa non vede ancora:
- **chi** ha tirato: il nome nel tabellino lo mette ancora una persona;
- i tiri stoppati e le palle che non arrivano al ferro;
- media e tripla: "da fuori" le tiene insieme, con un solo telefono la distanza non si misura bene;
- la palla coperta da chi sta sotto canestro: alcuni tiri si perdono, soprattutto nelle mischie.

Per questo `tiri.py` non salva niente da solo: in **Segna dal video** ogni tiro trovato si riguarda,
si corregge se serve (per esempio +3 invece di +2) e gli si dà un nome. I canestri degli highlights
si riguardano uno per uno prima di pubblicarli.

## Da dove arriva

La prima versione mandava il video a Gemini a spezzoni e gli chiedeva di segnare i canestri, poi
ricontrollava ogni candidato su uno spezzone ravvicinato. Era lenta e segnava anche canestri che non
c'erano, quindi è stata sostituita dal tracciamento fotogramma per fotogramma di `tiri.py`, che gira
in locale, è gratis e si può tarare sui video veri.

## Idee per migliorarlo

- Riconoscere i giocatori dal colore della maglia, per dare a ogni tiro un nome.
- Trovare il ferro da solo, senza dare il riquadro a mano.
- Un modello di riconoscimento della palla (per esempio YOLO) al posto del filtro sul colore,
  che oggi sbaglia con le maglie arancioni e con poca luce.
- Due telefoni ai lati del campo per misurare la distanza del tiro e separare media e tripla.
