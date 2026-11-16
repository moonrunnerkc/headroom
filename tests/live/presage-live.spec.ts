import { existsSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { SensingSnapshot } from '../../src/shared/sensing-types';
import type {} from '../../src/renderer/bridge';
import { launchApp, removeUserData } from '../e2e/launch';

/**
 * LIVE target-device probe of the real Presage SDK with the real camera. Requires a person in
 * front of the camera, macOS camera permission for the app under test, and PRESAGE_API_KEY in the
 * environment or evidence/local/presage-key.txt (gitignored; never committed). It prints only lifecycle, cadence, quality, and rejection
 * counts; no pulse values are printed or stored.
 */
const KEY_FILE = 'evidence/local/presage-key.txt';
// The key comes from the environment or a gitignored local file, never from source control.
const apiKey = (
  process.env['PRESAGE_API_KEY'] ?? (existsSync(KEY_FILE) ? readFileSync(KEY_FILE, 'utf8') : '')
).trim();
const observeMs = Number(process.env['HEADROOM_OBSERVE_SECONDS'] ?? '120') * 1000;

test('readiness, live pulse stream, gates, and teardown on this Mac', async () => {
  test.skip(apiKey === '', `Set PRESAGE_API_KEY or write the key to ${KEY_FILE}.`);
  test.setTimeout(observeMs + 180_000);
  const { app, page, userData } = await launchApp();
  await page.getByRole('button', { name: /Sensing off/ }).click();
  await page.getByLabel(/I choose to let Headroom use my camera/).check();
  await page.getByLabel(/Presage API key/).fill(apiKey);
  await page.getByRole('button', { name: 'Use key for this session' }).click();
  await expect(page.getByLabel(/Presage API key/)).toHaveValue('');
  await page.getByLabel('Camera', { exact: true }).selectOption({ label: 'MacBook Pro Camera' });
  if (await page.getByRole('button', { name: 'Ask macOS for camera access' }).isVisible()) {
    await page.getByRole('button', { name: 'Ask macOS for camera access' }).click();
  }
  await page.getByRole('button', { name: 'Check readiness' }).click();
  const readiness = page.getByText(/^Readiness: /);
  await readiness.waitFor({ timeout: 60_000 });
  console.log(`[live-sdk] ${await readiness.innerText()}`);

  const snapshots: SensingSnapshot[] = [];
  await page.evaluate(() => {
    const store: unknown[] = [];
    Object.defineProperty(window, '__probe', { value: store });
    window.headroom?.onSnapshot((s) => store.push(s));
  });
  await page.getByRole('button', { name: 'Start sensing' }).click();
  await page.waitForTimeout(observeMs);
  snapshots.push(
    ...(await page.evaluate(
      () => (window as Window & { __probe?: SensingSnapshot[] }).__probe ?? [],
    )),
  );
  const last = snapshots.at(-1);
  const qualities = snapshots.map((s) => s.quality).filter((q, i, all) => q !== all[i - 1]);
  console.log(
    `[live-sdk] snapshots=${String(snapshots.length)} lifecycle=${last?.lifecycle ?? 'none'} processing=${last?.processingStatus ?? 'none'}`,
  );
  console.log(
    `[live-sdk] packets=${String(last?.packetCount ?? 0)} medianIntervalMs=${String(last?.medianIntervalMs ?? 'n/a')}`,
  );
  console.log(`[live-sdk] quality transitions: ${qualities.join(' -> ')}`);
  console.log(
    `[live-sdk] rule=${last?.rule.kind ?? 'none'} rejections=${JSON.stringify(last?.rejections ?? {})}`,
  );
  console.log(
    `[live-sdk] validation=${last?.validation?.name ?? 'none'} insightPackets=${String(last?.insightEventsReceived ?? 0)} failure=${last?.failure?.kind ?? 'none'}`,
  );
  expect(last?.insightEventsReceived ?? 0).toBe(0);

  await page.getByRole('button', { name: 'Stop sensing' }).first().click();
  await expect(page.getByRole('button', { name: /Sensing off/ })).toBeVisible({ timeout: 30_000 });
  const after = await app.evaluate(() => process.memoryUsage().rss);
  console.log(`[live-sdk] stopped; main RSS after stop=${String(Math.round(after / 1e6))} MB`);
  await app.close();
  await removeUserData(userData);
});
