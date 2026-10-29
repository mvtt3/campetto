import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT || 3200);

/** Viewport richiesti: telefoni piccoli e grandi, il Galaxy A05s, iPhone SE e un tablet. */
export const VIEWPORTS = [
  { name: "360x640", width: 360, height: 640 },
  { name: "galaxy-a05s", width: 360, height: 800 },
  { name: "iphone-se", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "tablet", width: 768, height: 1024 },
];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 2,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "flussi",
      testMatch: /flows\.spec\.ts/,
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 } },
    },
    {
      name: "schermate",
      testMatch: /(layout|popups)\.spec\.ts/,
      use: { browserName: "chromium", isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
