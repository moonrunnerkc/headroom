import { defineConfig } from '@playwright/test';

// Target-device checks that need real local services. Never run in CI. Default export required by Playwright.
export default defineConfig({
  testDir: 'tests/live',
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
});
