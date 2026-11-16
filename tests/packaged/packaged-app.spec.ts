import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import type {} from '../../src/renderer/bridge';

const executable = 'release/mac-arm64/Headroom.app/Contents/MacOS/Headroom';

test('the packaged app starts, loads the bundled Presage runtime, and works without a camera', async () => {
  expect(existsSync(executable), 'run npm run package:mac first').toBe(true);
  const userData = await mkdtemp(join(tmpdir(), 'headroom-packaged-'));
  const app = await electron.launch({
    executablePath: executable,
    env: { ...process.env, HEADROOM_USER_DATA_DIR: userData },
  });
  const page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: 'Project brief' })).toBeVisible();
  const info = await page.evaluate(() => window.headroom?.appInfo());
  expect(info).toMatchObject({ packaged: true, sdkVersion: '3.5.0', apiKeyPresent: false });
  const cameras = await page.evaluate(() => window.headroom?.listCameras());
  expect(cameras).toMatchObject({ status: 'ok' });
  await page.getByRole('button', { name: 'Learning', exact: true }).click();
  await expect(page.getByText(/HTTP caching: reusing responses safely/).first()).toBeVisible();
  await app.close();
  await rm(userData, { recursive: true, force: true });
});
