import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openApp } from "./helpers";

/**
 * Salute generale: ogni schermata si apre senza errori nella console né risorse
 * mancanti, con tutti i dati possibili (vuoto, demo, mese pieno, giocatore normale),
 * e senza problemi di accessibilità gravi.
 */

const ROUTES = [
  "/",
  "/classifiche",
  "/classifiche/albo",
  "/partite",
  "/profilo",
  "/profilo/badge",
  "/profilo/impostazioni",
  "/profilo/notifiche",
  "/giocatore?id=p2",
  "/giocatore/badge?id=p3",
  // I vecchi indirizzi portano a quelli nuovi.
  "/giocatore/p2",
  "/giocatore/p3/badge",
  "/organizza",
  "/nuova",
  "/admin",
  "/video",
  "/importa",
  "/privacy",
  "/termini",
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`errore: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // Il meteo arriva da un servizio esterno che a volte limita le richieste: non è un errore dell'app.
    if (/Failed to load resource|open-meteo/.test(t)) return;
    problems.push(`console: ${t.slice(0, 160)}`);
  });
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.hostname === "localhost" && r.status() >= 400) problems.push(`${r.status()} ${u.pathname}`);
  });
  return problems;
}

for (const [mode, as] of [["empty", undefined], ["demo", undefined], ["pieno", undefined], ["demo", "p2"]] as const) {
  test(`nessun errore in nessuna schermata: ${mode}${as ? ` come ${as}` : ""}`, async ({ page }) => {
    test.setTimeout(120_000);
    const problems = watch(page);
    await openApp(page, mode, "light", as);
    for (const r of ROUTES) {
      await page.goto(r);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(250);
    }
    // Anche cambiando scheda dalla barra e tornando indietro.
    await page.goto("/");
    for (const name of ["Classifica", "Partite", "Profilo", "Home"]) {
      await page.getByRole("navigation", { name: "Navigazione principale" }).getByRole("link", { name, exact: true }).click();
      await page.waitForTimeout(300);
    }
    await page.goBack();
    await page.goBack();
    await page.waitForTimeout(300);
    expect(problems).toEqual([]);
  });
}

test("un invito che non esiste: messaggio chiaro, nessun errore", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/invito/non-esiste?mock=reset");
  await page.waitForTimeout(1200);
  await expect(page.locator("body")).not.toBeEmpty();
  expect(problems.filter((p) => !p.startsWith("404"))).toEqual([]);
});

test("una pagina che non c'è torna a casa senza rompersi", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/pagina-che-non-esiste?mock=demo");
  await page.waitForTimeout(800);
  await expect(page.locator("body")).toContainText(/\S/);
  expect(problems.filter((p) => !p.startsWith("404"))).toEqual([]);
});

for (const theme of ["light", "dark"] as const) {
  test(`accessibilità ${theme}: niente problemi gravi`, async ({ page }) => {
    await openApp(page, "pieno", theme);
    const serious: string[] = [];
    for (const r of ["/", "/classifiche", "/partite", "/profilo", "/profilo/impostazioni", "/giocatore?id=p2", "/classifiche/albo", "/organizza", "/nuova"]) {
      await page.goto(r);
      await page.waitForTimeout(700);
      // Lo zoom è tolto per scelta (l'app si usa come un'app): la regola sul viewport non si applica.
      const res = await new AxeBuilder({ page }).disableRules(["color-contrast", "region", "meta-viewport"]).analyze();
      for (const v of res.violations.filter((x) => x.impact === "critical" || x.impact === "serious"))
        serious.push(`${r} ${v.id}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
    }
    expect(serious).toEqual([]);
  });
}

test("niente zoom: l'app si usa come un'app", async ({ page }) => {
  await openApp(page, "demo");
  const content = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(content).toMatch(/maximum-scale=1/);
  expect(content).toMatch(/user-scalable=(no|0)/);
  const ta = await page.evaluate(() => getComputedStyle(document.querySelector("main")!).touchAction);
  expect(ta).not.toMatch(/pinch-zoom|auto|manipulation/);
  // Dove serve trascinare liberamente (l'orologio) il gesto resta all'app.
  await page.goto("/organizza?nuova=1");
  await page.getByRole("button", { name: "Altro orario" }).click();
  const dial = page.getByRole("slider", { name: "Ora" });
  await expect(dial).toBeVisible();
  expect(await dial.evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
});
