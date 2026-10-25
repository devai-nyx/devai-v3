// 08 B.23: test/e2e/*.playwright.ts against the web shell; the browser is named, never implied.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: /\.playwright\.ts$/,
  outputDir: '.playwright/results',
  use: { baseURL: 'http://127.0.0.1:4200' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'cd apps/web && ../../node_modules/.bin/ng serve --host 127.0.0.1 --port 4200',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 180_000,
  },
});
