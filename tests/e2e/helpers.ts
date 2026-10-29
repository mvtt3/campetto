import type { Page } from "@playwright/test";

/** Apre l'app con il backend di prova: "demo" carica una storia di partite, "empty" parte da zero. */
export async function openApp(page: Page, mode: "demo" | "empty" = "empty", theme: "dark" | "light" = "dark") {
  await page.addInitScript((t) => {
    try {
      if (!localStorage.getItem("campetto:theme")) localStorage.setItem("campetto:theme", t);
    } catch {
      /* ignore */
    }
  }, theme);
  await page.goto(mode === "demo" ? "/?mock=demo" : "/?mock=reset&signed=1");
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
