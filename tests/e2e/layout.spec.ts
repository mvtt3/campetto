import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config";
import { clippedStickers, openApp, pageScrolls, screenProblems, staticContentOverflows, truncatedTitles } from "./helpers";

// Schermate che devono stare tutte in uno schermo, senza scorrere.
const STATIC = ["/", "/profilo", "/profilo/notifiche", "/giocatore/p2", "/nuova", "/giocatore/p3", "/classifiche", "/partite", "/organizza", "/video", "/admin", "/classifiche/albo", "/profilo/badge", "/profilo/impostazioni", "/importa"];

// "demo": qualche settimana di partite; "pieno": un mese intenso, 9 giocatori e nomi lunghi.
for (const vp of VIEWPORTS) {
  for (const [theme, data] of [["dark", "demo"], ["light", "demo"], ["light", "pieno"], ["dark", "pieno"]] as const) {
    test(`${vp.name} ${theme} ${data}: nessuna pagina scorre e le schermate fisse stanno nello schermo`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, data, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const path of STATIC) {
        await page.goto(path);
        await page.getByRole("navigation", { name: "Navigazione principale" }).waitFor();
        await page.waitForTimeout(300);
        expect(await pageScrolls(page), `${path} fa scorrere la pagina`).toBe(false);
        expect(await staticContentOverflows(page), `${path} taglia il contenuto`).toEqual([]);
        expect(await clippedStickers(page), `${path} taglia bordi o ombre`).toEqual([]);
        expect(await truncatedTitles(page), `${path} ha titoli tagliati`).toEqual([]);
        expect(await screenProblems(page), `${path} ha testi o controlli sovrapposti`).toEqual([]);
      }
      // La classifica delle squadre, formato per formato.
      await page.goto("/classifiche");
      await page.getByRole("button", { name: "Squadre" }).click();
      for (const f of ["1v1", "2v2", "3v3", "4v4"]) {
        await page.getByRole("tab", { name: f }).click();
        await page.waitForTimeout(450);
        expect(await pageScrolls(page), `squadre ${f} fa scorrere la pagina`).toBe(false);
        expect(await clippedStickers(page), `squadre ${f} taglia bordi o ombre`).toEqual([]);
        expect(await screenProblems(page), `squadre ${f} ha testi o controlli sovrapposti`).toEqual([]);
      }
    });
  }
}

test("login: schermata d'ingresso senza scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/login?mock=reset");
  await expect(page.getByRole("button", { name: "Entra con Google" })).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
});
