import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS } from "../../playwright.config";
import { openApp, skipTour } from "./helpers";

/**
 * Gli highlights: il feed verticale dei video (per ora solo per l'amministratore).
 * Video finti e leggeri in /public/mock: hl-1 (9 s), hl-2 (7 s), hl-3 verticale (6 s).
 */

const active = (page: Page) =>
  page.locator("[data-testid=hl-slide][data-active]");
const activeIndex = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=hl-slide]")].findIndex(
      (x) => (x as HTMLElement).dataset.active,
    ),
  );
const videoState = (page: Page) =>
  page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>("[data-active] video");
    return v
      ? {
          t: v.currentTime,
          paused: v.paused,
          muted: v.muted,
          ready: v.readyState,
        }
      : null;
  });

async function openFeed(page: Page, extra = "") {
  if (extra) {
    // Un solo caricamento con le prove nell'indirizzo (un secondo farebbe ripartire la demo).
    await skipTour(page);
    await page.goto(`/?mock=demo${extra}`);
    await page
      .getByRole("navigation", { name: "Navigazione principale" })
      .waitFor();
  } else await openApp(page, "demo");
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await page.getByTestId("hl-night").first().click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  await expect(page).toHaveURL(/[?&]h=/);
}

async function waitPlaying(page: Page) {
  await expect
    .poll(async () => (await videoState(page))?.t ?? 0, { timeout: 8000 })
    .toBeGreaterThan(0.3);
}

test("dalla serata si apre il feed, il video parte e indietro lo chiude", async ({
  page,
}) => {
  await openFeed(page);
  await waitPlaying(page);
  expect((await videoState(page))!.paused).toBe(false);
  // Niente contatore dei canestri sopra al video.
  await expect(page.getByTestId("hl-clip")).toHaveCount(0);
  await page.goBack();
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]h=/);
  // Si torna dove si era: la lista delle partite, con la serata aperta.
  await expect(page.getByTestId("hl-night").first()).toBeVisible();
});

test("anche un giocatore normale li vede, mette il mi piace e commenta", async ({
  page,
}) => {
  // Mattia: nei dati di prova non ha ancora messo mi piace.
  await openApp(page, "demo", "light", "p5");
  await expect(page.getByTestId("hl-home")).toBeVisible();
  await page.getByTestId("hl-home").click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  const like = active(page).getByTestId("hl-like");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await active(page).getByTestId("hl-comments").click();
  await page.getByTestId("hl-comment-input").fill("Grande serata");
  await page.getByTestId("hl-comment-send").click();
  await expect(page.getByTestId("hl-comment").last()).toContainText(
    "Grande serata",
  );
});

