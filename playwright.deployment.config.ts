import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./deployment-e2e",
  use: {
    baseURL: "http://127.0.0.1:4174/AI-Synthesis/",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/AI-Synthesis/",
    reuseExistingServer: true,
  },
  projects: [
    { name: "pages-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
  ],
});
