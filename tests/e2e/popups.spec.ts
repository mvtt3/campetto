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
      // Tanti popup da aprire uno dopo l'altro: più tempo del solito.
      test.setTimeout(120_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, "demo", theme);
      await page.evaluate(() => {
        localStorage.setItem(
          "campetto:tour:p1",
          JSON.stringify({
            version: 1,
            status: "dismissed",
            section: null,
            step: 0,
          }),
        );
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
      await page
        .getByRole("button", { name: "Come funziona questa classifica" })
        .click();
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
      await page.getByRole("button", { name: /Foto profilo/ }).click();
      await check(page, '[role="dialog"]', "figurine");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /Il tuo personaggio/ }).click();
      await check(page, '[role="dialog"]', "personaggi");
      await page.getByRole("button", { name: "Leggenda, bloccato" }).click();
      await check(
        page,
        "[data-over-sheet] > div:last-child",
        "scheda del personaggio",
      );
      await page.getByRole("button", { name: "Ci provo!" }).click();
      await page.getByRole("button", { name: /^Jack/ }).click();
      await check(
        page,
        "[data-over-sheet] > div:last-child",
        "scheda di un personaggio sbloccato",
      );
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");

      // Classifica delle squadre e la sua "i"
      await page.goto("/classifiche");
      await page.getByRole("button", { name: "Squadre" }).click();
      await page
        .getByRole("button", {
          name: "Come funziona la classifica delle squadre",
        })
        .click();
      await check(page, '[role="tooltip"]', "fumetto squadre");
      await page.mouse.click(5, vp.height / 2);

      // Le feste dopo la partita: risultato e personaggio nuovo.
      await page.evaluate(() => {
        const ms = JSON.parse(localStorage.getItem("campetto:mock:v1")!)
          .matches as {
          id: string;
          playedAt: string;
          players: { playerId: string }[];
        }[];
        const mine = ms
          .filter((m) => m.players.some((p) => p.playerId === "p1"))
          .sort((x, y) => x.playedAt.localeCompare(y.playedAt));
        const fresh = mine.slice(-2).map((m) => m.id);
        localStorage.setItem(
          "campetto:seen-matches:p1",
          JSON.stringify(
            ms.map((m) => m.id).filter((id) => !fresh.includes(id)),
          ),
        );
        localStorage.setItem("campetto:seen-badges:p1", JSON.stringify(["x"]));
        localStorage.setItem("campetto:personaggi:p1", JSON.stringify([]));
      });
      await page.goto("/");
      await check(
        page,
        '[aria-labelledby="party-title"] > div',
        "risultato dell'ultima partita",
      );
      for (let i = 0; i < 8; i++) {
        const party = page.locator('[aria-labelledby="party-title"]');
        if (!(await party.count())) break;
        if (/Nuovo personaggio/.test((await party.textContent()) ?? "")) {
          await page.waitForTimeout(1200);
          await check(
            page,
            '[aria-labelledby="party-title"] > div',
            "personaggio sbloccato",
          );
          await party.getByRole("button", { name: "Dopo" }).click();
          continue;
        }
        await party.getByRole("button").last().click();
        await page.waitForTimeout(450);
      }

      // Un messaggio di Spicchio (errore) in alto.
      await page.goto("/profilo/impostazioni");
      await page.getByRole("button", { name: /Nome nell'app/ }).click();
      await check(page, '[role="dialog"]', "cambio del nome");
      await page.getByLabel("Nuovo nome").fill("c4zz0");
      await check(page, '[role="alert"]', "avviso sul nome");
      await page.keyboard.press("Escape");
      await page.goto("/profilo/impostazioni");
      await page.getByRole("button", { name: /Segnala un problema/ }).click();
      await check(page, '[role="dialog"]', "segnala un problema");
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