test("pallone: si mette, si toglie, e coi tocchi a raffica conta l'ultimo", async ({
  page,
}) => {
  await openFeed(page);
  const like = active(page).getByTestId("hl-like");
  const count = async () => Number(await like.locator(".hl-count").innerText());
  const start = await count();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  expect(await count()).toBe(start + 1);
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  expect(await count()).toBe(start);
  // Cinque tocchi veloci: alla fine è messo (dispari), e resta così anche dopo il salvataggio.
  for (let i = 0; i < 5; i++) await like.click({ delay: 10 });
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800);
  await expect(like).toHaveAttribute("aria-pressed", "true");
  expect(await count()).toBe(start + 1);
  // Riaperto il feed, il pallone è ancora lì (salvato davvero).
  await page.goBack();
  await page.getByTestId("hl-night").first().click();
  await expect(active(page).getByTestId("hl-like")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("due tocchi sul video danno il pallone senza fermarlo, uno lo mette in pausa", async ({
  page,
}) => {
  await openFeed(page);
  await waitPlaying(page);
  const stage = active(page).getByTestId("hl-stage");
  await stage.dblclick({ position: { x: 150, y: 120 } });
  await expect(active(page).getByTestId("hl-like")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.waitForTimeout(450);
  expect((await videoState(page))!.paused).toBe(false);
  // Un tocco: pausa (dopo l'attesa del secondo tocco); un altro: riparte.
  await stage.click({ position: { x: 150, y: 120 } });
  await expect.poll(async () => (await videoState(page))!.paused).toBe(true);
  await stage.click({ position: { x: 150, y: 120 } });
  await expect.poll(async () => (await videoState(page))!.paused).toBe(false);
  // Due tocchi quando è già dato non lo tolgono.
  await stage.dblclick({ position: { x: 100, y: 100 } });
  await page.waitForTimeout(400);
  await expect(active(page).getByTestId("hl-like")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("commenti: vuoti no, si scrivono, si eliminano, indietro chiude solo il pannello", async ({
  page,
}) => {
  await openFeed(page);
  await active(page).getByTestId("hl-comments").click();
  const panel = page.getByTestId("hl-comments-panel");
  await expect(panel).toBeInViewport();
  await expect(page).toHaveURL(/[?&]c=1/);
  const input = page.getByTestId("hl-comment-input");
  const send = page.getByTestId("hl-comment-send");
  await expect(send).toBeDisabled();
  await input.fill("    \n   ");
  await expect(send).toBeDisabled();
  // Oltre 280 caratteri non si va.
  await input.fill("a".repeat(400));
  expect((await input.inputValue()).length).toBe(280);
  await input.fill("Rivista tre volte 🔥");
  const before = await page.getByTestId("hl-comment").count();
  await input.press("Enter");
  await expect(page.getByTestId("hl-comment")).toHaveCount(before + 1);
  await expect(page.getByTestId("hl-comment").last()).toContainText(
    "Rivista tre volte 🔥",
  );
  await expect(input).toHaveValue("");
  // Il mio si può eliminare, con un secondo tocco di conferma.
  const del = page
    .getByTestId("hl-comment")
    .last()
    .getByTestId("hl-comment-delete");
  await del.click();
  await expect(del).toHaveText(/Tocca ancora/);
  await del.click();
  await expect(page.getByTestId("hl-comment")).toHaveCount(before);
  // Il contatore sul video segue.
  await page.goBack();
  await expect(panel).not.toBeInViewport();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  await expect(active(page).getByTestId("hl-comments")).toContainText(
    String(before),
  );
  // Esc: prima il pannello, poi il feed.
  await active(page).getByTestId("hl-comments").click();
  await expect(panel).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
});

test("commento che non parte: resta lì con Riprova, e l'avviso si vede sopra al video", async ({
  page,
}) => {
  await openFeed(page, "&guasto=commento");
  await active(page).getByTestId("hl-comments").click();
  await page.getByTestId("hl-comment-input").fill("Questo non arriva");
  await page.getByTestId("hl-comment-send").click();
  await expect(page.getByText("Non inviato")).toBeVisible();
  await expect(
    page.getByText(/non riesce a mandare il commento/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lascia stare" }).click();
  await expect(page.getByText("Questo non arriva")).toHaveCount(0);
});

test("pallone che non si salva: torna com'era e lo dice", async ({ page }) => {
  await openFeed(page, "&guasto=like");
  const like = active(page).getByTestId("hl-like");
  await like.click();
  await expect(
    page.getByText(/non è riuscito a salvare il pallone/),
  ).toBeVisible();
  await expect(like).toHaveAttribute("aria-pressed", "false");
});

test("finito un video parte il successivo; l'ultimo ricomincia", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await openFeed(page);
  await waitPlaying(page);
  // Il primo dura 9 secondi: si passa al secondo da soli.
  await expect.poll(() => activeIndex(page), { timeout: 15_000 }).toBe(1);
  await waitPlaying(page);
  await expect.poll(() => activeIndex(page), { timeout: 15_000 }).toBe(2);
  await waitPlaying(page);
  // L'ultimo (6 s) non porta da nessuna parte: ricomincia.
  await page.waitForTimeout(7500);
  expect(await activeIndex(page)).toBe(2);
  expect((await videoState(page))!.paused).toBe(false);
});

test("scorrere veloce avanti e indietro: niente errori, mai più di tre video in pagina", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openFeed(page);
  const scroller = page.getByTestId("hl-scroller");
  for (const i of [1, 2, 1, 0, 2, 0, 1, 2]) {
    await scroller.evaluate(
      (s, i) => s.scrollTo({ top: i * s.clientHeight, behavior: "instant" }),
      i,
    );
    await page.waitForTimeout(90);
    expect(
      await page.locator("[data-testid=hl-feed] video").count(),
    ).toBeLessThanOrEqual(3);
  }
  await expect.poll(() => activeIndex(page)).toBe(2);
  await waitPlaying(page);
  // Solo quello attivo suona: gli altri sono fermi.
  const playing = await page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLVideoElement>(
          "[data-testid=hl-feed] video",
        ),
      ].filter((v) => !v.paused).length,
  );
  expect(playing).toBe(1);
  expect(errors).toEqual([]);
});

test.describe("rete", () => {
  // Il service worker farebbe passare le richieste senza farle vedere a page.route.
  test.use({ serviceWorkers: "block" });

  test("rete lenta: Spicchio palleggia finché il video arriva", async ({
    page,
  }) => {
    await page.route("**/mock/hl-2.mp4", async (route) => {
      await new Promise((r) => setTimeout(r, 3500));
      await route.continue();
    });
    await openFeed(page);
    await page
      .getByTestId("hl-scroller")
      .evaluate((s) =>
        s.scrollTo({ top: s.clientHeight, behavior: "instant" }),
      );
    await expect(active(page).getByTestId("hl-loading")).toBeVisible();
    await expect(active(page).getByTestId("hl-loading")).toHaveCount(0, {
      timeout: 10_000,
    });
    await waitPlaying(page);
  });

  test("video che non arriva: Riprova, e quando la rete torna parte", async ({
    page,
  }) => {
    let broken = true;
    await page.route("**/mock/hl-1.mp4", (route) =>
      broken ? route.abort("failed") : route.continue(),
    );
    await openFeed(page);
    await expect(active(page).getByTestId("hl-error")).toBeVisible({
      timeout: 10_000,
    });
    broken = false;
    await active(page).getByRole("button", { name: "Riprova" }).click();
    await expect(active(page).getByTestId("hl-error")).toHaveCount(0);
    await waitPlaying(page);
  });
});

test("telefono bloccato: il video si ferma e al ritorno riparte", async ({
  page,
}) => {
  await openFeed(page);
  await waitPlaying(page);
  const setHidden = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => h,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await setHidden(true);
  await expect.poll(async () => (await videoState(page))!.paused).toBe(true);
  await setHidden(false);
  await expect.poll(async () => (await videoState(page))!.paused).toBe(false);
});

test("i video sono sempre muti: si sente solo la musica, che si spegne e si riaccende", async ({
  page,
}) => {
  await openFeed(page);
  const sound = page.getByTestId("hl-sound");
  // Aperta con un tocco: la musica parte subito.
  await expect(sound).toHaveAttribute("data-music", "on");
  await waitPlaying(page);
  expect((await videoState(page))!.muted).toBe(true);
  // Anche se qualcuno prova a dare voce al video, resta muto.
  await page.evaluate(() => {
    document.querySelector<HTMLVideoElement>("[data-active] video")!.muted =
      false;
  });
  await expect.poll(async () => (await videoState(page))!.muted).toBe(true);
  // Spenta a mano: resta spenta anche riaprendo.
  await sound.click();
  await expect(sound).toHaveAttribute("data-music", "off");
  await page.keyboard.press("Escape");
  await page.getByTestId("hl-night").first().click();
  await expect(page.getByTestId("hl-sound")).toHaveAttribute(
    "data-music",
    "off",
  );
  await page.getByTestId("hl-sound").click();
  await expect(page.getByTestId("hl-sound")).toHaveAttribute(
    "data-music",
    "on",
  );
});

test("link diretto senza tocco: la musica aspetta il permesso, poi parte", async ({
  page,
}) => {
  await openApp(page, "demo");
  await page.goto("/partite?h=demo-0");
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  await waitPlaying(page);
  const sound = page.getByTestId("hl-sound");
  await expect(sound).toHaveAttribute("data-music", /blocked|on/);
  if ((await sound.getAttribute("data-music")) === "blocked") {
    await expect(sound).toContainText("Musica");
    await sound.click();
    await expect(sound).toHaveAttribute("data-music", "on");
  }
});

test("ogni video si apre con Spicchio e il titolo, poi parte; un tocco la salta", async ({
  page,
}) => {
  // Si annota quando compare l'apertura e com'è il video in quel momento (niente gare coi tempi).
  await page.addInitScript(() => {
    const w = window as unknown as {
      __intro: { seen: number; playingDuring: boolean };
    };
    w.__intro = { seen: 0, playingDuring: false };
    new MutationObserver(() => {
      const intro = document.querySelector(
        "[data-active] [data-testid=hl-intro]",
      );
      if (!intro) return;
      if (!(intro as HTMLElement).dataset.counted) {
        (intro as HTMLElement).dataset.counted = "1";
        w.__intro.seen++;
      }
      const v = document.querySelector<HTMLVideoElement>("[data-active] video");
      if (v && !v.paused && v.currentTime > 0.2) w.__intro.playingDuring = true;
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await openFeed(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __intro: { seen: number } }).__intro.seen,
      ),
    )
    .toBeGreaterThanOrEqual(1);
  await expect(active(page).getByTestId("hl-intro")).toHaveCount(0, {
    timeout: 4000,
  });
  await waitPlaying(page);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __intro: { playingDuring: boolean } }).__intro
          .playingDuring,
    ),
  ).toBe(false);
  // Il prossimo: di nuovo l'apertura, e un tocco la salta subito.
  await page
    .getByTestId("hl-scroller")
    .evaluate((s) => s.scrollTo({ top: s.clientHeight, behavior: "instant" }));
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __intro: { seen: number } }).__intro.seen,
      ),
    )
    .toBeGreaterThanOrEqual(2);
  const intro = active(page).getByTestId("hl-intro");
  if (await intro.count()) await intro.click({ timeout: 1000 }).catch(() => {});
  await expect(active(page).getByTestId("hl-intro")).toHaveCount(0);
  await waitPlaying(page);
});

