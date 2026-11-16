import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import {
  DEFAULT_PREFERENCES,
  draftIdSchema,
  preferencesSchema,
  storedDraftSchema,
  type DraftListEntry,
  type Preferences,
  type StoredDraft,
} from '../../shared/draft-schema';
import { describeFileError, readJsonFile, writeFileAtomic } from './atomic-file';

/**
 * Drafts live one per file so a corrupt file affects only itself. Unreadable
 * files are reported, never silently replaced; the user decides to delete them.
 */
export function createDraftStore(root: string) {
  const draftsDir = join(root, 'drafts');
  const preferencesPath = join(root, 'preferences.json');
  const draftPath = (id: string) => join(draftsDir, `${draftIdSchema.parse(id)}.json`);
  const ensureDirs = () => mkdir(draftsDir, { recursive: true, mode: 0o700 });

  async function list(): Promise<DraftListEntry[]> {
    await ensureDirs();
    const names = (await readdir(draftsDir)).filter((name) => name.endsWith('.json'));
    const entries: DraftListEntry[] = [];
    for (const name of names) {
      const id = name.slice(0, -'.json'.length);
      if (!draftIdSchema.safeParse(id).success) continue;
      const read = await readJsonFile(join(draftsDir, name));
      if (read.status === 'missing') continue;
      if (read.status === 'unreadable') {
        entries.push({ status: 'unreadable', id, problem: read.problem });
        continue;
      }
      const parsed = storedDraftSchema.safeParse(read.value);
      if (!parsed.success || parsed.data.id !== id) {
        entries.push({
          status: 'unreadable',
          id,
          problem: 'The draft does not match the expected format.',
        });
        continue;
      }
      const draft = parsed.data;
      entries.push({
        status: 'ok',
        id,
        title: draft.fields.title,
        updatedAt: draft.updatedAt,
        complete: draft.complete,
        sample: draft.sample,
      });
    }
    return entries.sort((a, b) =>
      a.status === 'ok' && b.status === 'ok'
        ? b.updatedAt.localeCompare(a.updatedAt)
        : a.status === 'ok'
          ? -1
          : 1,
    );
  }

  async function load(
    id: string,
  ): Promise<{ status: 'ok'; draft: StoredDraft } | { status: 'error'; message: string }> {
    const read = await readJsonFile(draftPath(id));
    if (read.status === 'missing')
      return { status: 'error', message: 'That draft no longer exists.' };
    if (read.status === 'unreadable') return { status: 'error', message: read.problem };
    const parsed = storedDraftSchema.safeParse(read.value);
    if (!parsed.success)
      return { status: 'error', message: 'The draft does not match the expected format.' };
    return { status: 'ok', draft: parsed.data };
  }

  async function save(
    draft: StoredDraft,
  ): Promise<{ status: 'saved'; savedAt: string } | { status: 'error'; message: string }> {
    try {
      await ensureDirs();
      await writeFileAtomic(draftPath(draft.id), `${JSON.stringify(draft, null, 2)}\n`);
      return { status: 'saved', savedAt: new Date().toISOString() };
    } catch (error) {
      return { status: 'error', message: describeFileError(error) };
    }
  }

  async function remove(
    id: string,
  ): Promise<{ status: 'ok' } | { status: 'error'; message: string }> {
    const path = draftPath(id);
    try {
      await rm(path, { force: true });
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: describeFileError(error) };
    }
  }

  /** Delete every draft file and the preferences file Headroom wrote. Exported copies are untouched. */
  async function removeAll(): Promise<{ status: 'ok' } | { status: 'error'; message: string }> {
    try {
      await rm(draftsDir, { recursive: true, force: true });
      await rm(preferencesPath, { force: true });
      return { status: 'ok' };
    } catch (error) {
      return { status: 'error', message: describeFileError(error) };
    }
  }

  async function loadPreferences(): Promise<
    { status: 'ok'; preferences: Preferences } | { status: 'unreadable'; message: string }
  > {
    const read = await readJsonFile(preferencesPath);
    if (read.status === 'missing') return { status: 'ok', preferences: DEFAULT_PREFERENCES };
    if (read.status === 'unreadable') return { status: 'unreadable', message: read.problem };
    const parsed = preferencesSchema.safeParse(read.value);
    if (!parsed.success)
      return {
        status: 'unreadable',
        message: 'Saved preferences do not match the expected format.',
      };
    return { status: 'ok', preferences: parsed.data };
  }

  async function savePreferences(preferences: Preferences) {
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      await writeFileAtomic(preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`);
      return { status: 'saved' as const, savedAt: new Date().toISOString() };
    } catch (error) {
      return { status: 'error' as const, message: describeFileError(error) };
    }
  }

  return { list, load, save, remove, removeAll, loadPreferences, savePreferences };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
