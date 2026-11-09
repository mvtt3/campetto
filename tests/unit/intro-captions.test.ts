import { describe, expect, it } from "vitest";
import { CAPTIONS } from "@/components/intro";

describe("frasi dell'apertura", () => {
  it("una decina, tutte diverse, brevi e senza punto finale", () => {
    expect(CAPTIONS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(CAPTIONS).size).toBe(CAPTIONS.length);
    for (const c of CAPTIONS) {
      expect(c.length).toBeLessThanOrEqual(48);
      expect(c).not.toMatch(/[.!?]$/);
    }
  });
});
