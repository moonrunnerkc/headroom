import { expect, test, type ElectronApplication } from '@playwright/test';
import { launchApp, removeUserData } from './launch';

/**
 * SIMULATED Ollama: replaces fetch in the main process with a fake local
 * server so the UI flow is deterministic. This proves wiring, validation, and
 * queue behavior, not model quality or real local inference.
 */
async function simulateOllama(app: ElectronApplication, answer: unknown, delayMs: number) {
  await app.evaluate(
    (_electron, input: { answer: unknown; delayMs: number }) => {
      const json = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });
      globalThis.fetch = async (url: string | URL | Request) => {
        const path = new URL(
          typeof url === 'string' ? url : url instanceof URL ? url.href : url.url,
        ).pathname;
        if (path === '/api/tags')
          return json({
            models: [
              { name: 'simulated:1b', size: 1, details: { family: 'sim', parameter_size: '1B' } },
            ],
          });
        if (path === '/api/show') return json({ capabilities: ['completion'] });
        if (path === '/api/ps') return json({ models: [{ name: 'simulated:1b', size: 1 }] });
        await new Promise((resolve) => setTimeout(resolve, input.delayMs));
        return json({ response: JSON.stringify(input.answer), done: true, done_reason: 'stop' });
      };
    },
    { answer, delayMs },
  );
}

test('the lesson, notes, and navigation work and the AI explanation is marked supplementary', async () => {
  const { app, page, userData } = await launchApp();
  await page.getByRole('button', { name: 'Learning' }).click();
  await expect(page.getByRole('heading', { name: /HTTP caching/ }).first()).toBeVisible();
  await simulateOllama(
    app,
    { explanation: 'max-age sets how long a response stays fresh.', supportingBlockIds: ['b005'] },
    50,
  );
  await page.getByRole('button', { name: 'Refresh models' }).click();
  await page.getByLabel('Local model').selectOption('simulated:1b');
  await page.getByLabel('Go to').selectOption({ label: 'Section 5' });
  const section = page.getByRole('article', { name: /Section 5 of/ });
  await section.getByRole('button', { name: 'Explain this section' }).click();
  await expect(
    section.getByText('AI-generated supplementary explanation', { exact: false }),
  ).toBeVisible();
  await expect(section.getByText('max-age sets how long a response stays fresh.')).toBeVisible();
  await expect(
    section.getByText(/fresh while its age is less than its freshness lifetime/),
  ).toBeVisible();
  await app.close();
  await removeUserData(userData);
});

test('a finished explanation waits in the shared queue instead of interrupting the other workspace', async () => {
  const { app, page, userData } = await launchApp();
  await page.getByRole('button', { name: 'Learning' }).click();
  await simulateOllama(
    app,
    { explanation: 'Validation uses conditional requests.', supportingBlockIds: ['b008'] },
    1_500,
  );
  await page.getByRole('button', { name: 'Refresh models' }).click();
  await page.getByLabel('Local model').selectOption('simulated:1b');
  await page.getByLabel('Go to').selectOption({ label: 'Section 8' });
  await page
    .getByRole('article', { name: /Section 8 of/ })
    .getByRole('button', { name: 'Explain this section' })
    .click();
  await page.getByRole('button', { name: 'Project brief' }).click();
  const title = page.getByLabel(/^Project title/);
  await title.fill('Typing continues');
  await page.getByRole('button', { name: /^Queue \(/ }).click();
  const panel = page.getByRole('complementary', { name: 'Panel' });
  await expect(panel.getByText('Explanation ready.')).toBeVisible({ timeout: 5_000 });
  await expect(title).toHaveValue('Typing continues');
  await panel
    .getByRole('listitem')
    .filter({ hasText: 'Explanation ready.' })
    .getByRole('button', { name: 'Open' })
    .click();
  await expect(page.getByText('Validation uses conditional requests.')).toBeVisible();
  await page.getByRole('button', { name: /^Queue \(/ }).click();
  await expect(panel.getByText('Explanation ready.')).toHaveCount(0);
  await app.close();
  await removeUserData(userData);
});

test('malformed model output is rejected without changing the source', async () => {
  const { app, page, userData } = await launchApp();
  await page.getByRole('button', { name: 'Learning' }).click();
  await simulateOllama(
    app,
    { explanation: 'cites a block that was not sent', supportingBlockIds: ['b999'] },
    10,
  );
  await page.getByRole('button', { name: 'Refresh models' }).click();
  await page.getByLabel('Local model').selectOption('simulated:1b');
  const first = page.getByRole('article', { name: /Section 1 of/ });
  await first.getByRole('button', { name: 'Explain this section' }).click();
  await expect(first.getByRole('alert')).toContainText('not provided');
  await expect(
    first.getByText('AI-generated supplementary explanation', { exact: false }),
  ).toHaveCount(0);
  await app.close();
  await removeUserData(userData);
});
