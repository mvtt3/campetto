// Valori pubblici: finiscono comunque nel codice del browser, quindi possono stare qui
// come ripiego. La chiave segreta delle notifiche (VAPID_PRIVATE_KEY) sta solo nelle
// variabili d'ambiente del server.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kniylvcfeckeabsjbzbe.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_oxYtXKdlcbw9lyBvNWXvyg_FzDQ64V6";
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BF8j7rj6qQlQOnyoZeCyW1nkhpADfca9WYe2DoPsIZHETYa9bpBmByWe1C1R4u-8L-aoMUMYjtHznBfb8O63-54";

export const APP_NAME = "Campetto";

/**
 * Campetto Star (il gioco): finché è false lo vede solo l'amministratore, per le prove.
 * Anche quello che si indossa nel gioco, nell'app, lo vede solo lui. Quando è pronto
 * per tutti si mette a true.
 */
export const GAME_FOR_ALL = false;

/** Il gioco è aperto a questo giocatore? */
export const gameAllowed = (me: { isAdmin: boolean } | null | undefined) =>
  GAME_FOR_ALL || !!me?.isAdmin;