test("dalla scheda partita: la scheda lascia il posto al video, indietro torna alla lista", async ({
  page,
}) => {
  await openApp(page, "demo");
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await page.getByTestId("match-row").first().click();
  await page.getByTestId("hl-open").click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: /ottobre|novembre|dicembre/i }),
  ).toHaveCount(0);
  // Si tocca subito: niente blocchi lasciati dalla scheda che si chiude.
  await active(page).getByTestId("hl-like").click({ timeout: 2000 });
  await page.goBack();
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
  await expect(page.getByTestId("match-row").first()).toBeVisible();
  await expect(page).not.toHaveURL(/[?&]m=/);
});

test("dalla Home: il bollino sull'ultima partita apre il suo video", async ({
  page,
}) => {
  await openApp(page, "demo");
  await page.getByTestId("hl-badge").click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  expect(await activeIndex(page)).toBe(0);
  await page.goBack();
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});

for (const vp of VIEWPORTS)
  for (const theme of ["light", "dark"] as const)
    test(`${vp.name} ${theme}: niente si sovrappone nel feed e nei commenti`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openApp(page, "demo", theme);
      await page.getByRole("link", { name: "Partite", exact: true }).click();
      await page.getByTestId("hl-night").first().click();
      await waitPlaying(page);
      const box = async (sel: string) =>
        (await active(page).locator(sel).first().boundingBox())!;
      const overlap = (
        a: { x: number; y: number; width: number; height: number },
        b: { x: number; y: number; width: number; height: number },
      ) =>
        a.x < b.x + b.width - 1 &&
        b.x < a.x + a.width - 1 &&
        a.y < b.y + b.height - 1 &&
        b.y < a.y + a.height - 1;
      const rail = await box(".hl-rail");
      const meta = await box(".hl-meta");
      const ticker = await box(".hl-ticker");
      const top = (await page.locator(".hl-top").boundingBox())!;
      expect(overlap(rail, meta)).toBe(false);
      expect(overlap(rail, ticker)).toBe(false);
      expect(overlap(meta, ticker)).toBe(false);
      expect(rail.y).toBeGreaterThan(top.y + top.height);
      // Il video orizzontale non finisce sotto titolo e pulsanti.
      const v = await page.evaluate(() => {
        const el = document.querySelector<HTMLVideoElement>(
          "[data-active] video",
        )!;
        const r = el.getBoundingClientRect();
        const h = (r.width * el.videoHeight) / el.videoWidth;
        return {
          top: r.top + (r.height - h) / 2,
          bottom: r.top + (r.height + h) / 2,
        };
      });
      expect(v.bottom).toBeLessThanOrEqual(Math.min(rail.y, meta.y) + 1);
      expect(v.top).toBeGreaterThanOrEqual(top.y + top.height - 8);
      // Il titolo non esce dallo schermo.
      expect(meta.x + meta.width).toBeLessThanOrEqual(vp.width);
      // I commenti: pannello dentro lo schermo, casella e invio visibili.
      await active(page).getByTestId("hl-comments").click();
      const panel = page.getByTestId("hl-comments-panel");
      await expect(panel).toBeInViewport();
      await expect(page.getByTestId("hl-comment-input")).toBeInViewport();
      await expect(page.getByTestId("hl-comment-send")).toBeInViewport();
      const pb = (await panel.boundingBox())!;
      expect(pb.y).toBeGreaterThan(30);
      expect(Math.round(pb.y + pb.height)).toBeLessThanOrEqual(vp.height + 1);
      // Nessuna riga di commento esce dal pannello (nomi e parole lunghissime comprese).
      const wide = await page.evaluate(
        () =>
          [...document.querySelectorAll("[data-testid=hl-comment]")].filter(
            (c) => c.scrollWidth > c.clientWidth + 1,
          ).length,
      );
      expect(wide).toBe(0);
    });

