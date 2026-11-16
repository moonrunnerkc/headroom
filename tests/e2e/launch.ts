import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

export interface LaunchedApp {
  readonly app: ElectronApplication;
  readonly page: Page;
  readonly userData: string;
}

/** Launch the built app (out/) with isolated storage. Pass the same userData to simulate a restart. */
export async function launchApp(userData?: string): Promise<LaunchedApp> {
  const dir = userData ?? (await mkdtemp(join(tmpdir(), 'headroom-e2e-')));
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  env['HEADROOM_USER_DATA_DIR'] = dir;
  delete env['ELECTRON_RENDERER_URL'];
  const app = await electron.launch({ args: ['.'], env });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Project brief' }).waitFor();
  return { app, page, userData: dir };
}

export async function removeUserData(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
