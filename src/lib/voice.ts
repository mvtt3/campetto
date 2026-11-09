/**
 * La voce di Spicchio: ogni errore diventa una frase breve in prima persona,
 * che dice cosa è successo e cosa fare. Qui tutte le traduzioni in un posto solo.
 */
const RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [
    /fetch|network|Failed to|Load failed|NetworkError|offline/i,
    "Ho perso la connessione: riprova quando torni online",
  ],
  [
    /JWT|token|Accesso richiesto|not authenticated|Sessione/i,
    "Ti sei disconnesso: rientra con Google e riprova",
  ],
  [
    /players_nickname_key|nome è già preso|duplicate key/i,
    "Questo nome ce l'ha già qualcuno: provane un altro",
  ],
  [/players_nickname_len/i, "Il nome deve avere da 2 a 16 caratteri"],
  [
    /potrebbe offendere/i,
    "Questo nome non lo posso usare: potrebbe offendere qualcuno",
  ],
  [
    /matches_since_start/i,
    "Prima di ottobre 2026 il campetto non esisteva: scegli una data da allora",
  ],
  [
    /Invito non valido/i,
    "Questo invito non lo riconosco: chiedi a Matteo un link nuovo",
  ],
  [
    /invito è già stato usato/i,
    "Questo invito l'ha già usato qualcun altro: chiedi a Matteo un link nuovo",
  ],
  [
    /account è già collegato/i,
    "Questo account Google è già collegato a un altro giocatore",
  ],
  [
    /giocatore ha già un account/i,
    "Questo giocatore ha già un account: se sei tu, chiedi a Matteo",
  ],
  [/pareggio/i, "Al campetto non si pareggia: controlla il punteggio"],
  [
    /Per il (\dv\d) servono (\d)/i,
    (m) => `Per il ${m[1]} mi servono ${m[2]} giocatori per squadra`,
  ],
  [/Troppi cambi/i, "Al massimo due cambi per squadra: togline uno"],
  [
    /data è nel futuro/i,
    "Questa partita non si è ancora giocata: controlla la data",
  ],
  [/Punteggio non valido/i, "Il punteggio non mi torna: controllalo"],
  [
    /tabellino non torna: la squadra ([AB]) fa (\d+) punti, ma il risultato dice (\d+)/i,
    (m) =>
      `Il tabellino non torna: la squadra ${m[1]} fa ${m[2]} punti, il risultato dice ${m[3]}. Sistema i punti`,
  ],
  [
    /in campo due volte/i,
    "Ho visto lo stesso giocatore in tutte e due le squadre: controlla",
  ],
  [
    /non in campo/i,
    "C'è un'azione di un giocatore che non era in campo: controlla",
  ],
  [
    /Formato non valido|Squadra non valida/i,
    "Le squadre non mi tornano: controlla formato e giocatori",
  ],
  [
    /amministratore|permission denied|row-level security|Non hai i permessi/i,
    "Questo lo può fare solo chi gestisce il gruppo",
  ],
  [
    /giocatore del gruppo|Non sei nel gruppo/i,
    "Prima devi entrare nel gruppo con il tuo invito",
  ],
  [
    /Partita non trovata/i,
    "Non trovo più questa partita: forse è stata eliminata",
  ],
  [/Giocatore non trovato/i, "Non trovo questo giocatore"],
  [/scollegare te stesso/i, "Non posso scollegare il tuo stesso account"],
  [
    /payload too large|too large|exceeded/i,
    "Questa foto è troppo pesante: scegline una più leggera",
  ],
];

export function say(err: unknown): string {
  const msg =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  for (const [re, out] of RULES) {
    const m = msg.match(re);
    if (m) return typeof out === "string" ? out : out(m);
  }
  return "Qualcosa non ha funzionato: riprova tra poco";
}