for (const theme of ["light", "dark"] as const)
  test(`accessibilità del feed ${theme}`, async ({ page }) => {
    await openApp(page, "demo", theme);
    await page.getByRole("link", { name: "Partite", exact: true }).click();
    await page.getByTestId("hl-night").first().click();
    await waitPlaying(page);
    const check = async () =>
      (
        await new AxeBuilder({ page })
          .include("[data-testid=hl-feed]")
          .disableRules(["color-contrast", "region", "meta-viewport"])
          .analyze()
      ).violations
        .filter((x) => x.impact === "critical" || x.impact === "serious")
        .map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        );
    expect(await check()).toEqual([]);
    await active(page).getByTestId("hl-comments").click();
    await page.waitForTimeout(400);
    expect(await check()).toEqual([]);
  });

test("commenti tanti: si scorre la lista, la casella resta in fondo", async ({
  page,
}) => {
  await openFeed(page, "&commenti=tanti");
  await active(page).getByTestId("hl-comments").click();
  await expect(page.getByTestId("hl-comment")).toHaveCount(60);
  // Si parte dal fondo: l'ultimo commento si vede.
  await expect(page.getByTestId("hl-comment").last()).toBeInViewport();
  await expect(page.getByTestId("hl-comment-input")).toBeInViewport();
  const list = page.getByTestId("hl-comments-list");
  await list.evaluate((l) => (l.scrollTop = 0));
  await expect(page.getByTestId("hl-comment").first()).toBeInViewport();
  // Lo scorrimento della lista non fa scorrere i video sotto.
  expect(await activeIndex(page)).toBe(0);
});

