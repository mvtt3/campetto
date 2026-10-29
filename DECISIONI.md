# Decisioni prese durante lo sviluppo

1. **App lato client + funzioni del database.** Le schermate leggono Supabase direttamente con la chiave pubblica e le regole RLS; le scritture importanti (partite, inviti, collegamenti) passano da funzioni SQL `security definer` che validano i dati sul server. Così non serve la chiave segreta di Supabase su Vercel e non c'è nulla da ruotare in caso di perdita.
2. **Statistiche calcolate dallo storico.** Con pochi giocatori e poche partite, statistiche, ELO, MVP, badge e record si ricalcolano in TypeScript dallo storico completo (funzioni pure e testate in `src/lib`). Niente tabelle di riepilogo da tenere sincronizzate: modificare o cancellare una partita aggiorna tutto.
3. **ELO**: parte da 1000, K = 32 diviso per √(giocatori per squadra), moltiplicato per lo scarto di punti (ln(scarto+1)/ln(11), tra 0,6 e 1,4).
4. **MVP in carica**: MVP del mese corrente; se il mese non ha ancora un MVP (minimo 3 partite), quello del mese precedente.
5. **Re di categoria**: medie a partita con almeno 2 partite con tabellino; per il tiro da tre almeno 5 tentativi.
6. **Percentuali al tiro** solo dalle partite in cui i tiri spiegano tutti i punti (un import con solo punti e triple non falsa le percentuali).
7. **Badge di mese e stagione** (MVP del mese, Campione, Settimana dopo settimana) si sbloccano a periodo chiuso.
8. **Squadre**: i formati sono esatti (2v2 = 2 per squadra). Il risultato non può essere un pareggio.
9. **Video**: il file resta sul telefono (nessun upload). Le azioni segnate si salvano in bozza sul telefono finché non salvi la partita.
10. **Notifiche raggruppate senza server sempre acceso**: il riepilogo parte alla risposta successiva se sono passati 30 minuti, oppure alla prima apertura dell'app di chiunque (controllo ogni 10 minuti al massimo). Gratis, senza cron a pagamento.
11. **Azioni nella notifica**: Android mostra al massimo 2 pulsanti, quindi "Ci sono" e "No"; il tocco apre l'app che registra la risposta. Su iPhone le notifiche funzionano solo con l'app aggiunta alla Home.
12. **Email dell'admin fuori dal repository** (che è pubblico): il collegamento automatico di Matteo Pepe è stato impostato direttamente nel database.
13. **Backend di prova** (`?mock=demo`) attivo solo su localhost, usato dai test automatici.
14. **Tablet**: l'app resta una colonna da telefono centrata, per avere la stessa esperienza ovunque.
15. **Partite solo all'amministratore** (29/10): i giocatori guardano e basta. Il database rifiuta inserimenti, modifiche ed eliminazioni da chi non è amministratore; la conferma del risultato da parte degli avversari è stata tolta perché non serve più.
16. **Semplificazione** (29/10): 4 schede (Home, Classifica, Partite, Profilo); classifica con un solo selettore di statistica e il formato in un menu; record e albo d'oro in una pagina a parte; impostazioni ridotte a foto, soprannome, numero, tema e notifiche. Le squadre equilibrate si vedono da "Fai le squadre" nella partita proposta.
17. **Nuovo stile** (29/10): poster retrò anni '30 su richiesta di Matteo. La mascotte Spicchio è un disegno originale in quello stile, non una copia dei riferimenti (che erano opere di altri autori, con marchi).
18. **Tema chiaro di base** (29/10): il tema scuro resta come opzione.
19. **Fluidità sui telefoni economici** (29/10, Galaxy A05s): le quattro schede restano montate e il cambio scheda aggiorna solo l'indirizzo; grafico dell'andamento in SVG semplice (tolto recharts); niente sfocature, sovrapposizioni con fusione dei colori, animazioni infinite o animazioni di layout. Le chip della classifica vanno a capo invece di scorrere, così non vengono tagliate. Un test automatico controlla su tutte le schermate e i formati che nessun bordo o ombra sia tagliato.
