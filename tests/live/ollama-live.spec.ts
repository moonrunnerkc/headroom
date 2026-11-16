import { expect, test } from '@playwright/test';
import { launchApp, removeUserData } from '../e2e/launch';

/**
 * LIVE check against the Ollama runtime on this Mac (no stubs). Set HEADROOM_LIVE_MODEL to an
 * installed local model. Proves the real request path works; it does not judge answer quality.
 */
const model = process.env['HEADROOM_LIVE_MODEL'] ?? '';

test('explains a lesson section with a real local model', async () => {
  test.skip(model === '', 'Set HEADROOM_LIVE_MODEL to run this live check.');
  const { app, page, userData } = await launchApp();
  await page.getByRole('button', { name: 'Learning', exact: true }).click();
  await page.getByLabel('Local model').selectOption(model);
  await page.getByLabel('Go to').selectOption({ label: 'Section 9' });
  const section = page.getByRole('article', { name: /Section 9 of/ });
  const started = Date.now();
  await section.getByRole('button', { name: 'Explain this section' }).click();
  const outcome = section.locator('.explanation, [role="alert"]');
  await outcome.first().waitFor({ timeout: 120_000 });
  const elapsed = Date.now() - started;
  const text = await outcome.first().innerText();
  console.log(`[live-ai] model=${model} elapsedMs=${String(elapsed)}`);
  console.log(`[live-ai] result: ${text.replace(/\s+/g, ' ').slice(0, 400)}`);
  await expect(
    section.getByText('AI-generated supplementary explanation', { exact: false }),
  ).toBeVisible();
  await expect(section.getByText(/no-store/).first()).toBeVisible();
  await app.close();
  await removeUserData(userData);
});