test("rispondere a un commento, come su WhatsApp: citazione, ritorno all'originale, avviso", async ({
  page,
}) => {
  await openFeed(page);
  await active(page).getByTestId("hl-comments").click();
  const rows = page.getByTestId("hl-comment");
  // Nei commenti di prova il secondo risponde già al primo: si vede la citazione.
  await expect(rows.nth(1).getByTestId("hl-quote")).toContainText("Che tripla");
  // Tocco su "Rispondi" del primo: compare la barra "Rispondi a …".
  const firstName = (
    await rows.first().locator("p span.font-bold").innerText()
  ).trim();
  await rows.first().getByTestId("hl-comment-reply").click();
  await expect(page.getByTestId("hl-reply-bar")).toContainText(
    `Rispondi a ${firstName}`,
  );
  // Si può annullare…
  await page.getByTestId("hl-reply-cancel").click();
  await expect(page.getByTestId("hl-reply-bar")).toHaveCount(0);
  // …e rifare trascinando il commento verso destra (col dito).
  const box = (await rows.first().boundingBox())!;
  await rows.first().evaluate((el, b) => {
    const ev = (type: string, x: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerType: "touch",
          clientX: x,
          clientY: b.y + b.height / 2,
        }),
      );
    ev("pointerdown", b.x + 20);
    for (let x = 30; x <= 110; x += 10) ev("pointermove", b.x + x);
    ev("pointerup", b.x + 110);
  }, box);
  await expect(page.getByTestId("hl-reply-bar")).toContainText(
    `Rispondi a ${firstName}`,
  );
  const before = await rows.count();
  await page.getByTestId("hl-comment-input").fill("Vero, che tiro!");
  await page.getByTestId("hl-comment-send").click();
  await expect(rows).toHaveCount(before + 1);
  await expect(page.getByTestId("hl-reply-bar")).toHaveCount(0);
  const mine = rows.last();
  await expect(mine.getByTestId("hl-quote")).toContainText(firstName);
  // La risposta avvisa chi aveva scritto (nel backend di prova resta annotata).
  const notes = await page.evaluate(
    () => JSON.parse(localStorage.getItem("campetto:mock:v1")!).notifications,
  );
  expect(
    notes.some((n: { type: string }) => n.type === "highlight_reply"),
  ).toBe(true);
  // Tocco sulla citazione: si torna all'originale, che si illumina.
  await mine.getByTestId("hl-quote").click();
  await expect(rows.first()).toHaveClass(/hl-flash/);
});

