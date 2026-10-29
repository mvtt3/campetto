# Campetto

L'app del nostro campetto di basket a Nichelino: partite, statistiche in stile NBA, classifiche, MVP, badge, record, stagioni e organizzazione delle partite con notifiche e meteo. Gratuita in tutto: Next.js su Vercel (piano Hobby), Supabase (piano Free), login con Google, meteo da Open-Meteo.

## Cosa fa

- **Partite**: 1v1, 2v2, 3v3, 4v4 fino a 21 (modificabile). Si segna il risultato in pochi secondi; il tabellino è facoltativo e si può aggiungere a mano, **dal video** (si guarda il filmato sul telefono e si toccano le azioni) oppure **importandolo** da un CSV/JSON.
- **Statistiche** per giocatore, per mese, stagione o sempre, e per formato: vittorie, punti, rimbalzi, assist, rubate, stoppate, perse, percentuali al tiro, eFG%, TS%, valutazione NBA, plus/minus, ELO, chimica con i compagni e testa a testa.
- **MVP del mese** (40% vittorie, 40% valutazione, 20% crescita ELO, minimo 3 partite) con la **cornice d'oro** per l'MVP in carica; migliori per categoria, record del gruppo, stagioni trimestrali con trofeo permanente, albo d'oro.
- **Badge** a 5 livelli (Bronzo, Argento, Oro, Hall of Fame, Leggenda), vetrina di 3 badge nel profilo e animazione allo sblocco.
- **Organizzazione**: chiunque propone giorno e ora, tutti ricevono la notifica e rispondono "Ci sono / Forse / No"; i riepiloghi sono raggruppati (massimo uno ogni 30 minuti) più un "Si gioca!" quando si raggiunge il numero. Meteo di Nichelino con avviso pioggia.
- **PWA**: si installa nella schermata Home e si apre a schermo intero; tema chiaro/scuro; funziona offline con gli ultimi dati.

## Avviarla sul PC

```bash
npm install
npm run dev          # http://localhost:3000
```

Per provarla senza account usa il backend di prova (solo su localhost): `http://localhost:3000/?mock=demo` carica una storia di partite finte, `?mock=reset&signed=1` parte vuoto, `?mock=off` torna ai dati veri.

## Variabili d'ambiente

| Nome | Dove | Note |
|---|---|---|
| `VAPID_PRIVATE_KEY` | solo server (Vercel) | chiave privata delle notifiche push, **segreta** |
| `VAPID_SUBJECT` | server | `mailto:` di contatto per le notifiche |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | pubbliche; se mancano si usano quelle in `src/lib/config.ts` |

L'app non usa la chiave segreta di Supabase: tutto passa dalla chiave pubblica e dalle regole di sicurezza (RLS) del database.

## Database

Le migrazioni sono in `supabase/migrations/`. Ogni tabella ha RLS: solo i giocatori del gruppo leggono i dati; partite e collegamenti degli account si scrivono solo tramite funzioni del database che controllano i dati (`save_match`, `claim_invite`, …). I 7 giocatori iniziali sono creati dalla seconda migrazione.

## Aggiungere un giocatore

Profilo → Impostazioni → Amministrazione → **+**. Poi apri il giocatore e mandagli il suo **link d'invito** (Copia o Condividi). Chi lo apre entra con Google e trova già il suo profilo con tutte le partite giocate. In alternativa scrivi la sua email Google: al primo accesso viene collegato da solo. Chi entra senza invito finisce in "In attesa" e lo colleghi da lì.

## Importare statistiche

Partite → icona appunti. Incolla una tabella (virgole, punti e virgola o tab) o un JSON. Colonne riconosciute, in italiano o inglese: nome/giocatore, squadra (A/B), punti, 2PM/2PA, 3PM/3PA o triple, rimbalzi (o offensivi/difensivi), assist, rubate, stoppate, perse, falli. Esempio:

```
Giocatore;Squadra;Punti;Triple;Rimbalzi;Assist
Valerio Semeraro;A;9;1;4;3
Mattia;B;12;2;2;5
```

## Pubblicarla

```bash
npx vercel deploy --prod
```

Dopo il primo deploy aggiungi l'indirizzo di Vercel in Supabase → Authentication → URL Configuration (Site URL e Redirect URLs).

## Test

```bash
npm test             # logica: statistiche, ELO, MVP, badge, squadre, notifiche, import
npm run build && npm run test:e2e   # flussi e layout su 6 misure di schermo, tema chiaro e scuro
```
