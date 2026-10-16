import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

const webOrigin = "http://127.0.0.1:4183";
mkdirSync(join(process.cwd(), ".tmp/screenshots"), { recursive: true });

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".tmp/test-results",
  timeout: 60000,
  reporter: [["list"], ["html", { outputFolder: ".tmp/playwright-report", open: "never" }]],
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: webOrigin,
    locale: "zh-CN",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: "pnpm dev",
    env: {
      NODE_ENV: "test",
      SQLITE_PATH: `.tmp/e2e/${Date.now()}.sqlite`,
      DEFAULT_TIME_ZONE: "Asia/Shanghai",
      WEB_PORT: "4183",
      WEB_ORIGIN: webOrigin,
      WEB_BIND_HOST: "127.0.0.1",
      API_PORT: "4184",
    },
    url: webOrigin,
    reuseExistingServer: false,
    timeout: 60000,
  },
});
