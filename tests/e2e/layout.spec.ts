import { expect, test } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config";
import {
  clippedStickers,
  openApp,
  pageScrolls,
  screenProblems,
  skipTour,
  staticContentOverflows,
  truncatedTitles,
} from "./helpers";

// Schermate che devono stare tutte in uno schermo, senza scorrere.
const STATIC = [
  "/",
  "/profilo",
  "/profilo/notifiche",
  "/giocatore?id=p2",
  "/giocatore?id=p1&anteprima=1",
  "/nuova",
  "/giocatore?id=p3",
  "/classifiche",
  "/partite",
  "/organizza",
  "/video",
  "/admin",
  "/classifiche/albo",
  "/profilo/badge",
  "/profilo/impostazioni",
  "/importa",
  "/statistiche?id=p1",
];

// "demo": qualche settimana di partite; "pieno": un mese intenso, 9 giocatori e nomi lunghi.
for (const vp of VIEWPORTS) {
  for (const [theme, data] of [
    ["dark", "demo"],
    ["light", "demo"],
    ["light", "pieno"],
    ["dark", "pieno"],
  ] as const) {
    test(`${vp.name} ${theme} ${data}: nessuna pagina scorre e le schermate fisse stanno nello schermo`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, data, theme);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      for (const path of STATIC) {
        await page.goto(path);
        await page
          .getByRole("navigation", { name: "Navigazione principale" })
          .waitFor();
        await page.waitForTimeout(300);
        expect(await pageScrolls(page), `${path} fa scorrere la pagina`).toBe(
          false,
        );
        expect(
          await staticContentOverflows(page),
          `${path} taglia il contenuto`,
        ).toEqual([]);
        expect(
          await clippedStickers(page),
          `${path} taglia bordi o ombre`,
        ).toEqual([]);
        expect(
          await truncatedTitles(page),
          `${path} ha titoli tagliati`,
        ).toEqual([]);
        expect(
          await screenProblems(page),
          `${path} ha testi o controlli sovrapposti`,
        ).toEqual([]);
      }
      // La classifica delle squadre, formato per formato.
      await page.goto("/classifiche");
      await page.getByRole("button", { name: "Squadre" }).click();
      for (const f of ["1v1", "2v2", "3v3", "4v4"]) {
        await page.getByRole("tab", { name: f }).click();
        await page.waitForTimeout(450);
        expect(
          await pageScrolls(page),
          `squadre ${f} fa scorrere la pagina`,
        ).toBe(false);
        expect(
          await clippedStickers(page),
          `squadre ${f} taglia bordi o ombre`,
        ).toEqual([]);
        expect(
          await screenProblems(page),
          `squadre ${f} ha testi o controlli sovrapposti`,
        ).toEqual([]);
      }
    });
  }
}

// I nomi più lunghi e larghi che si possono scegliere (16 caratteri), sui telefoni più stretti,
// anche con la partita confermata e in corso.
for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
  test(`${vp.name}: nomi lunghissimi non escono da nessuna parte`, async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await skipTour(page);
    for (const fase of ["", "confermata", "incorso"]) {
      await page.goto(`/?mock=pieno&nomi=lunghi&as=p4&partita=${fase}`);
      await page
        .getByRole("navigation", { name: "Navigazione principale" })
        .waitFor();
      for (const path of fase ? ["/", "/organizza"] : STATIC) {
        await page.goto(path);
        await page
          .getByRole("navigation", { name: "Navigazione principale" })
          .waitFor();
        await page.waitForTimeout(300);
        const where = `${path} ${fase || "normale"}`;
        // L'anteprima della partita (la vedono tutti): con i nomi lunghissimi niente deve uscire
        // dalla scheda. Poi si chiude, come farebbe chiunque, e si controlla la pagina sotto.
        const party = page.locator('[aria-labelledby="party-title"]');
        if (await party.isVisible()) {
          await page.waitForTimeout(2500);
          const fuori = await party.evaluate((d) => {
            const card = d.firstElementChild as HTMLElement;
            const box = card.getBoundingClientRect();
            return [...card.querySelectorAll<HTMLElement>("p, span, li, b, h2, button")]
              // Solo i testi veri: le luci decorative dietro al vetro escono apposta (e sono tagliate).
              .filter((e) => (e.textContent ?? "").trim() !== "" && !e.closest("[aria-hidden=true]"))
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
              })
              .map((e) => (e.textContent ?? "").slice(0, 40));
          });
          expect(fuori, `${where}: testo che esce dall'anteprima`).toEqual([]);
          while (await party.isVisible()) {
            await page.mouse.click(4, 4);
            await page.waitForTimeout(400);
          }
        }
        expect(await pageScrolls(page), `${where} fa scorrere la pagina`).toBe(
          false,
        );
        expect(
          await staticContentOverflows(page),
          `${where} taglia il contenuto`,
        ).toEqual([]);
        expect(
          await screenProblems(page),
          `${where} ha testi o controlli sovrapposti`,
        ).toEqual([]);
      }
    }
  });
}

test("login: schermata d'ingresso senza scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/login?mock=reset");
  await expect(
    page.getByRole("button", { name: "Entra con Google" }),
  ).toBeVisible();
  expect(await pageScrolls(page)).toBe(false);
});
