import { describe, expect, it } from 'vitest';
import {
  MAX_BLOCK_CHARACTERS,
  SOURCE_CHARACTER_LIMIT,
  checkSourceText,
  joinBlocks,
  splitIntoBlocks,
} from '../../src/domain/source-blocks';

const samples = [
  '',
  'one line',
  '\n\n  leading whitespace\n\nsecond\n',
  'para one\n\npara two\r\n\r\npara three\n\n\n\n',
  '# Heading\n\n- item\n- item\n\n```\ncode\n\n\nblock\n```\n',
  '<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>',
  'emoji 😀 '.repeat(400),
  'x'.repeat(5_000),
  ('Sentence number one is here. '.repeat(80) + '\n\n').repeat(3),
  '   \n\n   \n\n',
];

describe('splitIntoBlocks', () => {
  it.each(samples.map((s, i) => [i, s] as const))('reproduces source %i exactly', (_i, source) => {
    const blocks = splitIntoBlocks(source);
    expect(joinBlocks(blocks)).toBe(source);
    blocks.forEach((block, index) => {
      expect(block.index).toBe(index);
      expect(block.text).toBe(source.slice(block.start, block.end));
      expect(block.text.length).toBeLessThanOrEqual(MAX_BLOCK_CHARACTERS * 2);
    });
  });

  it('is deterministic and assigns stable IDs', () => {
    const source = 'a\n\nb\n\nc';
    expect(splitIntoBlocks(source)).toEqual(splitIntoBlocks(source));
    expect(splitIntoBlocks(source).map((b) => b.id)).toEqual(['b001', 'b002', 'b003']);
  });

  it('never splits a surrogate pair', () => {
    const blocks = splitIntoBlocks('😀'.repeat(2_000));
    for (const block of blocks) {
      expect(/^[\uDC00-\uDFFF]/.test(block.text)).toBe(false);
      expect(/[\uD800-\uDBFF]$/.test(block.text)).toBe(false);
    }
  });

  it('keeps whitespace-only content with the preceding block', () => {
    const blocks = splitIntoBlocks('text\n\n   \n\n');
    expect(blocks).toHaveLength(1);
  });
});

describe('checkSourceText', () => {
  it('rejects empty, oversized, and NUL-containing text instead of truncating', () => {
    expect(checkSourceText('  ')).toBe('empty');
    expect(checkSourceText('a'.repeat(SOURCE_CHARACTER_LIMIT))).toBeNull();
    expect(checkSourceText('a'.repeat(SOURCE_CHARACTER_LIMIT + 1))).toBe('too-long');
    expect(checkSourceText('a\0b')).toBe('contains-nul');
  });
});
