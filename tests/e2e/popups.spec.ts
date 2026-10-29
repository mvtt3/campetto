import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config";
import { openApp, popupProblems } from "./helpers";

/**
 * Collaudo di popup, menu e pannelli su tutti i formati, chiaro e scuro:
 * ognuno deve stare nello schermo, senza testi che escono né controlli sovrapposti.
 */
async function check(page: Page, sel: string, what: string) {
  await page.waitForTimeout(700);
  expect(await popupProblems(page, sel), what).toEqual([]);
}

for (const vp of VIEWPORTS) {
  for (const theme of ["light", "dark"] as const) {
    test(`${vp.name} ${theme}: popup e pannelli`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, "demo", theme);
      await page.evaluate(() => {
        localStorage.setItem("campetto:tour:p1", JSON.stringify({ version: 1, status: "dismissed", section: null, step: 0 }));
        localStorage.removeItem("campetto:seen-badges:p1");
      });

      // Dettaglio partita
      await page.goto("/partite");
      await page.getByTestId("match-row").first().click();
      await check(page, '[role="dialog"]', "dettaglio partita");
      await page.keyboard.press("Escape");

      // Menu del formato
      await page.goto("/classifiche");
      await page.getByRole("button", { name: "Formato" }).click();
      await check(page, '[role="listbox"]', "menu formato");
      await page.keyboard.press("Escape");

      // Fumetto della "i"
      await page.getByRole("button", { name: "Come funziona questa classifica" }).click();
      await check(page, '[role="tooltip"]', "fumetto info");
      await page.mouse.click(5, vp.height / 2);

      // Proposta con orologio
      await page.goto("/organizza?nuova=1");
      await check(page, '[role="dialog"]', "proposta");
      await page.getByRole("button", { name: "Altro orario" }).click();
      await check(page, '[role="dialog"]', "proposta con orologio");

      // Data della partita
      await page.goto("/nuova");
      await page.getByRole("button", { name: /^Quando:/ }).click();
      await check(page, '[role="dialog"]', "quando si è giocato");
      await page.getByRole("button", { name: "Altro orario" }).click();
      await check(page, '[role="dialog"]', "quando con orologio");

      // Figurine e notifiche
      await page.goto("/profilo/impostazioni");
      await page.getByRole("button", { name: "Cambia foto profilo" }).click();
      await check(page, '[role="dialog"]', "figurine");
      await page.keyboard.press("Escape");
      await page.goto("/profilo/notifiche");
      await check(page, "main", "pagina notifiche");

      // Guida: si riparte come al primo ingresso.
      await page.addInitScript(() => {
        if (sessionStorage.getItem("tour-reset")) return;
        sessionStorage.setItem("tour-reset", "1");
        localStorage.removeItem("campetto:tour:p1");
      });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "Inizia" })).toBeVisible();
      await check(page, '[role="dialog"]', "benvenuto della guida");
      await page.getByRole("button", { name: "Inizia" }).click();
      await check(page, '[role="dialog"]', "primo passo della guida");
    });
  }
}
