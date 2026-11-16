import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, removeUserData } from './launch';

test('opens directly to a usable manual workspace without camera or key', async () => {
  const { app, page, userData } = await launchApp();
  await expect(page.getByRole('button', { name: /Sensing off/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Project brief' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop sensing' })).toHaveCount(0);
  const permission = await app.evaluate(({ systemPreferences }) =>
    systemPreferences.getMediaAccessStatus('camera'),
  );
  expect(typeof permission).toBe('string');
  await app.close();
  await removeUserData(userData);
});

test('a brief draft survives restart and exports exactly what was entered', async () => {
  const first = await launchApp();
  const { page } = first;
  await page.getByLabel(/^Project title/).fill('E2E kiosk refresh');
  await page.getByLabel(/^Objective/).fill('Line one\nLine two with "quotes" ✓');
  await expect(page.getByText(/Saved locally at/)).toBeVisible({ timeout: 10_000 });
  await first.app.close();

  const second = await launchApp(first.userData);
  const drafts = second.page.getByLabel('Saved drafts');
  await drafts.selectOption({ label: 'E2E kiosk refresh' });
  await second.page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(second.page.getByLabel(/^Objective/)).toHaveValue(
    'Line one\nLine two with "quotes" ✓',
  );

  const exportPath = join(first.userData, 'export.json');
  await second.app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
  }, exportPath);
  await second.page.getByRole('button', { name: 'Export JSON…' }).click();
  await expect(second.page.getByText('Exported export.json.')).toBeVisible();
  const exported: unknown = JSON.parse(await readFile(exportPath, 'utf8'));
  expect(exported).toMatchObject({
    format: 'headroom-project-brief',
    status: 'draft',
    title: 'E2E kiosk refresh',
    objective: 'Line one\nLine two with "quotes" ✓',
  });
  await second.app.close();
  await removeUserData(first.userData);
});

// A sensor-accepted or automatic change happens without the user clicking a control, so
// focus must stay in the field being edited. The layout button is activated programmatically
// here to reproduce that path in the real renderer.
test('a layout change made without clicking keeps focus, caret, and values', async () => {
  const { app, page, userData } = await launchApp();
  const objective = page.getByLabel(/^Objective/);
  await objective.fill('Reserve items without help');
  await objective.evaluate((element) => {
    if (element instanceof HTMLTextAreaElement) element.setSelectionRange(7, 7);
  });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === 'One thing at a time',
    );
    button?.click();
  });
  await expect(page.getByRole('button', { name: 'One thing at a time' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await objective.evaluate((element) => element === document.activeElement)).toBe(true);
  expect(
    await objective.evaluate((element) =>
      element instanceof HTMLTextAreaElement ? element.selectionStart : -1,
    ),
  ).toBe(7);
  await expect(page.getByLabel('Intended audience', { exact: false })).toBeHidden();
  await page.getByRole('button', { name: 'Standard' }).click();
  await expect(objective).toHaveValue('Reserve items without help');
  await expect(page.getByLabel('Intended audience', { exact: false })).toBeVisible();
  await app.close();
  await removeUserData(userData);
});
