import { expect, test, type Locator, type Page } from "@playwright/test";
import { openApp } from "./helpers";

// Sono partite intere: con i test in parallelo servono più dei 45 secondi soliti.
test.describe.configure({ timeout: 120_000 });

/** Tiene premuto un bottone per `ms` millisecondi (il tiro). */
async function hold(page: Page, loc: Locator, ms: number) {
  const b = (await loc.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function noSideScroll(page: Page) {
  const w = await page.evaluate(() => document.scrollingElement!.scrollWidth - window.innerWidth);
  expect(w).toBeLessThanOrEqual(1);
}

async function openGame(page: Page) {
  await page.getByTestId("game-home").click();
  await expect(page.getByTestId("game")).toBeVisible();
}

/** Salta il tutorial e chiude il premio del giorno, se si apre. */
async function skipIntro(page: Page) {
  await page.getByTestId("intro-skip").click();
  const claim = page.getByTestId("claim-daily");
  await claim.waitFor({ timeout: 3000 }).catch(() => {});
  if (await claim.isVisible()) await claim.click();
  await expect(page.getByTestId("day-rest")).toBeVisible();
}

test("Campetto Star: tutorial, telefono, shopping e prima partita", async ({ page }) => {
  await openApp(page, "demo");
  await openGame(page);
  // Il gioco copre tutta l'app, anche la barra in basso.
  const covered = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navigazione principale"]')!.getBoundingClientRect();
    const top = document.elementFromPoint(nav.x + nav.width / 2, nav.y + nav.height / 2);
    return !!top?.closest('[data-testid="game"]');
  });
  expect(covered).toBe(true);
  await page.getByTestId("intro-start").click();
  // Il tiro di prova: al massimo quattro tentativi.
  for (let i = 0; i < 4 && !(await page.getByTestId("practice-done").isVisible()); i++) {
    await hold(page, page.getByRole("button", { name: "Tira" }), 880);
    await page.waitForTimeout(1200);
  }
  await page.getByTestId("practice-done").click();
  await expect(page.getByText("Ti ha scritto Mamma: apri il telefono!")).toBeVisible();
  await noSideScroll(page);

  await page.getByTestId("open-phone").click();
  await page.getByTestId("app-messaggi").click();
  await page.getByTestId("chat-mamma").click();
  await expect(page.getByTestId("chat-thread")).toContainText("Comprati delle scarpe nuove");
  await page.getByTestId("chat-choices").getByRole("button").first().click();
  await expect(page.getByTestId("chat-thread")).toContainText("Fai il bravo. E mangia!");
  await page.goBack();
  await page.goBack();
  await page.getByTestId("app-shopping").click();
  await page.getByTestId("item-scarpe-campetto").getByRole("button", { name: "Compra" }).click();
  await expect(page.getByText(/tutorial è finito/)).toBeVisible();
  await expect(page.getByTestId("item-scarpe-campetto")).toContainText("Tuo");
  await page.goBack();
  await page.goBack();

  const claim = page.getByTestId("claim-daily");
  await claim.waitFor({ timeout: 3000 }).catch(() => {});
  if (await claim.isVisible()) await claim.click();
  await expect(page.getByTestId("game-money")).toHaveText("220 €");

  // Martedì allenamento, mercoledì la partita (simulata).
  await page.getByTestId("day-train").click();
  await page.getByTestId("train-tiro").click();
  await page.getByTestId("day-rest").click();
  await page.getByTestId("game-play-match").click();
  await page.getByRole("button", { name: "Simula" }).click();
  await page.getByRole("button", { name: "Continua" }).click({ timeout: 15000 });
  await expect(page.getByText(/^(Vinta|Persa) \d+–\d+$/)).toBeVisible();

  // Si riprende da dove eri.
  const money = await page.getByTestId("game-money").textContent();
  await page.reload();
  await expect(page.getByTestId("game-money")).toHaveText(money!);
  await expect(page.getByText(/^(Vinta|Persa) \d+–\d+$/)).toBeVisible();
});

