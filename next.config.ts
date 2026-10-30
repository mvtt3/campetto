import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * Il numero di versione nasce dal contenuto del codice: uguale in ogni parte della stessa
 * pubblicazione (anche se la configurazione viene letta più volte), diverso appena cambia qualcosa.
 */
function buildId(): string {
  const h = createHash("sha1");
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else h.update(p).update(readFileSync(p));
    }
  };
  walk("src");
  h.update(readFileSync("public/sw.js"));
  return h.digest("hex").slice(0, 12);
}

const nextConfig: NextConfig = {
  // Ogni pubblicazione ha il suo numero: l'app lo confronta col server per aggiornarsi da sola.
  env: { NEXT_PUBLIC_BUILD: buildId() },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: { unoptimized: true },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
