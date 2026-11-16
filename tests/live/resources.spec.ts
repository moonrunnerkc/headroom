import { test } from '@playwright/test';
import { launchApp, removeUserData } from '../e2e/launch';

/**
 * Target-device resource measurement without sensing: startup time and memory before and after
 * repeated layout switches and typing. Reports observations only; it asserts nothing about speed.
 */
test('startup and memory behavior across repeated layout changes', async () => {
  const started = Date.now();
  // --expose-gc lets the probe collect garbage before each reading so growth is not GC lag.
  const { app, page, userData } = await launchApp(undefined, ['--js-flags=--expose-gc']);
  const startupMs = Date.now() - started;
  const memory = async () => {
    await page.evaluate(() => {
      (globalThis as { gc?: () => void }).gc?.();
    });
    return app.evaluate(({ app: electronApp }) => {
      const metrics = electronApp.getAppMetrics();
      return Math.round(metrics.reduce((sum, m) => sum + m.memory.workingSetSize, 0) / 1024);
    });
  };
  const heap = () =>
    page.evaluate(
      () =>
        Math.round(
          ((performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
            ?.usedJSHeapSize ?? 0) / 1e5,
        ) / 10,
    );
  const before = await memory();
  const heapBefore = await heap();
  const objective = page.getByLabel(/^Objective/);
  const heapByRound: number[] = [];
  for (let round = 0; round < 150; round++) {
    if (round % 50 === 0) heapByRound.push(await heap());
    await page.getByRole('button', { name: 'One thing at a time' }).click();
    await page.getByRole('button', { name: 'Standard' }).click();
    await page.getByRole('button', { name: 'Learning', exact: true }).click();
    await page.getByRole('button', { name: 'Project brief', exact: true }).click();
  }
  const typingStarted = Date.now();
  await objective.pressSequentially('x'.repeat(500), { delay: 0 });
  const typingMs = Date.now() - typingStarted;
  await page.waitForTimeout(2_000);
  const after = await memory();
  heapByRound.push(await heap());
  console.log(`[resources] startupToWindowMs=${String(startupMs)}`);
  console.log(
    `[resources] totalWorkingSetMB before=${String(before)} after600LayoutSwitches=${String(after)}`,
  );
  console.log(
    `[resources] rendererHeapMB start=${String(heapBefore)} perRound=${heapByRound.join(',')}`,
  );
  console.log(`[resources] typed500CharsMs=${String(typingMs)} (includes Playwright overhead)`);
  await app.close();
  await removeUserData(userData);
});
