export type WorkspaceId = 'brief' | 'learning';

type QueueItemKind = 'contextual-help' | 'suggestion' | 'explanation-ready';

/**
 * Optional, postponable content only. Errors, permission prompts, save
 * failures, and active validation never enter this queue.
 */
export interface QueueItem {
  readonly id: string;
  readonly workspace: WorkspaceId;
  /** Task-context version the item belongs to; items for an older version are obsolete. */
  readonly contextVersion: string;
  readonly kind: QueueItemKind;
  readonly origin: 'user-requested' | 'unsolicited';
  readonly createdAtMs: number;
  readonly dedupeKey: string;
  readonly title: string;
  readonly detail: string;
  /** Where opening the item navigates, within its own workspace. */
  readonly target: string;
}

export const QUEUE_LIMIT = 20;

export type RequestQueue = readonly QueueItem[];

function removeAt(queue: RequestQueue, index: number): RequestQueue {
  return [...queue.slice(0, index), ...queue.slice(index + 1)];
}

function oldestIndex(queue: RequestQueue, origin: QueueItem['origin']): number {
  let found = -1;
  queue.forEach((item, index) => {
    const best = queue[found];
    if (item.origin === origin && (best === undefined || item.createdAtMs < best.createdAtMs)) {
      found = index;
    }
  });
  return found;
}

/**
 * Add an item. A duplicate key keeps the existing entry (its age and position)
 * so repeated triggers cannot jump the queue. At the limit, the oldest
 * unsolicited item is discarded first; a user-requested item is discarded only
 * when every item is user-requested, and its content remains in its workspace.
 */
export function enqueue(queue: RequestQueue, item: QueueItem): RequestQueue {
  if (queue.some((existing) => existing.dedupeKey === item.dedupeKey)) return queue;
  let next: RequestQueue = [...queue, item];
  while (next.length > QUEUE_LIMIT) {
    const unsolicited = oldestIndex(next, 'unsolicited');
    next = removeAt(next, unsolicited >= 0 ? unsolicited : oldestIndex(next, 'user-requested'));
  }
  return next;
}

export function dismiss(queue: RequestQueue, id: string): RequestQueue {
  return queue.filter((item) => item.id !== id);
}

/** Drop items whose task context changed (new draft, new document, completed task). */
export function invalidateContext(
  queue: RequestQueue,
  workspace: WorkspaceId,
  currentContextVersion: string,
): RequestQueue {
  return queue.filter(
    (item) => item.workspace !== workspace || item.contextVersion === currentContextVersion,
  );
}

/** User-requested help first, then unsolicited items; each group oldest first. */
export function ordered(queue: RequestQueue): RequestQueue {
  const rank = (item: QueueItem) => (item.origin === 'user-requested' ? 0 : 1);
  return [...queue].sort((a, b) => rank(a) - rank(b) || a.createdAtMs - b.createdAtMs);
}

export interface HelpContext {
  readonly workspace: WorkspaceId;
  readonly contextVersion: string;
  /** Current step or block; contextual items for other targets wait in the queue. */
  readonly target: string;
}

/**
 * Items shown inline next to the active task. Focused layout allows at most one
 * contextual help item; standard layout shows every item for the current target.
 * Nothing from another workspace is ever shown inline.
 */
export function inlineHelp(
  queue: RequestQueue,
  layout: 'standard' | 'focused',
  context: HelpContext,
): RequestQueue {
  const relevant = ordered(queue).filter(
    (item) =>
      item.workspace === context.workspace &&
      item.contextVersion === context.contextVersion &&
      item.target === context.target,
  );
  return layout === 'focused' ? relevant.slice(0, 1) : relevant;
}
