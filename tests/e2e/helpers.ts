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

export async function openApp(page: Page, mode: "demo" | "empty" | "pieno" = "empty", theme: "dark" | "light" = "light", as?: string, tour = false) {
  if (!tour) await skipTour(page);
  await page.addInitScript((t) => {
    try {
      if (!localStorage.getItem("campetto:theme")) localStorage.setItem("campetto:theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
  const who = as ? `&as=${as}` : "";
  await page.goto(mode === "empty" ? `/?mock=reset&signed=1${who}` : `/?mock=${mode}${who}`);
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
        if (!(el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off")) || el.closest("svg")) return;
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
      if (!(el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off"))) return;
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
      .filter((el) => el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off") && getComputedStyle(el).textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
      .filter((el) => el.tagName === "H1" || el.closest("header") || el.closest("nav"))
      .map((el) => `${el.tagName.toLowerCase()} "${el.textContent?.trim()}"`),
  );
}

/**
 * Controlli per popup e pannelli: dentro lo schermo, nessun testo che esce dal
 * suo pulsante, nessun controllo sovrapposto a un altro.
 */
export async function popupProblems(page: Page, selector: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const out: string[] = [];
    const roots = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off"));
    if (!roots.length) return [`nessun popup "${sel}"`];
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const root of roots) {
      const r = root.getBoundingClientRect();
      if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 3)
        out.push(`popup fuori schermo (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
      // Testi più larghi del loro contenitore (escluse le ellissi volute).
      root.querySelectorAll<HTMLElement>("button, a, h1, h2, h3, p, label, span").forEach((el) => {
        if (!(el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off")) || el.closest("svg")) return;
        const cs = getComputedStyle(el);
        if (cs.textOverflow === "ellipsis" || cs.overflowX === "auto" || cs.overflowX === "scroll" || cs.display === "inline") return;
        // Le icone piccole (la "i" in corsivo) sporgono di un pixel per natura: non contano.
        if (el.clientWidth <= 26 || !(el.textContent || "").trim() || cs.clip !== "auto" || el.clientWidth <= 1) return;
        // Si misura il testo vero (non le aree di tocco invisibili attorno ai pulsanti).
        const box = el.getBoundingClientRect();
        // Solo il testo scritto direttamente qui (i figli si controllano da soli),
        // escluse le sigle di due o tre lettere degli avatar.
        const out1 = [...el.childNodes].some((n) => {
          if (n.nodeType !== Node.TEXT_NODE || (n.textContent || "").trim().length <= 3) return false;
          const range = document.createRange();
          range.selectNodeContents(n);
          return [...range.getClientRects()].some((t) => t.width > 1 && (t.right > box.right + 2 || t.left < box.left - 2));
        });
        if (out1) out.push(`testo che esce: ${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}"`);
      });
      // Testi tagliati in verticale (le code di g, p, q e y sotto la riga).
      root.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, a, button").forEach((el) => {
        if (!(el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off")) || el.closest("svg") || !(el.textContent || "").trim()) return;
        const cs = getComputedStyle(el);
        if (cs.overflowY !== "hidden" && cs.overflowY !== "clip" && cs.textOverflow !== "ellipsis") return;
        // Testi solo per il lettore di schermo (sr-only): nascosti apposta.
        if (cs.clip !== "auto" || cs.clipPath !== "none" || el.clientWidth <= 1 || el.classList.contains("sr-only")) return;
        if (el.scrollHeight > el.clientHeight + 1 && el.clientHeight > 0 && el.clientHeight < 80)
          out.push(`testo tagliato sotto: ${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 30)}"`);
      });
      // Controlli sovrapposti.
      const ctrls = [...root.querySelectorAll<HTMLElement>("button, a, input, textarea, [role='slider'], [role='switch']")].filter(
        (el) => el.getClientRects().length && el.checkVisibility() && !el.closest(".tab-off") && !el.closest("[aria-hidden='true']"),
      );
      // Rettangolo davvero visibile: tagliato dai contenitori che scorrono o nascondono.
      const visible = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
            const pr = p.getBoundingClientRect();
            left = Math.max(left, pr.left); top = Math.max(top, pr.top);
            right = Math.min(right, pr.right); bottom = Math.min(bottom, pr.bottom);
          }
        }
        return { left, top, right, bottom };
      };
      const rects = ctrls.map((el) => ({ el, r: visible(el) })).filter((x) => x.r.right - x.r.left > 1 && x.r.bottom - x.r.top > 1);
      for (let i = 0; i < rects.length; i++)
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i];
          const b = rects[j];
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
          const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
          const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
          if (w > 4 && h > 4)
            out.push(`controlli sovrapposti: "${(a.el.getAttribute("aria-label") || a.el.textContent || "").trim().slice(0, 20)}" e "${(b.el.getAttribute("aria-label") || b.el.textContent || "").trim().slice(0, 20)}"`);
        }
    }
    return out;
  }, selector);
}

/** Sullo schermo intero: controlli sovrapposti e testi che escono, solo la parte visibile. */
export async function screenProblems(page: Page): Promise<string[]> {
  return popupProblems(page, "body");
}
