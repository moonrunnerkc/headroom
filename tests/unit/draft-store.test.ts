import { chmod, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from '../../src/domain/brief';
import { createDraftStore } from '../../src/main/storage/draft-store';
import type { StoredDraft } from '../../src/shared/draft-schema';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'headroom-store-'));
});
afterEach(async () => {
  await chmod(join(root, 'drafts'), 0o700).catch(() => undefined);
  await rm(root, { recursive: true, force: true });
});

const id = '0f3c9d7e-5b6a-4c2d-9e8f-1a2b3c4d5e6f';
function draft(overrides: Partial<StoredDraft> = {}): StoredDraft {
  return {
    formatVersion: 1,
    id,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:05:00.000Z',
    complete: false,
    sample: false,
    fields: { ...EMPTY_BRIEF, title: 'Kiosk refresh', objective: 'Line one\nLine two "quoted" ✓' },
    ...overrides,
  };
}

describe('draft store', () => {
  it('persists a draft across a new store instance (simulated restart)', async () => {
    expect(await createDraftStore(root).save(draft())).toMatchObject({ status: 'saved' });
    const reopened = createDraftStore(root);
    expect(await reopened.load(id)).toEqual({ status: 'ok', draft: draft() });
    expect(await reopened.list()).toEqual([
      {
        status: 'ok',
        id,
        title: 'Kiosk refresh',
        updatedAt: draft().updatedAt,
        complete: false,
        sample: false,
      },
    ]);
  });

  it('reports malformed files as unreadable without replacing them', async () => {
    const store = createDraftStore(root);
    await store.save(draft());
    const path = join(root, 'drafts', `${id}.json`);
    await writeFile(path, '{ not json');
    expect(await store.list()).toEqual([
      { status: 'unreadable', id, problem: 'The file is not valid JSON.' },
    ]);
    expect(await store.load(id)).toEqual({
      status: 'error',
      message: 'The file is not valid JSON.',
    });
    expect(await readFile(path, 'utf8')).toBe('{ not json');
  });

  it('rejects structurally invalid and mismatched-id drafts', async () => {
    const store = createDraftStore(root);
    await store.save(draft());
    const path = join(root, 'drafts', `${id}.json`);
    await writeFile(path, JSON.stringify({ ...draft(), formatVersion: 2 }));
    expect(await store.list()).toMatchObject([{ status: 'unreadable' }]);
    await writeFile(path, JSON.stringify(draft({ id: '11111111-2222-4333-8444-555555555555' })));
    expect(await store.list()).toMatchObject([{ status: 'unreadable' }]);
  });

  it('reports a failed write and leaves the previous file intact with no temp files', async () => {
    const store = createDraftStore(root);
    await store.save(draft());
    await chmod(join(root, 'drafts'), 0o500);
    const result = await store.save(draft({ fields: { ...EMPTY_BRIEF, title: 'changed' } }));
    expect(result).toMatchObject({ status: 'error' });
    await chmod(join(root, 'drafts'), 0o700);
    expect(await store.load(id)).toMatchObject({
      status: 'ok',
      draft: { fields: { title: 'Kiosk refresh' } },
    });
    expect((await readdir(join(root, 'drafts'))).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects path-like ids before touching the filesystem', async () => {
    const store = createDraftStore(root);
    await expect(store.load('../../etc/passwd')).rejects.toThrow();
    await expect(store.remove('../x')).rejects.toThrow();
  });

  it('deletes drafts', async () => {
    const store = createDraftStore(root);
    await store.save(draft());
    expect(await store.remove(id)).toEqual({ status: 'ok' });
    expect(await store.list()).toEqual([]);
  });

  it('deletes every draft and the preferences file on request', async () => {
    const store = createDraftStore(root);
    await store.save(draft());
    await store.savePreferences({
      formatVersion: 1,
      layout: 'focused',
      mode: 'suggest',
      aiModel: null,
    });
    expect(await store.removeAll()).toEqual({ status: 'ok' });
    expect(await store.list()).toEqual([]);
    expect(await store.loadPreferences()).toMatchObject({
      status: 'ok',
      preferences: { layout: 'standard' },
    });
  });

  it('returns defaults when preferences are missing and an error when they are corrupt', async () => {
    const store = createDraftStore(root);
    expect(await store.loadPreferences()).toMatchObject({
      status: 'ok',
      preferences: { mode: 'manual' },
    });
    await writeFile(
      join(root, 'preferences.json'),
      JSON.stringify({ formatVersion: 1, layout: 'focused', mode: 'automatic', aiModel: null }),
    );
    expect(await store.loadPreferences()).toMatchObject({ status: 'unreadable' });
  });

  it('serializes writes so an older save cannot overwrite a newer one or outlive a deletion', async () => {
    const store = createDraftStore(root);
    const older = store.save(draft({ fields: { ...EMPTY_BRIEF, title: 'older' } }));
    const newer = store.save(draft({ fields: { ...EMPTY_BRIEF, title: 'newer' } }));
    await Promise.all([older, newer]);
    expect(await store.load(id)).toMatchObject({ draft: { fields: { title: 'newer' } } });
    const inFlight = store.save(draft({ fields: { ...EMPTY_BRIEF, title: 'late' } }));
    const cleared = store.removeAll();
    await Promise.all([inFlight, cleared]);
    expect(await store.list()).toEqual([]);
  });
});
