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

### La prima versione: un modello multimodale che guarda il video

Il primo tentativo puntava al tabellino completo senza intervento umano. Uno script in Node prendeva
il video della partita e lo faceva analizzare a un modello multimodale con input video, interrogato
via API, in tre passaggi.

1. **Dov'è il canestro.** Dal video si estraeva un fotogramma con ffmpeg e si chiedeva al modello il
   riquadro del ferro e del tabellone, in coordinate normalizzate. Da lì si ricavava un ritaglio
   quadrato attorno al canestro, usato per tutto il resto.
2. **Ricerca a spezzoni.** Il video si tagliava in spezzoni di 70 secondi sovrapposti di 8, così che
   un'azione a cavallo del taglio non andasse persa. Ogni spezzone partiva in due versioni
   sincronizzate: l'inquadratura intera, ridotta a 640 px e 10 fotogrammi al secondo, e lo zoom sul
   canestro a 480 px e 15 fotogrammi al secondo. Al modello si chiedeva un JSON con ogni canestro:
   il secondo in cui la palla entra, quando parte il tiro, 2 o 3 punti, come riconoscere chi ha
   segnato e chi ha passato (maglia, colore, pantaloncini), il tipo di tiro e quanto era sicuro. Nelle
   zone sovrapposte lo stesso canestro poteva comparire due volte: si teneva quello più sicuro.
3. **Verifica ravvicinata.** Ogni candidato si ricontrollava su uno spezzone di 8,5 secondi attorno al
   momento, con lo zoom a 24 fotogrammi al secondo, chiedendo se la palla fosse davvero passata nella
   retina ("sì", "no" o "incerto"). Per ogni canestro si salvava infine una striscia di fotogrammi,
   per il controllo a occhio.

### Perché è stata abbandonata

- **Canestri che non c'erano.** Nel primo passaggio il modello segnava come canestri anche errori
  seguiti da un rimbalzo vicino al ferro, palle che passavano davanti alla retina e azioni contate
  due volte. La verifica ne toglieva una parte, ma ne restavano abbastanza da sballare il punteggio.
- **Chi ha segnato non diventava un nome.** Il modello rispondeva con descrizioni come "maglia
  chiara, pantaloncini rossi". Trasformarle in giocatori richiedeva comunque una persona, e con
  colori simili tra le due squadre le descrizioni non bastavano a distinguere i giocatori.
- **Lento e limitato.** Ogni partita richiedeva decine di richieste, con video da caricare ogni volta,
  e il piano gratuito concede circa 20 richieste al giorno per modello. Con modelli sovraccarichi le richieste
  andavano ripetute, anche per minuti.
- **Non si poteva tarare.** Con un modello esterno non ci sono soglie da regolare né un modo
  semplice per misurare e correggere gli errori su un insieme di partite.

### La versione attuale

Da qui la scelta di dividere il lavoro. La parte che un programma fa bene e in modo ripetibile,
cioè trovare i tiri e capire se la palla entra, la fa `tiri.py` con la visione artificiale classica
(OpenCV): gira in locale, è gratis, dà sempre lo stesso risultato sullo stesso video e si misura sui
tabellini veri, come nella tabella sopra. La parte che sbagliava, cioè chi ha fatto cosa, la conferma
una persona in **Segna dal video**, dove i tiri trovati sono già al loro posto e basta un tocco per
dare un nome a ogni azione.

## Idee per migliorarlo

- Riconoscere i giocatori dal colore della maglia, per dare a ogni tiro un nome.
- Trovare il ferro da solo, senza dare il riquadro a mano.
- Un modello di riconoscimento della palla (per esempio YOLO) al posto del filtro sul colore,
  che oggi sbaglia con le maglie arancioni e con poca luce.
- Due telefoni ai lati del campo per misurare la distanza del tiro e separare media e tripla.
