import { readFile, stat } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { briefToJson, briefToMarkdown } from '../domain/brief-export';
import { SOURCE_CHARACTER_LIMIT, checkSourceText } from '../domain/source-blocks';
import type { EvidenceDocument } from '../shared/evidence-schema';
import type { ExportBriefRequest, FileWriteResult, OpenTextResult } from '../shared/headroom-api';
import { describeFileError, writeFileAtomic } from './storage/atomic-file';

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);
// A UTF-8 character is at most 4 bytes; anything larger cannot be within the character limit.
const MAX_TEXT_BYTES = SOURCE_CHARACTER_LIMIT * 4;

export async function openTextFile(window: BrowserWindow): Promise<OpenTextResult> {
  const choice = await dialog.showOpenDialog(window, {
    title: 'Open a text or Markdown file',
    properties: ['openFile'],
    filters: [{ name: 'Text or Markdown', extensions: ['txt', 'md', 'markdown'] }],
  });
  const path = choice.filePaths[0];
  if (choice.canceled || path === undefined) return { status: 'cancelled' };
  if (!TEXT_EXTENSIONS.has(extname(path).toLowerCase())) {
    return { status: 'error', message: 'Only .txt and .md files can be opened.' };
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) return { status: 'error', message: 'That is not a regular file.' };
    if (info.size > MAX_TEXT_BYTES) {
      return {
        status: 'error',
        message: `The file is longer than ${SOURCE_CHARACTER_LIMIT.toLocaleString('en-US')} characters.`,
      };
    }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await readFile(path));
    const problem = checkSourceText(text);
    if (problem === 'too-long') {
      return {
        status: 'error',
        message: `The file is longer than ${SOURCE_CHARACTER_LIMIT.toLocaleString('en-US')} characters. Nothing was truncated; choose a shorter file.`,
      };
    }
    if (problem === 'empty') return { status: 'error', message: 'The file is empty.' };
    if (problem === 'contains-nul')
      return { status: 'error', message: 'The file contains binary data.' };
    return { status: 'opened', fileName: basename(path), text };
  } catch (error) {
    if (error instanceof TypeError)
      return { status: 'error', message: 'The file is not valid UTF-8 text.' };
    return { status: 'error', message: describeFileError(error) };
  }
}

async function saveWithDialog(
  window: BrowserWindow,
  title: string,
  defaultName: string,
  filter: { name: string; extensions: string[] },
  contents: string,
): Promise<FileWriteResult> {
  const choice = await dialog.showSaveDialog(window, {
    title,
    defaultPath: defaultName,
    filters: [filter],
  });
  if (choice.canceled || choice.filePath === '') return { status: 'cancelled' };
  try {
    await writeFileAtomic(choice.filePath, contents);
    return { status: 'saved', fileName: basename(choice.filePath) };
  } catch (error) {
    return { status: 'error', message: describeFileError(error) };
  }
}

function fileSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug === '' ? 'project-brief' : slug;
}

export function exportBrief(
  window: BrowserWindow,
  request: ExportBriefRequest,
): Promise<FileWriteResult> {
  const meta = {
    exportedAt: new Date().toISOString(),
    complete: request.complete,
    sample: request.sample,
  };
  const slug = fileSlug(request.fields.title);
  return request.format === 'json'
    ? saveWithDialog(
        window,
        'Export brief as JSON',
        `${slug}.json`,
        { name: 'JSON', extensions: ['json'] },
        briefToJson(request.fields, meta),
      )
    : saveWithDialog(
        window,
        'Export brief as Markdown',
        `${slug}.md`,
        { name: 'Markdown', extensions: ['md'] },
        briefToMarkdown(request.fields, meta),
      );
}

export function saveEvidence(
  window: BrowserWindow,
  document: EvidenceDocument,
): Promise<FileWriteResult> {
  const stamp = document.createdAt.replace(/[:.]/g, '-');
  return saveWithDialog(
    window,
    'Save session evidence',
    `headroom-evidence-${stamp}.json`,
    { name: 'JSON', extensions: ['json'] },
    `${JSON.stringify(document, null, 2)}\n`,
  );
}
