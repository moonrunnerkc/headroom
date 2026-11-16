import { defineConfig } from '@playwright/test';

// Release gate for the built .app (run `npm run package:mac` first). Default export required by Playwright.
export default defineConfig({
  testDir: 'tests/packaged',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
});
