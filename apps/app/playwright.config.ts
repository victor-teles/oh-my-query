import { defineConfig, devices } from "@playwright/test";

const port = 3001;
const url = `http://localhost:${port}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  forbidOnly: isCI,
  fullyParallel: true,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  retries: isCI ? 2 : 0,
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: url,
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run vite:dev",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    url,
  },
});
