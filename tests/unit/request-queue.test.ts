import { describe, expect, it } from 'vitest';
import {
  QUEUE_LIMIT,
  dismiss,
  enqueue,
  inlineHelp,
  invalidateContext,
  ordered,
  type QueueItem,
  type RequestQueue,
} from '../../src/domain/request-queue';

function item(overrides: Partial<QueueItem> & Pick<QueueItem, 'id'>): QueueItem {
  return {
    workspace: 'brief',
    contextVersion: 'v1',
    kind: 'contextual-help',
    origin: 'unsolicited',
    createdAtMs: 0,
    dedupeKey: overrides.id,
    title: 'Title',
    detail: 'Detail',
    target: 'basics',
    ...overrides,
  };
}

function fill(count: number, base: Partial<QueueItem> = {}): RequestQueue {
  let queue: RequestQueue = [];
  for (let i = 0; i < count; i++)
    queue = enqueue(queue, item({ id: `i${i}`, createdAtMs: i, ...base }));
  return queue;
}

describe('request queue', () => {
  it('deduplicates by key and keeps the original entry', () => {
    const first = enqueue([], item({ id: 'a', dedupeKey: 'k', createdAtMs: 1 }));
    const second = enqueue(first, item({ id: 'b', dedupeKey: 'k', createdAtMs: 2 }));
    expect(second).toEqual(first);
  });

  it(`never exceeds ${QUEUE_LIMIT} items and discards the oldest unsolicited item first`, () => {
    const userItem = item({ id: 'user', origin: 'user-requested', createdAtMs: -10 });
    let queue = enqueue(fill(QUEUE_LIMIT - 1), userItem);
    queue = enqueue(queue, item({ id: 'new', createdAtMs: 100 }));
    expect(queue).toHaveLength(QUEUE_LIMIT);
    expect(queue.map((q) => q.id)).not.toContain('i0');
    expect(queue.map((q) => q.id)).toContain('user');
    expect(queue.map((q) => q.id)).toContain('new');
  });

  it('only discards user-requested items when nothing unsolicited remains', () => {
    const queue = enqueue(
      fill(QUEUE_LIMIT, { origin: 'user-requested' }),
      item({ id: 'extra', origin: 'user-requested', createdAtMs: 99 }),
    );
    expect(queue).toHaveLength(QUEUE_LIMIT);
    expect(queue.map((q) => q.id)).not.toContain('i0');
  });

  it('orders user-requested help ahead of unsolicited suggestions', () => {
    const queue = [
      item({ id: 'old', createdAtMs: 1 }),
      item({ id: 'asked', origin: 'user-requested', createdAtMs: 5 }),
    ];
    expect(ordered(queue).map((q) => q.id)).toEqual(['asked', 'old']);
  });

  it('removes obsolete items when only their own workspace context changes', () => {
    const queue = [
      item({ id: 'brief-old', contextVersion: 'v1' }),
      item({ id: 'learn', workspace: 'learning', contextVersion: 'v1' }),
    ];
    expect(invalidateContext(queue, 'brief', 'v2').map((q) => q.id)).toEqual(['learn']);
  });

  it('dismisses by id', () => {
    expect(dismiss([item({ id: 'a' }), item({ id: 'b' })], 'a').map((q) => q.id)).toEqual(['b']);
  });

  it('shows at most one inline item in focused layout and none from other workspaces', () => {
    const queue = [
      item({ id: 'a', createdAtMs: 2 }),
      item({ id: 'b', createdAtMs: 1 }),
      item({ id: 'other', workspace: 'learning' }),
      item({ id: 'elsewhere', target: 'budget' }),
    ];
    const context = { workspace: 'brief' as const, contextVersion: 'v1', target: 'basics' };
    expect(inlineHelp(queue, 'focused', context).map((q) => q.id)).toEqual(['b']);
    expect(inlineHelp(queue, 'standard', context).map((q) => q.id)).toEqual(['b', 'a']);
  });
});
