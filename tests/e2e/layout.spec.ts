import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config";
import { openApp, pageScrolls, staticContentOverflows } from "./helpers";

// Schermate che devono stare tutte in uno schermo, senza scorrere.
const STATIC = ["/", "/profilo", "/nuova", "/giocatore/p2", "/classifiche", "/partite", "/organizza", "/video"];

for (const vp of VIEWPORTS) {
  for (const theme of ["dark", "light"] as const) {
    test(`${vp.name} ${theme}: nessuna pagina scorre e le schermate fisse stanno nello schermo`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, "demo", theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const path of STATIC) {
        await page.goto(path);
        await page.getByRole("navigation", { name: "Navigazione principale" }).waitFor();
        await page.waitForTimeout(300);
        expect(await pageScrolls(page), `${path} fa scorrere la pagina`).toBe(false);
        expect(await staticContentOverflows(page), `${path} taglia il contenuto`).toEqual([]);
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
