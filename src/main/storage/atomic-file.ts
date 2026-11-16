import { randomUUID } from 'node:crypto';
import { open, readFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const MAX_STORED_FILE_BYTES = 1_000_000;

/**
 * Write via a sibling temporary file, fsync, then rename, so a crash leaves
 * either the old or the new complete file. The temporary file is removed if
 * any step fails, and the failure is rethrown for the caller to report.
 */
export async function writeFileAtomic(path: string, contents: string): Promise<void> {
  const bytes = Buffer.from(contents, 'utf8');
  if (bytes.byteLength > MAX_STORED_FILE_BYTES) {
    throw new Error(
      `refusing to write ${bytes.byteLength} bytes; limit is ${MAX_STORED_FILE_BYTES}`,
    );
  }
  const temporary = join(dirname(path), `.${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    await rename(temporary, path);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporary, { force: true });
    throw error;
  }
}

export type ReadJsonResult =
  | { readonly status: 'ok'; readonly value: unknown }
  | { readonly status: 'missing' }
  | { readonly status: 'unreadable'; readonly problem: string };

export async function readJsonFile(path: string): Promise<ReadJsonResult> {
  let text: string;
  try {
    const bytes = await readFile(path);
    if (bytes.byteLength > MAX_STORED_FILE_BYTES) {
      return { status: 'unreadable', problem: 'The file is larger than Headroom writes.' };
    }
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return { status: 'missing' };
    if (error instanceof TypeError)
      return { status: 'unreadable', problem: 'The file is not valid UTF-8.' };
    throw error;
  }
  try {
    return { status: 'ok', value: JSON.parse(text) };
  } catch {
    return { status: 'unreadable', problem: 'The file is not valid JSON.' };
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

const FILE_ERROR_TEXT: Readonly<Record<string, string>> = {
  ENOSPC: 'The disk is full.',
  EACCES: 'Headroom does not have permission to write there.',
  EPERM: 'Headroom does not have permission to write there.',
  EROFS: 'The location is read-only.',
};

export function describeFileError(error: unknown): string {
  if (isNodeError(error)) {
    const code = error.code ?? 'unknown error';
    return FILE_ERROR_TEXT[code] ?? `The file operation failed (${code}).`;
  }
  return error instanceof Error ? error.message : 'The file operation failed.';
}
