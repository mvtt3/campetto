# Cose da fare a mano

**In breve**
- L'app è online su **https://campetto.vercel.app**: installabile nella Home, login con Google, 7 giocatori già pronti, statistiche da zero.
- Funziona tutto: partite (risultato, tabellino, video, import), statistiche, MVP con cornice d'oro, badge, record, stagioni, calendario con meteo e notifiche.
- Testata: 52 test sui calcoli, 26 test sui flussi e sui layout in 6 misure di schermo (Galaxy A05s compreso), tema chiaro e scuro.
- Restano solo i passi qui sotto, tutti nelle tue dashboard.

## 1. Pubblicare il login Google (così entrano tutti)
Ora l'app Google è in modalità "Test": può entrare solo chi è nell'elenco degli utenti di prova.
- **Veloce**: Google Cloud → progetto *campetto* → Google Auth Platform → Pubblico → Utenti di prova → aggiungi le email Gmail dei tuoi amici.
- **Definitivo**: Google Auth Platform → Branding → compila
  - Home page dell'applicazione: `https://campetto.vercel.app`
  - Norme sulla privacy: `https://campetto.vercel.app/privacy`
  - Termini di servizio: `https://campetto.vercel.app/termini`
  - Domini autorizzati: `campetto.vercel.app`
  Poi Pubblico → **Pubblica app**. Chiediamo solo nome, email e foto, quindi Google non chiede verifiche.

## 2. Mandare gli inviti
Profilo → ingranaggio → Amministrazione → tocca un giocatore → **Condividi** il suo link d'invito (su WhatsApp, per esempio). Tu entri direttamente con la tua Gmail: sei già l'amministratore.

## 3. Installare l'app sul telefono
- **Android**: apri il sito in Chrome → menu ⋮ → *Aggiungi a schermata Home* (o *Installa app*).
- **iPhone**: apri il sito in Safari → Condividi → *Aggiungi alla schermata Home*. Le notifiche su iPhone funzionano solo così.
Poi Profilo → ingranaggio → attiva **Notifiche su questo telefono**.

## 4. Sicurezza (5 minuti)
- In chat sono passate la **secret key di Supabase** e il **Client Secret di Google**. L'app non usa la secret key di Supabase: rigenerala comunque (Supabase → Project Settings → API Keys) ed elimina la vecchia. Per Google: Client → *campetto web* → Aggiungi secret → copia il nuovo in Supabase (Authentication → Providers → Google) → disattiva il vecchio.
- Sul PC, nella cartella `campetto-setup`, cancella `vapid-private.txt` (la chiave è già salvata su Vercel).
- Il repository GitHub è **pubblico**: non contiene segreti, ma puoi renderlo privato (GitHub → Settings → Change visibility). Vercel continua a funzionare.

## 5. Facoltativo
- Per avere i deploy automatici a ogni modifica: Vercel → progetto *campetto* → Settings → Git → collega `mvtt3/campetto`.
- Il piano gratuito di Supabase mette in pausa il database dopo 7 giorni senza nessun accesso: se succede, basta premere *Restore* nella dashboard.
