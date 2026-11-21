// Chi vede il pass, il camerino, lo spogliatoio e i personaggi 3D. File senza dipendenze:
// lo leggono anche i test end-to-end per sapere se cercarli.

/** Il pass (e con lui i personaggi 3D) per tutti: per ora no. */
export const PASS_FOR_ALL = false;

/**
 * L'anteprima per l'amministratore. Spenta il 21/11/2026: Pluto vuole l'app uguale a quella
 * di tutti. Pass, camerino, spogliatoio e 3D restano nel codice, pronti: per riprovarli basta
 * rimettere `true` qui.
 */
export const PASS_PREVIEW_FOR_ADMIN = false;

/** Almeno qualcuno vede il pass. */
export const PASS_ON = PASS_FOR_ALL || PASS_PREVIEW_FOR_ADMIN;