test("la prima volta: la guida spiega lo scorrimento e i due tocchi, poi non torna più", async ({
  page,
}) => {
  await openApp(page, "demo");
  await page.evaluate(() =>
    localStorage.removeItem("campetto:highlights-guida"),
  );
  await page.getByRole("link", { name: "Partite", exact: true }).click();
  await page.getByTestId("hl-night").first().click();
  const hint = page.getByTestId("hl-hint");
  await expect(hint).toBeVisible({ timeout: 4000 });
  await expect(hint).toContainText(/Scorri in su|Due tocchi/);
  // La guida non blocca: si può già toccare il cuore.
  await active(page).getByTestId("hl-like").click();
  await expect(hint).toHaveCount(0);
  await page.goBack();
  await page.getByTestId("hl-night").first().click();
  await page.waitForTimeout(2600);
  await expect(page.getByTestId("hl-hint")).toHaveCount(0);
});

test("dalle notizie: la novità degli highlights apre il video", async ({
  page,
}) => {
  await openApp(page, "demo");
  await page.getByRole("button", { name: /^Notizie/ }).click();
  const card = page.getByTestId("news-highlights");
  await expect(card).toContainText("Arrivano gli highlights");
  await card.click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
});

test("dalla Home: il ciak in alto apre l'ultimo video e perde il pallino", async ({
  page,
}) => {
  await openApp(page, "demo");
  const btn = page.getByTestId("hl-home");
  await expect(btn).toHaveAttribute("aria-label", /da vedere/);
  await btn.click();
  await expect(page.getByTestId("hl-feed")).toBeVisible();
  expect(await activeIndex(page)).toBe(0);
  await page.goBack();
  await expect(page.getByTestId("hl-feed")).toHaveCount(0);
});

test("il racconto della partita: due righe, il resto con un tocco", async ({
  page,
}) => {
  await openFeed(page);
  const desc = active(page).getByTestId("hl-desc");
  await expect(desc).toBeVisible();
  // Il racconto viene dai numeri della partita: com'è finita e chi l'ha decisa.
  await expect(desc).toContainText(/\d+–\d+/);
  const lineH = await desc.evaluate(
    (el) => parseFloat(getComputedStyle(el).lineHeight) || 20,
  );
  const closed = (await desc.boundingBox())!.height;
  expect(closed).toBeLessThanOrEqual(lineH * 2 + 2);
  await desc.click();
  await expect(desc).toHaveAttribute("aria-expanded", "true");
  expect((await desc.boundingBox())!.height).toBeGreaterThan(closed);
  // La striscia dei numeri: etichetta e dato, letti di fila dai lettori di schermo.
  await expect(active(page).locator(".hl-ticker")).toHaveAttribute(
    "aria-label",
    /^Finale .+ · MVP /,
  );
});