test("Campetto Star: si gioca davvero, momento per momento", async ({ page }) => {
  await openApp(page, "demo");
  await openGame(page);
  await skipIntro(page);
  await page.getByTestId("day-rest").click();
  await page.getByTestId("day-rest").click();
  await page.getByTestId("game-play-match").click();
  await page.getByRole("radio", { name: /Facile/ }).click();
  await page.getByRole("button", { name: "Gioca", exact: true }).click();
  // La partita è a tutto schermo: niente intestazione dell'app, il tabellone e la telecronaca.
  await expect(page.getByTestId("live-match")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Partita" })).toHaveCount(0);
  await expect(page.getByTestId("live-feed").locator("li").first()).toBeVisible({ timeout: 8000 });
  const box = (await page.getByTestId("live-match").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual((page.viewportSize()?.height ?? 0) - 1);
  let moments = 0;
  for (let guard = 0; guard < 200; guard++) {
    if (await page.getByRole("button", { name: "Continua" }).isVisible()) break;
    const tira = page.getByRole("button", { name: "Tira" });
    const act = page.getByRole("button", { name: /^(Ruba!|Stoppa!)$/ });
    const skip = page.getByTestId("live-skip");
    if ((await tira.isVisible()) && (await tira.isEnabled())) {
      await hold(page, tira, 880);
      moments++;
      await page.waitForTimeout(900);
    } else if ((await act.isVisible()) && (await act.isEnabled())) {
      await page.waitForTimeout(450 + 1250 * 0.75 - 120);
      await act.dispatchEvent("pointerdown");
      moments++;
      await page.waitForTimeout(600);
    } else if ((await skip.isVisible()) && (await skip.isEnabled())) {
      // La telecronaca si salta fino al tuo turno.
      await skip.click();
      await page.waitForTimeout(300);
    } else await page.waitForTimeout(300);
  }
  expect(moments).toBeGreaterThan(0);
  await expect(page.getByText(/^(Vittoria!|Sconfitta)$/)).toBeVisible();
  await expect(page.getByText("Il tuo voto")).toBeVisible();
  await noSideScroll(page);
  await page.getByRole("button", { name: "Continua" }).click();
  await expect(page.getByRole("button", { name: "Vai a domani" })).toBeVisible();
});

test("Campetto Star: le sfide vanno in classifica e costano un gettone", async ({ page }) => {
  await openApp(page, "demo");
  await openGame(page);
  await skipIntro(page);
  await page.getByTestId("open-sfide").click();
  await expect(page.getByTestId("tokens")).toHaveText("5/5");
  await page.getByTestId("play-schiacciate").click();
  await page.getByTestId("dunk-classica").click();
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(500 + 1150 * 0.5 + (k ? 450 : 0));
    await page.getByRole("button", { name: /^(Corri|Salta|Schiaccia)$/ }).dispatchEvent("pointerdown");
  }
  await expect(page.getByTestId("mini-score")).toHaveText(/^(3\d|4\d|50)$/, { timeout: 10000 });
  await expect(page.getByText("Nuovo record!")).toBeVisible();
  await page.getByRole("button", { name: "Torna alle sfide" }).click();
  await expect(page.getByTestId("tokens")).toHaveText("4/5");
  await expect(page.getByTestId("sfida-schiacciate")).toContainText("(tu)");
});

test("Campetto Star: quello che compri si vede anche nell'app", async ({ page }) => {
  await openApp(page, "demo");
  await openGame(page);
  await skipIntro(page);
  await page.getByTestId("open-phone").click();
  await page.getByTestId("app-shopping").click();
  await page.getByTestId("item-cappellino").getByRole("button", { name: "Compra" }).click();
  await expect(page.getByTestId("item-cappellino")).toContainText("Tuo");
  await page.waitForTimeout(1200);
  await page.goto("/profilo");
  await expect(page.locator(".outfit").first()).toBeAttached();
});

test("Campetto Star è in prova: un giocatore normale non lo vede", async ({ page }) => {
  await openApp(page, "demo", "light", "p2");
  await expect(page.getByTestId("game-home")).toHaveCount(0);
  await page.goto("/gioca");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("game")).toHaveCount(0);
});
