import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type {} from '../../src/renderer/bridge';
import { launchApp, removeUserData } from './launch';

async function axeViolations(page: Page) {
  // Legacy mode runs axe in the current page; Electron cannot open the extra page the default mode uses.
  const results = await new AxeBuilder({ page })
    .setLegacyMode(true)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.passes.length, 'axe must actually evaluate rules').toBeGreaterThan(10);
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'unknown'}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
}

test('the renderer is isolated: no Node, no navigation, no inline script, only the narrow bridge', async () => {
  const { app, page, userData } = await launchApp();
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
    'undefined',
  );
  expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
    'undefined',
  );
  const bridgeKeys = await page.evaluate(() => Object.keys(window.headroom ?? {}).length);
  expect(bridgeKeys).toBe(25);
  const startUrl = page.url();
  expect(startUrl.startsWith('app://headroom/')).toBe(true);
  await page.evaluate(() => {
    window.location.href = 'https://example.com/';
  });
  await page.waitForTimeout(300);
  expect(page.url()).toBe(startUrl);
  expect(await page.evaluate(() => window.open('https://example.com/'))).toBeNull();
  const inline = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__inlineRan = true';
    document.body.append(script);
    return (window as { __inlineRan?: boolean }).__inlineRan ?? false;
  });
  expect(inline).toBe(false);
  const rejected = await page.evaluate(async () => {
    try {
      await window.headroom?.loadDraft('../../etc/passwd');
      return 'accepted';
    } catch {
      return 'rejected';
    }
  });
  expect(rejected).toBe('rejected');
  const permissions = await page.evaluate(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      return 'granted';
    } catch {
      return 'denied';
    }
  });
  expect(permissions).toBe('denied');
  await app.close();
  await removeUserData(userData);
});

test('both workspaces in both layouts have no automatically detectable WCAG A/AA violations', async () => {
  const { app, page, userData } = await launchApp();
  const found: string[] = [];
  for (const workspace of ['Project brief', 'Learning']) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    for (const layout of ['Standard', 'One thing at a time']) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      found.push(...(await axeViolations(page)).map((v) => `${workspace}/${layout}: ${v}`));
    }
  }
  await page.getByRole('button', { name: /Sensing off/ }).click();
  found.push(...(await axeViolations(page)).map((v) => `sensing panel: ${v}`));
  expect(found).toEqual([]);
  await app.close();
  await removeUserData(userData);
});

test('content reflows at 200% zoom without horizontal scrolling', async () => {
  const { app, page, userData } = await launchApp();
  await app.evaluate(({ BrowserWindow }) => {
    const [window] = BrowserWindow.getAllWindows();
    window?.setSize(1280, 860);
    window?.webContents.setZoomFactor(2);
  });
  await page.waitForTimeout(300);
  for (const workspace of ['Project brief', 'Learning']) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${workspace} horizontal overflow at 200%`).toBeLessThanOrEqual(1);
  }
  await app.close();
  await removeUserData(userData);
});

test('every control in the status strip is reachable by keyboard', async () => {
  const { app, page, userData } = await launchApp();
  const reached = new Set<string>();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    reached.add(await page.evaluate(() => document.activeElement?.textContent.trim() ?? ''));
  }
  for (const name of ['Project brief', 'Learning', 'Standard', 'One thing at a time']) {
    expect([...reached]).toContain(name);
  }
  await app.close();
  await removeUserData(userData);
});
