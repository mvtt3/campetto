import { expect, test } from "@playwright/test";
import { openApp, skipTour } from "./helpers";

test("dal login con Google si entra nell'app", async ({ page }) => {
  await page.goto("/?mock=reset");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Entra con Google" }).click();
  await expect(page.getByRole("heading", { name: /, (Matteo|MVP)\??$/ })).toBeVisible();
});

test("app vuota: stati vuoti curati", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Nessuno ha ancora proposto un giorno")).toBeVisible();
  await expect(page.getByText("Ancora nessuno")).toBeVisible();
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await expect(page.getByText("Ancora nessuna partita")).toBeVisible();
});

test("un giocatore normale guarda soltanto: niente inserimento partite", async ({ page }) => {
  await openApp(page, "demo", "light", "p2");
  await expect(page.getByRole("heading", { name: /, (Valerio|MVP)\??$/ })).toBeVisible();
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await expect(page.getByTestId("match-row").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Aggiungi partita" })).toHaveCount(0);
  await page.getByTestId("match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifica" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Elimina partita" })).toHaveCount(0);
  for (const path of ["/nuova", "/importa", "/video", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
  await page.goto("/profilo/impostazioni");
  await expect(page.getByText("Gestione del gruppo")).toHaveCount(0);
});

test("l'amministratore vede gli strumenti per inserire le partite", async ({ page }) => {
  await openApp(page);
  await page.goto("/partite");
  await page.getByRole("link", { name: "Aggiungi partita" }).first().click();
  await expect(page).toHaveURL(/\/nuova/);
  await page.goto("/profilo/impostazioni");
  await page.getByText("Gestione del gruppo").click();
  await expect(page.getByRole("link", { name: /Importa statistiche/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Segna dal video/ })).toBeVisible();
});

async function pickTeams(page: import("@playwright/test").Page, ids: string[]) {
  for (const id of ids) await page.getByTestId(`pick-${id}`).click();
}

test("nuova partita solo risultato", async ({ page }) => {
  await openApp(page);
  await page.goto("/nuova");
  await page.getByRole("button", { name: "2v2" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await pickTeams(page, ["p1", "p2", "p3", "p4"]);
  await expect(page.getByText("Previsione")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Punti squadra A").fill("21");
  await page.getByLabel("Punti squadra B").fill("17");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Salva solo il risultato" }).click();
  await expect(page).toHaveURL(/\/partite\?m=/);
  await expect(page.getByRole("dialog")).toContainText("21–17");
  await expect(page.getByRole("dialog")).toContainText("Matteo e Valerio");
  await expect(page.getByRole("dialog").getByText("Vince")).toBeVisible();
});

test("2 contro 2 in cinque: il quinto fa il cambio", async ({ page }) => {
  await openApp(page);
  await page.goto("/nuova");
  await page.getByRole("button", { name: "2v2" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await pickTeams(page, ["p1", "p2", "p3", "p4", "p5"]);
  // Il quinto va nella squadra più corta, come cambio.
  await expect(page.getByTestId("pick-p5")).toHaveAttribute("aria-label", /squadra A, cambio/);
  await expect(page.getByText("Previsione")).toBeVisible();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByText(/\(cambio\)/)).toBeVisible();
  await page.getByLabel("Punti squadra A").fill("21");
  await page.getByLabel("Punti squadra B").fill("15");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Salva solo il risultato" }).click();
  await expect(page).toHaveURL(/\/partite\?m=/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("21–15");
  await expect(dialog).toContainText(/Cambio: \S+/);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("match-row").first()).toContainText(" + ");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("campetto:mock:v1")!).matches[0].players.filter((p: { sub?: boolean }) => p.sub));
  expect(saved).toHaveLength(1);
});

test("pareggio non ammesso e squadre incomplete bloccate", async ({ page }) => {
  await openApp(page);
  await page.goto("/nuova");
  await page.getByRole("button", { name: "1v1" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await expect(page.getByRole("button", { name: "Avanti" })).toBeDisabled();
  await pickTeams(page, ["p1", "p2"]);
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Punti squadra A").fill("10");
  await page.getByLabel("Punti squadra B").fill("10");
  await expect(page.getByText("Il risultato non può essere un pareggio")).toBeVisible();
  await expect(page.getByRole("button", { name: "Avanti" })).toBeDisabled();
});

test("nuova partita con tabellino", async ({ page }) => {
  await openApp(page);
  await page.goto("/nuova");
  await page.getByRole("button", { name: "1v1" }).click();
  await page.getByRole("button", { name: "Avanti" }).click();
  await pickTeams(page, ["p5", "p7"]);
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByLabel("Punti squadra A").fill("7");
  await page.getByLabel("Punti squadra B").fill("2");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("button", { name: "Aggiungi il tabellino" }).click();
  // Mattia: 2 canestri da 2 e una tripla
  await page.getByRole("button", { name: "Aggiungi Da 2 segnati" }).click();
  await page.getByRole("button", { name: "Aggiungi Da 2 segnati" }).click();
  await page.getByRole("button", { name: "Aggiungi Da 3 segnati" }).click();
  await page.getByRole("button", { name: "Aggiungi Assist" }).click();
  await expect(page.getByTestId("box-points")).toHaveText("7");
  await page.getByRole("button", { name: /Simone/ }).click();
  await page.getByRole("button", { name: "Aggiungi Da 2 segnati" }).click();
  await expect(page.getByText(/tutto torna/)).toBeVisible();
  await page.getByRole("button", { name: "Salva partita" }).click();
  await expect(page.getByRole("dialog")).toContainText("Tabellino");
  await expect(page.getByRole("dialog")).toContainText("Mattia");
  // Mattia ha vinto ed è il migliore della sua squadra: è l'MVP della partita.
  const mvp = page.getByRole("region", { name: "MVP della partita" });
  await expect(mvp).toContainText("Mattia");
  await expect(mvp).toContainText("7 punti");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("match-row").first()).toContainText("MVP Mattia");
});

test("proponi una partita e rispondi", async ({ page }) => {
  await openApp(page);
  await page.goto("/organizza?nuova=1");
  // Domani: l'orario di oggi potrebbe essere già passato quando parte il test.
  await page.getByRole("button", { name: "Domani" }).click();
  await page.getByRole("button", { name: "18:00" }).click();
  await page.getByRole("tab", { name: "3v3" }).click();
  await page.getByRole("button", { name: "Proponi", exact: true }).click();
  // Le schede principali restano montate (nascoste): si guarda solo la scheda visibile.
  const card = page.locator('[data-testid="proposal-card"]:visible').first();
  await expect(card).toContainText("1 di 6");
  await card.getByRole("button", { name: "Forse" }).click();
  await expect(card.getByRole("button", { name: "Forse" })).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "Ci sono" }).click();
  await expect(card).toContainText("1 di 6");
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByTestId("proposal-card")).toBeVisible();
});

test("importa statistiche da testo", async ({ page }) => {
  await openApp(page);
  await page.goto("/importa");
  await page.getByRole("button", { name: "Usa un esempio" }).click();
  await page.getByRole("button", { name: "Controlla" }).click();
  await expect(page.getByText(/Formato 2v2/)).toBeVisible();
  await page.getByRole("button", { name: "Salva partita" }).click();
  await expect(page).toHaveURL(/\/partite\?m=/);
  await expect(page.getByRole("dialog")).toContainText("21–18");
});

test("segna dal video", async ({ page }) => {
  await openApp(page);
  await page.goto("/video");
  await page.getByTestId("video-input").setInputFiles({ name: "partita.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048) });
  await page.getByRole("tab", { name: "1v1" }).click();
  await pickTeams(page, ["p2", "p4"]);
  await page.getByRole("button", { name: "Inizia a segnare" }).click();
  await page.getByRole("button", { name: /Valerio/ }).click();
  await page.getByRole("button", { name: "+2", exact: true }).click();
  await page.getByRole("button", { name: "+3", exact: true }).click();
  await page.getByRole("button", { name: /Lorenzo/ }).click();
  await page.getByRole("button", { name: "+2", exact: true }).click();
  await page.getByRole("button", { name: "Rubata" }).click();
  await page.getByRole("button", { name: "Annulla l'ultima azione" }).click();
  await page.getByRole("button", { name: "Fine" }).click();
  await expect(page.getByText("Risultato finale")).toBeVisible();
  await page.getByRole("button", { name: "Salva partita" }).click();
  await expect(page.getByRole("dialog")).toContainText("5–2");
  await expect(page.getByRole("dialog")).toContainText(/dal video/i);
});

test("MVP con cornice d'oro e profilo di un altro giocatore", async ({ page }) => {
  await openApp(page, "demo");
  await expect(page.locator('[title$="è l\'MVP in carica"]').first()).toBeVisible();
  await page.getByRole("link", { name: "Classifica" }).click();
  await expect(page.getByLabel("Podio")).toBeVisible();
  await page.getByRole("button", { name: "Assist" }).click();
  await expect(page.getByRole("button", { name: "Assist" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Albo" }).click();
  await expect(page.getByText("Più punti in una partita")).toBeVisible();
  await page.goto("/giocatore?id=p3");
  await expect(page.getByText("Testa a testa")).toBeVisible();
  await page.getByRole("link", { name: "Vedi tutti i badge" }).click();
  await expect(page).toHaveURL(/\/giocatore\/badge\?id=p3/);
  await expect(page.getByRole("heading", { name: /^Badge di / })).toBeVisible();
  // I vecchi indirizzi portano a quelli nuovi.
  await page.goto("/giocatore/p4");
  await expect(page).toHaveURL(/\/giocatore\?id=p4$/);
  await expect(page.getByText("Testa a testa")).toBeVisible();
});

test("dalla classifica al giocatore senza chiedere niente al server", async ({ page }) => {
  await openApp(page, "pieno");
  await page.getByRole("link", { name: "Classifica" }).click();
  await expect(page.getByLabel("Podio")).toBeVisible();
  await page.waitForTimeout(1500);
  const asked: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/giocatore")) asked.push(u.pathname + u.search);
  });
  await page.getByLabel("Podio").locator('a:not([href*="id=p1"])').first().click();
  await expect(page.getByText("Testa a testa")).toBeVisible();
  expect(asked).toEqual([]);
});

test("animazione del badge sbloccato", async ({ page }) => {
  await openApp(page, "demo");
  await page.evaluate(() => localStorage.setItem("campetto:seen-badges:p1", "[]"));
  await page.reload();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Badge sbloccato");
  await dialog.getByRole("button").last().click();
});

test("vetrina dei badge", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/badge");
  // Un badge già sbloccato (con le soglie nuove non sono più tutti a portata).
  await page.getByRole("button", { name: /Bronzo|Argento|Oro/ }).first().click();
  await page.getByRole("button", { name: /vetrina/ }).click();
  await expect(page.getByText(/vetrina/).first()).toBeVisible();
});

test("tema chiaro dalle impostazioni", async ({ page }) => {
  await openApp(page);
  await page.goto("/profilo/impostazioni");
  await page.getByRole("tab", { name: "Chiaro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("tab", { name: "Scuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("amministrazione: link d'invito", async ({ page }) => {
  await openApp(page);
  await page.goto("/admin");
  await page.getByRole("button", { name: /Valerio Semeraro/ }).click();
  await expect(page.getByText("/invito/tok-p2")).toBeVisible();
});

test("squadre equilibrate per chi viene oggi", async ({ page }) => {
  await openApp(page, "demo");
  // Più tardi oggi, a qualunque ora parta il test (prima "fra due ore" sforava a mezzanotte).
  const at = new Date();
  at.setHours(23, 59, 0, 0);
  await page.evaluate((iso) => {
    const st = JSON.parse(localStorage.getItem("campetto:mock:v1")!);
    st.proposals[0].startsAt = iso;
    st.proposals[0].responses.push({ playerId: "p1", response: "si", updatedAt: iso });
    localStorage.setItem("campetto:mock:v1", JSON.stringify(st));
  }, at.toISOString());
  await page.goto("/organizza");
  await page.getByRole("button", { name: "Fai le squadre" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Squadra A");
  await expect(dialog).toContainText("Chi vince?");
  await dialog.getByRole("button", { name: "Rimescola" }).click();
  await expect(dialog.getByRole("link", { name: "Segna il risultato" })).toBeVisible();
});

test("cambio scheda immediato, tasto indietro e pagine interne", async ({ page }) => {
  await openApp(page, "demo");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await nav.getByRole("link", { name: "Classifica" }).click();
  await expect(page).toHaveURL(/\/classifiche$/);
  await expect(page.getByLabel("Podio")).toBeVisible();
  await nav.getByRole("link", { name: "Partite" }).click();
  await expect(page).toHaveURL(/\/partite$/);
  await page.getByTestId("match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/classifiche$/);
  await expect(page.getByLabel("Podio")).toBeVisible();
  await page.getByRole("link", { name: "Albo" }).click();
  await expect(page.getByText("Più punti in una partita")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("Podio")).toBeVisible();
  await nav.getByRole("link", { name: "Profilo" }).click();
  await expect(page.getByText("Andamento")).toBeVisible();
  await nav.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("heading", { name: /, (Matteo|MVP)\??$/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /, (Matteo|MVP)\??$/ })).toBeVisible();
});

test("il tasto indietro chiude il dettaglio della partita", async ({ page }) => {
  await openApp(page, "demo");
  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Partite" }).click();
  await page.getByTestId("match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/partite$/);
  await expect(page.getByTestId("match-row").first()).toBeVisible();
});

test("primo accesso: ognuno sceglie il suo nome e la figurina", async ({ page }) => {
  await skipTour(page);
  await page.goto("/?mock=reset&signed=1&nuovo=1");
  const name = page.getByLabel("Il tuo nome nell'app");
  await name.fill("valerio");
  await name.blur();
  await expect(page.getByText("Questo nome ce l'ha già qualcuno: provane un altro")).toBeVisible();
  await expect(page.getByRole("button", { name: "Avanti" })).toBeDisabled();
  await name.fill("Pluto");
  await page.getByRole("button", { name: "Avanti" }).click();
  await page.getByRole("radio", { name: "Figurina Fernando" }).click();
  await expect(page.getByRole("radio", { name: "Figurina Fernando" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Entra in campo" }).click();
  await expect(page.getByRole("heading", { name: /, (Pluto|MVP)\??$/ })).toBeVisible();
  // Il nome si cambia dalle impostazioni, sempre senza doppioni.
  await page.goto("/profilo/impostazioni");
  await page.getByRole("button", { name: /Nome nell'app/ }).click();
  const field = page.getByLabel("Nuovo nome");
  await expect(field).toHaveValue("Pluto");
  await expect(page.getByRole("button", { name: "Salva il nome" })).toBeDisabled();
  await field.fill("Pluto Jr");
  await expect(page.getByText(/una volta ogni 14 giorni/)).toBeVisible();
  await page.getByRole("button", { name: "Salva il nome" }).click();
  await expect(page.getByText("Ora sei Pluto Jr")).toBeVisible();
  // Dopo un cambio il nome resta bloccato per 14 giorni.
  await page.getByRole("button", { name: /Nome nell'app/ }).click();
  await expect(page.getByText("Nome bloccato per ora")).toBeVisible();
  await expect(page.getByText(/Mancano 1[34] giorni/)).toBeVisible();
  await page.getByRole("button", { name: "Ho capito" }).click();
  await page.getByRole("button", { name: /Foto profilo/ }).click();
  await page.getByRole("radio", { name: "Figurina Kofi" }).click();
  await expect(page.getByText("Ho cambiato la figurina")).toBeVisible();
  await page.goto("/profilo");
  await expect(page.getByRole("heading", { name: "Pluto Jr" })).toBeVisible();
});

test("niente selettori del telefono: menu e orologio dell'app", async ({ page }) => {
  await openApp(page, "demo");
  for (const path of ["/classifiche", "/profilo", "/nuova", "/importa", "/organizza?nuova=1"]) {
    await page.goto(path);
    await page.waitForTimeout(400);
    await expect(page.locator('select, input[type="time"], input[type="date"], input[type="datetime-local"]'), path).toHaveCount(0);
  }
  await page.goto("/classifiche");
  await page.getByRole("button", { name: "Formato" }).click();
  await page.getByRole("option", { name: /3v3/ }).click();
  await expect(page.getByRole("button", { name: "Formato" })).toContainText("3v3");
  // L'app parte da ottobre 2026: non si torna più indietro.
  await expect(page.getByRole("button", { name: "Periodo precedente" })).toBeDisabled();
  await page.goto("/organizza?nuova=1");
  await page.getByRole("button", { name: "Altro orario" }).click();
  const dial = page.getByRole("slider", { name: "Ora" });
  await dial.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: /Altro orario: 20:00/ })).toBeVisible();
});

async function touchDrag(page: import("@playwright/test").Page, from: [number, number], to: [number, number]) {
  const cdp = await page.context().newCDPSession(page);
  const send = (type: string, x?: number, y?: number) =>
    cdp.send("Input.dispatchTouchEvent", { type: type as "touchStart", touchPoints: x === undefined ? [] : [{ x, y: y! }] });
  await send("touchStart", from[0], from[1]);
  for (let i = 1; i <= 10; i++) {
    await send("touchMove", from[0] + ((to[0] - from[0]) * i) / 10, from[1] + ((to[1] - from[1]) * i) / 10);
    await page.waitForTimeout(16);
  }
  await send("touchEnd");
}

test("swipe tra le schede e tira giù per aggiornare", async ({ page }) => {
  await openApp(page, "demo");
  await page.evaluate(() => localStorage.setItem("campetto:seen-badges:p1", JSON.stringify(Array.from({ length: 200 }, (_, i) => String(i)))));
  const vp = page.viewportSize()!;
  await touchDrag(page, [vp.width - 40, 450], [60, 455]);
  await expect(page).toHaveURL(/\/classifiche$/);
  await touchDrag(page, [vp.width - 40, 520], [60, 522]);
  await expect(page).toHaveURL(/\/partite$/);
  await touchDrag(page, [50, 520], [vp.width - 40, 522]);
  await expect(page).toHaveURL(/\/classifiche$/);
  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Home" }).click();
  await touchDrag(page, [vp.width / 2, 300], [vp.width / 2 + 4, 640]);
  await expect(page.getByText(/Aggiornato alle \d\d:\d\d/)).toBeVisible();
});

test("guida con Spicchio: benvenuto, sezioni da saltare, si riapre dalle impostazioni", async ({ page }) => {
  await openApp(page, "demo", "light", undefined, true);
  await page.evaluate(() => localStorage.setItem("campetto:seen-badges:p1", JSON.stringify(Array.from({ length: 300 }, (_, i) => String(i)))));
  const card = page.getByRole("dialog", { name: "Iniziamo?" });
  await expect(card).toBeVisible({ timeout: 8000 });
  await card.getByRole("button", { name: "Inizia" }).click();
  const tour = page.locator('[data-tour-overlay] [role="dialog"]');
  await expect(tour).toContainText("Il tuo mese");
  await expect(tour).toContainText("Home · 1 di 4");
  await tour.getByRole("button", { name: "Avanti" }).click();
  await expect(tour).toContainText("Chi viene a giocare");
  await tour.getByRole("button", { name: "Salta Home" }).click();
  // Dalla Home alla Classifica la guida mostra lo swipe: un attimo, poi riparte.
  await expect(page.getByRole("status").filter({ hasText: "Scorri di lato per cambiare scheda" })).toBeVisible();
  await expect(page).toHaveURL(/\/classifiche$/);
  await expect(tour).toContainText("Mese, stagione o sempre");
  await expect(page.getByText("Scorri di lato per cambiare scheda")).toHaveCount(0);
  await tour.getByRole("button", { name: "Salta Classifica" }).click();
  await expect(page).toHaveURL(/\/partite$/);
  await tour.getByRole("button", { name: "Salta Partite" }).click();
  await expect(page).toHaveURL(/\/profilo$/);
  for (let i = 0; i < 3; i++) await tour.getByRole("button", { name: "Avanti" }).click();
  await tour.getByRole("button", { name: "Fine" }).click();
  await expect(page.getByText("Tutto pronto")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // Chiusa la prima volta, non riparte da sola.
  await page.reload();
  await page.waitForTimeout(2000);
  await expect(page.getByRole("dialog", { name: "Iniziamo?" })).toHaveCount(0);
  await page.goto("/profilo/impostazioni");
  await page.getByRole("button", { name: "Guida all'app" }).click();
  await page.getByRole("button", { name: /Solo Classifica/ }).click();
  await expect(tour).toContainText("Classifica · 1 di 3");
});

test("promemoria settimanale: l'app segna che sei passato e si può spegnere", async ({ page }) => {
  await openApp(page, "demo");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("campetto:mock:seen")), { timeout: 8000 }).not.toBeNull();
  await page.goto("/profilo/notifiche");
  const toggle = page.getByRole("switch", { name: "Torna a giocare" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("badge e personaggi nuovi da riscattare: pallino rosso finché non li apri", async ({ page }) => {
  await skipTour(page);
  // Chi entra per la prima volta su un telefono nuovo: prima le feste, poi le novità da aprire.
  await page.goto("/?mock=demo&telefono=nuovo");
  const party = page.locator('[aria-labelledby="party-title"]');
  await expect(party).toBeVisible();
  for (let i = 0; i < 8 && (await party.count()); i++) {
    const later = party.getByRole("button", { name: "Dopo" });
    await ((await later.count()) ? later : party.getByRole("button").last()).click();
    await page.waitForTimeout(350);
  }
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  const profile = nav.getByRole("link", { name: /^Profilo, \d+ novità|^Profilo, una novità/ });
  await expect(profile).toBeVisible();
  const before = Number(((await profile.getAttribute("aria-label")) ?? "").match(/\d+/)?.[0] ?? 1);
  await profile.click();
  await page.getByRole("link", { name: /Vedi tutti i badge, / }).click();
  const fresh = page.getByRole("button", { name: /, nuovo$/ });
  await expect(fresh.first()).toBeVisible();
  const n = await fresh.count();
  await fresh.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /, nuovo$/ })).toHaveCount(n - 1);
  // Il numero sul Profilo scende di uno.
  await expect(nav.getByRole("link", { name: before - 1 > 0 ? new RegExp(`^Profilo, (${before - 1} novità|una novità)`) : /^Profilo$/ })).toBeVisible();
});

test("segnala un problema dalle impostazioni", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  await page.getByRole("button", { name: /Segnala un problema/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Invia" })).toBeDisabled();
  await dialog.getByRole("radio", { name: "Un'idea" }).click();
  await dialog.getByRole("textbox").fill("Vorrei vedere chi ha fatto più triple questa settimana");
  await dialog.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText("Grazie! Ho segnato la tua idea")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("campetto:mock:v1")!).notifications.filter((n: { type: string; message?: string }) => n.type === "feedback" && n.message));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ kind: "idea" });
});

test("personaggi: scheda, bloccati e scelta", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  await page.getByRole("button", { name: /Il tuo personaggio/ }).click();
  // Uno speciale ancora bloccato: la scheda spiega cosa serve.
  await page.getByRole("button", { name: "Leggenda, bloccato" }).click();
  const card = page.getByRole("dialog", { name: "Leggenda" });
  await expect(card.getByText("Si sblocca con")).toBeVisible();
  await expect(card.getByText(/^0\/\d+$/)).toBeVisible();
  await expect(card.getByText("Tutti i badge Leggenda")).toBeVisible();
  await card.getByRole("button", { name: "Ci provo!" }).click();
  await expect(page.getByRole("dialog", { name: "Leggenda" })).toHaveCount(0);
  // Uno di base si sceglie subito.
  await page.getByRole("button", { name: /^Kenji/ }).click();
  await page.getByRole("button", { name: "Usa Kenji" }).click();
  await expect(page.getByText("Ora sei Kenji, gran scelta")).toBeVisible();
  await page.goto("/profilo");
  await expect(page.getByText("Kenji", { exact: true })).toBeVisible();
});

test("personaggi: si gira col dito e col tocco, il nome è sulla maglia", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  await page.getByRole("button", { name: /Il tuo personaggio/ }).click();
  await page.getByRole("button", { name: /^Jack/ }).click();
  const card = page.getByRole("dialog", { name: "Jack" });
  await expect(card).toBeVisible();
  // Di spalle c'è il nome scelto nell'app, in maiuscolo.
  await expect(card.locator(".char3d-back text").first()).toHaveText("MATTEO");
  const angle = () => page.evaluate(() => parseFloat(document.querySelector<HTMLElement>(".char3d-inner")!.style.transform.replace(/[^\d.-]/g, "")));
  await page.waitForTimeout(1200);
  const box = (await page.locator(".char3d").boundingBox())!;
  // Trascina: segue il dito.
  await page.mouse.move(box.x + 20, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 8 });
  expect(Math.abs(await angle())).toBeGreaterThan(50);
  await page.mouse.up();
  // Lasciato, si ferma di fronte o di spalle.
  await page.waitForTimeout(1500);
  const rest = ((await angle()) % 180 + 180) % 180;
  expect(Math.min(rest, 180 - rest)).toBeLessThan(15);
  // Un tocco: mezzo giro.
  const before = await angle();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(1600);
  const turned = Math.abs((await angle()) - before) % 360;
  expect(Math.min(Math.abs(turned - 180), Math.abs(turned - 180))).toBeLessThan(20);
  expect(errors).toEqual([]);
});

test("classifica delle squadre: record per formato, solo vinte e perse", async ({ page }) => {
  await openApp(page, "pieno");
  await page.goto("/classifiche");
  await page.getByRole("button", { name: "Squadre" }).click();
  await expect(page.getByRole("button", { name: "Formato" })).toHaveCount(0);
  const top = page.getByLabel("La squadra più forte");
  await expect(top).toBeVisible();
  await expect(top).toContainText(/\d+–\d+/);
  for (const f of ["1v1", "2v2", "3v3", "4v4"]) {
    await page.getByRole("tab", { name: f }).click();
    await expect(page.getByRole("tab", { name: f })).toHaveAttribute("aria-selected", "true");
  }
  await page.getByRole("button", { name: "Come funziona la classifica delle squadre" }).click();
  await expect(page.getByRole("tooltip")).toContainText("conta solo vinte e perse");
});

test("suoni: si spengono e restano spenti", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __osc: number }).__osc = 0;
    const o = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      (window as unknown as { __osc: number }).__osc++;
      return o.call(this);
    };
  });
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  const sw = page.getByRole("switch", { name: "Suoni" });
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await expect(page.getByRole("switch", { name: "Suoni" })).toHaveAttribute("aria-checked", "false");
  const before = await page.evaluate(() => (window as unknown as { __osc: number }).__osc);
  await page.getByRole("button", { name: /Segnala un problema/ }).click();
  await page.getByRole("textbox").fill("Prova dei suoni spenti");
  await page.getByRole("button", { name: "Invia" }).click();
  await expect(page.getByText(/Grazie!/)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __osc: number }).__osc)).toBe(before);
});

test("dopo la partita: com'è andata, poi i personaggi nuovi", async ({ page }) => {
  await openApp(page, "demo");
  await page.evaluate(() => {
    // Tutte già viste tranne l'ultima giocata da me.
    const ms = JSON.parse(localStorage.getItem("campetto:mock:v1")!).matches as { id: string; playedAt: string; players: { playerId: string }[] }[];
    const mine = ms.filter((m) => m.players.some((p) => p.playerId === "p1")).sort((x, y) => x.playedAt.localeCompare(y.playedAt));
    const last = mine[mine.length - 1].id;
    localStorage.setItem("campetto:seen-matches:p1", JSON.stringify(ms.map((m) => m.id).filter((id) => id !== last)));
    localStorage.setItem("campetto:seen-badges:p1", JSON.stringify(["x"]));
    localStorage.setItem("campetto:personaggi:p1", JSON.stringify([]));
  });
  await page.reload();
  const party = page.locator('[aria-labelledby="party-title"]');
  await expect(party).toContainText(/Vittoria!|Persa, alla prossima|vinte su/);
  await expect(party).toContainText(/\d+–\d+/);
  // Avanti fino ai personaggi (se ce ne sono di nuovi) o alla fine.
  for (let i = 0; i < 6 && (await party.count()); i++) {
    if (/Nuovo personaggio/.test((await party.textContent()) ?? "")) {
      await party.getByRole("button", { name: "Usalo" }).click();
      await expect(page.getByText(/^Ora sei .+, gran scelta$/)).toBeVisible();
      break;
    }
    await party.getByRole("button").last().click();
    await page.waitForTimeout(400);
  }
});

test("prima l'apertura con Spicchio, poi la festa", async ({ page }) => {
  await openApp(page, "demo");
  await page.evaluate(() => {
    const ms = JSON.parse(localStorage.getItem("campetto:mock:v1")!).matches as { id: string; playedAt: string; players: { playerId: string }[] }[];
    const mine = ms.filter((m) => m.players.some((p) => p.playerId === "p1")).sort((x, y) => x.playedAt.localeCompare(y.playedAt));
    const last = mine[mine.length - 1].id;
    localStorage.setItem("campetto:seen-matches:p1", JSON.stringify(ms.map((m) => m.id).filter((id) => id !== last)));
    sessionStorage.removeItem("campetto:intro");
  });
  await page.goto("/?mock=keep&intro=1");
  const intro = page.getByRole("status", { name: "Campetto si sta aprendo" });
  const party = page.locator('[aria-labelledby="party-title"]');
  await expect(intro).toBeVisible();
  // Sotto l'apertura non compare niente (e non suona niente).
  await page.waitForTimeout(1200);
  await expect(party).toHaveCount(0);
  await expect(intro).toBeHidden({ timeout: 6000 });
  await expect(party).toContainText(/\d+–\d+/);
});

test("cambiando scheda e tornando, la lista resta dov'era", async ({ page }) => {
  await openApp(page, "pieno");
  const nav = page.getByRole("navigation", { name: "Navigazione principale" });
  await nav.getByRole("link", { name: "Partite", exact: true }).click();
  const list = page.getByTestId("scroll-container").filter({ has: page.getByTestId("match-row") });
  await list.evaluate((el) => (el.scrollTop = 900));
  await nav.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prossima partita" })).toBeVisible();
  await nav.getByRole("link", { name: "Partite", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Partite" })).toBeVisible();
  expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(800);
  // Le partite si aprono ancora con un tocco.
  await page.getByTestId("match-row").first().scrollIntoViewIfNeeded();
  await page.getByTestId("match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("la partita aperta dalla Home, chiusa, torna alla Home", async ({ page }) => {
  await openApp(page, "demo");
  await page.getByRole("link", { name: /Ultima partita/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/localhost:\d+\/(\?|$)/);
  await expect(page.getByRole("heading", { name: "Prossima partita" })).toBeVisible();
});

test("dal profilo, il personaggio apre la collezione", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo");
  await page.getByRole("link", { name: /Il tuo personaggio/ }).click();
  await expect(page).toHaveURL(/\/profilo\/impostazioni$/);
  const sheet = page.getByRole("dialog", { name: "Il tuo personaggio" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/Collezione \d+ di \d+/)).toBeVisible();
  // Chiusa la collezione si resta nelle impostazioni.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
});

test("vista da giocatore: l'amministratore vede l'app come gli altri", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  await page.getByRole("switch", { name: "Usa l'app come un giocatore" }).click();
  const bar = page.getByRole("status").filter({ hasText: "Stai vedendo l'app come gli altri" });
  await expect(bar).toBeVisible();
  await expect(page.getByRole("link", { name: /Gestione del gruppo/ })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name: "Partite", exact: true }).click();
  await expect(page.getByRole("link", { name: "Aggiungi partita" })).toHaveCount(0);
  await page.getByTestId("match-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifica" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  // Si torna amministratori con un tocco.
  await bar.getByRole("button", { name: "Esci" }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Aggiungi partita" })).toBeVisible();
});

test("come ti vedono gli altri: il proprio profilo nella versione pubblica", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/impostazioni");
  await page.getByRole("link", { name: /Come ti vedono gli altri/ }).click();
  await expect(page).toHaveURL(/\/giocatore\?id=p1&anteprima=1/);
  await expect(page.getByRole("heading", { name: "Come ti vedono" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Numeri" })).toBeVisible();
  await expect(page.getByText("Testa a testa")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Il tuo personaggio/ })).toHaveCount(0);
});
