import { useCallback, useState } from 'react';
import {
  dismiss,
  enqueue,
  invalidateContext,
  type QueueItem,
  type RequestQueue,
  type WorkspaceId,
} from '../../domain/request-queue';
import type { EvidenceRecorder } from '../evidence-log';

export type NewQueueItem = Omit<QueueItem, 'id' | 'createdAtMs'>;

/** The one optional-request queue shared by both workspaces. */
export function useRequestQueue(recorder: EvidenceRecorder) {
  const [queue, setQueue] = useState<RequestQueue>([]);

  const add = useCallback(
    (item: NewQueueItem) => {
      setQueue((current) => {
        const next = enqueue(current, {
          ...item,
          id: crypto.randomUUID(),
          createdAtMs: performance.now(),
        });
        if (next !== current) recorder.record('queue-added', `${item.workspace}-${item.kind}`);
        return next;
      });
    },
    [recorder],
  );

  const remove = useCallback(
    (id: string, reason: 'dismissed' | 'opened') => {
      setQueue((current) => dismiss(current, id));
      recorder.record(reason === 'opened' ? 'queue-opened' : 'queue-dismissed');
    },
    [recorder],
  );

  const setContext = useCallback((workspace: WorkspaceId, contextVersion: string) => {
    setQueue((current) => invalidateContext(current, workspace, contextVersion));
  }, []);

  return { queue, add, remove, setContext };
}

export type QueueControls = ReturnType<typeof useRequestQueue>;
