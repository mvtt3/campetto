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
 * Notifiche con OneSignal. L'App ID è pubblico (finisce nel browser); la chiave per mandare
 * (ONESIGNAL_REST_API_KEY) sta solo nelle variabili d'ambiente del server.
 */
export const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "";

/**
 * Chi riceve le notifiche con OneSignal: "admin" = solo l'amministratore (la prova sul suo
 * telefono), "tutti" = tutti, "no" = nessuno (restano quelle di prima). Gli altri restano col
 * sistema di prima finché non si passa a "tutti".
 */
export const ONESIGNAL_FOR = "admin" as "no" | "admin" | "tutti";

/** Le notifiche di questo giocatore passano da OneSignal? */
export const oneSignalFor = (me: { isAdmin: boolean } | null | undefined) =>
  Boolean(ONESIGNAL_APP_ID) &&
  (ONESIGNAL_FOR === "tutti" || (ONESIGNAL_FOR === "admin" && !!me?.isAdmin));

/**
 * Campetto Star (il gioco): finché è false lo vede solo l'amministratore, per le prove.
 * Anche quello che si indossa nel gioco, nell'app, lo vede solo lui. Quando è pronto
 * per tutti si mette a true.
 */
export const GAME_FOR_ALL = false;

/**
 * Il gioco è spento per tutti, anche per l'amministratore. Il codice resta com'è: per
 * riaccenderlo si mette a true.
 * In locale (le prove sul computer) resta visibile all'amministratore.
 */
export const GAME_ON = false;

const localPreview = () =>
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);

/** Il gioco è aperto a questo giocatore? */
export const gameAllowed = (me: { isAdmin: boolean } | null | undefined) =>
  (GAME_ON || localPreview()) && (GAME_FOR_ALL || !!me?.isAdmin);
