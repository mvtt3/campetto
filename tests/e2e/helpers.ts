import type { Page } from "@playwright/test";

/** Apre l'app con il backend di prova: "demo" carica una storia di partite, "empty" parte da zero. */
/** Segna la guida come già vista, così non copre le schermate nei test. */
export async function skipTour(page: Page) {
  await page.addInitScript(() => {
    try {
      for (let i = 1; i <= 7; i++) localStorage.setItem(`campetto:tour:p${i}`, JSON.stringify({ version: 1, status: "dismissed", section: null, step: 0 }));
    } catch {
      /* ignore */
    }
  });
}

export async function openApp(page: Page, mode: "demo" | "empty" = "empty", theme: "dark" | "light" = "light", as?: string, tour = false) {
  if (!tour) await skipTour(page);
  await page.addInitScript((t) => {
    try {
      if (!localStorage.getItem("campetto:theme")) localStorage.setItem("campetto:theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
  const who = as ? `&as=${as}` : "";
  await page.goto(mode === "demo" ? `/?mock=demo${who}` : `/?mock=reset&signed=1${who}`);
  await page.getByRole("navigation", { name: "Navigazione principale" }).waitFor();
}

/** La pagina del browser non deve scorrere: solo i contenitori interni possono. */
export async function pageScrolls(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollHeight > window.innerHeight + 1;
  });
}

/**
 * Per le schermate statiche il contenuto deve stare tutto nello schermo: nessun
 * elemento visibile (escluse le decorazioni posizionate in assoluto) deve uscire
 * dal riquadro che lo contiene e lo taglia.
 */
export async function staticContentOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const clips = (el: Element) => {
      const o = getComputedStyle(el).overflow;
      return o === "hidden" || o === "clip";
    };
    document.querySelectorAll<HTMLElement>('[data-testid="scroll-container"].overflow-hidden').forEach((root) => {
      root.querySelectorAll<HTMLElement>("*").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" || cs.position === "fixed" || el.closest("[aria-hidden='true']")) return;
        if (!el.getClientRects().length || el.closest("svg")) return;
        let p = el.parentElement;
        while (p && p !== root.parentElement && !clips(p)) p = p.parentElement;
        if (!p) return;
        const r = el.getBoundingClientRect();
        const pr = p.getBoundingClientRect();
        if (r.height > 0 && (r.bottom > pr.bottom + 1.5 || r.top < pr.top - 1.5)) {
          const by = Math.max(r.bottom - pr.bottom, pr.top - r.top);
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}" esce di ${Math.round(by)}px`);
        }
      });
    });
    return [...new Set(out)].slice(0, 8);
  });
}

/**
 * Nessun "adesivo" (card, pulsanti, filtri) deve avere bordo o ombra tagliati
 * da un contenitore: è quello che si vedeva nei filtri della classifica.
 * Le righe che scorrono di lato vengono controllate solo in verticale, le liste
 * che scorrono in verticale solo in orizzontale.
 */
export async function clippedStickers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>(".sticker, .sticker-sm, .card, .court");
    els.forEach((el) => {
      if (!el.getClientRects().length) return;
      if (el.closest('[role="dialog"], [aria-hidden="true"]')) return;
      const cs = getComputedStyle(el);
      const m = cs.boxShadow.match(/(-?\d+(?:\.\d+)?)px (-?\d+(?:\.\d+)?)px/);
      const sx = m ? Math.max(0, parseFloat(m[1])) : 0;
      const sy = m ? Math.max(0, parseFloat(m[2])) : 0;
      const r = el.getBoundingClientRect();
      let p = el.parentElement;
      while (p && p !== document.body) {
        const ps = getComputedStyle(p);
        if (ps.overflowX !== "visible" || ps.overflowY !== "visible") break;
        p = p.parentElement;
      }
      if (!p || p === document.body) return;
      const pr = p.getBoundingClientRect();
      const horizontalScroller = p.classList.contains("scroll-x");
      const verticalScroller = p.classList.contains("scroll-area");
      const name = `${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}"`;
      if (!verticalScroller && (r.top < pr.top - 0.5 || r.bottom + sy > pr.bottom + 0.5)) out.push(`${name} tagliato in verticale`);
      if (!horizontalScroller && (r.left < pr.left - 0.5 || r.right + sx > pr.right + 0.5)) out.push(`${name} tagliato in orizzontale`);
    });
    return [...new Set(out)].slice(0, 8);
  });
}

/** Titoli delle schermate tagliati con i puntini ("Calenda…"): non devono essercene. */
export async function truncatedTitles(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("h1, h2, button, a")]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
      .filter((el) => el.tagName === "H1" || el.closest("header") || el.closest("nav"))
      .map((el) => `${el.tagName.toLowerCase()} "${el.textContent?.trim()}"`),
  );
}
