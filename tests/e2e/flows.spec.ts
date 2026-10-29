import { expect, test } from "@playwright/test";
import { openApp } from "./helpers";

test("dal login con Google si entra nell'app", async ({ page }) => {
  await page.goto("/?mock=reset");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Entra con Google" }).click();
  await expect(page.getByRole("heading", { name: "Ciao Matteo" })).toBeVisible();
});

test("app vuota: stati vuoti curati", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Nessuna partita in programma.")).toBeVisible();
  await expect(page.getByText("Ancora nessuno")).toBeVisible();
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await expect(page.getByText("Ancora nessuna partita")).toBeVisible();
});

async function pickTeams(page: import("@playwright/test").Page, ids: string[]) {
  for (const id of ids) await page.getByTestId(`pick-${id}`).click();
}

test("nuova partita solo risultato", async ({ page }) => {
  await openApp(page);
  await page.getByRole("link", { name: "Nuova partita" }).click();
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
  await expect(page.getByRole("dialog")).toContainText("Matteo P. e Valerio");
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
  await expect(page.getByText("Il risultato non può essere un pareggio.")).toBeVisible();
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
  await expect(page.getByText("Tutto torna.")).toBeVisible();
  await page.getByRole("button", { name: "Salva partita" }).click();
  await expect(page.getByRole("dialog")).toContainText("Tabellino");
  await expect(page.getByRole("dialog")).toContainText("Mattia");
});

test("proponi una partita e rispondi", async ({ page }) => {
  await openApp(page);
  await page.goto("/organizza?nuova=1");
  await page.getByRole("button", { name: "18:00" }).click();
  await page.getByRole("tab", { name: "3v3" }).click();
  await page.getByRole("button", { name: "Proponi", exact: true }).click();
  const card = page.getByTestId("proposal-card").first();
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
  await expect(page.getByText("Formato 2v2.")).toBeVisible();
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
  await expect(page.getByRole("dialog")).toContainText("azioni segnate dal video");
});

test("MVP con cornice d'oro e profilo di un altro giocatore", async ({ page }) => {
  await openApp(page, "demo");
  await expect(page.locator('[title$="è l\'MVP in carica"]').first()).toBeVisible();
  await page.getByRole("link", { name: "Classifiche" }).click();
  await page.getByRole("tab", { name: "Numeri" }).click();
  await page.getByRole("button", { name: "Assist" }).click();
  await expect(page.getByText("Assist a partita")).toBeVisible();
  await page.goto("/giocatore/p3");
  await expect(page.getByText("Il vostro testa a testa")).toBeVisible();
  await expect(page.getByRole("link", { name: "Vedi tutti i badge" })).toBeVisible();
});

test("animazione del badge sbloccato", async ({ page }) => {
  await openApp(page, "demo");
  await page.evaluate(() => localStorage.setItem("campetto:seen-badges:p1", "[]"));
  await page.reload();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Badge sbloccato");
  await dialog.getByRole("button").first().click();
});

test("vetrina dei badge", async ({ page }) => {
  await openApp(page, "demo");
  await page.goto("/profilo/badge");
  await page.getByRole("button", { name: /Sempre presente/ }).click();
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
