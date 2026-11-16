export const SOURCE_CHARACTER_LIMIT = 20_000;
/** Paragraphs longer than this are split so one focused block stays readable. */
export const MAX_BLOCK_CHARACTERS = 1_200;

export interface SourceBlock {
  /** Stable for a given source text: the same text always yields the same IDs. */
  readonly id: string;
  readonly index: number;
  readonly start: number;
  readonly end: number;
  /** Exact slice of the source, including its trailing separator whitespace. */
  readonly text: string;
}

const PARAGRAPH_BREAK = /\n[ \t]*\n\s*/g;

function paragraphEnds(source: string): number[] {
  const ends: number[] = [];
  for (const match of source.matchAll(PARAGRAPH_BREAK)) ends.push(match.index + match[0].length);
  if (ends.at(-1) !== source.length) ends.push(source.length);
  return ends;
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

/** Choose a cut in (start, start + limit], preferring a line or sentence end, never splitting a surrogate pair. */
function cutPoint(source: string, start: number, end: number): number {
  const limit = start + MAX_BLOCK_CHARACTERS;
  if (end <= limit) return end;
  const window = source.slice(start, limit);
  const newline = window.lastIndexOf('\n');
  const sentence = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! '),
  );
  const space = window.lastIndexOf(' ');
  const preferred = [newline + 1, sentence + 2, space + 1].find(
    (offset) => offset > MAX_BLOCK_CHARACTERS / 2,
  );
  let cut = start + (preferred ?? MAX_BLOCK_CHARACTERS);
  if (isHighSurrogate(source.charCodeAt(cut - 1))) cut -= 1;
  return cut;
}

/**
 * Split text deterministically into blocks without dropping or rewriting a
 * character: concatenating every block's text reproduces the source exactly.
 * Whitespace-only content is attached to the preceding block.
 */
export function splitIntoBlocks(source: string): SourceBlock[] {
  const ranges: { start: number; end: number }[] = [];
  let start = 0;
  for (const paragraphEnd of paragraphEnds(source)) {
    while (start < paragraphEnd) {
      const end = cutPoint(source, start, paragraphEnd);
      const last = ranges.at(-1);
      if (last !== undefined && source.slice(start, end).trim() === '') last.end = end;
      else ranges.push({ start, end });
      start = end;
    }
  }
  return ranges.map((range, index) => ({
    id: `b${String(index + 1).padStart(3, '0')}`,
    index,
    start: range.start,
    end: range.end,
    text: source.slice(range.start, range.end),
  }));
}

export function joinBlocks(blocks: readonly SourceBlock[]): string {
  return blocks.map((block) => block.text).join('');
}

export type SourceTextProblem = 'empty' | 'too-long' | 'contains-nul';

export function checkSourceText(text: string): SourceTextProblem | null {
  if (text.trim() === '') return 'empty';
  if (text.length > SOURCE_CHARACTER_LIMIT) return 'too-long';
  if (text.includes('\0')) return 'contains-nul';
  return null;
}
