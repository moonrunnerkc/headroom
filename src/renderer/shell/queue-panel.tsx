import {
  QUEUE_LIMIT,
  ordered,
  type QueueItem,
  type RequestQueue,
} from '../../domain/request-queue';

interface QueuePanelProps {
  readonly queue: RequestQueue;
  readonly onOpen: (item: QueueItem) => void;
  readonly onDismiss: (id: string) => void;
}

/** Inspect, open, or dismiss postponed optional items from both workspaces. */
export function QueuePanel({ queue, onOpen, onDismiss }: QueuePanelProps) {
  const items = ordered(queue);
  return (
    <section className="panel" aria-labelledby="queue-heading">
      <h2 id="queue-heading">Queued items ({items.length})</h2>
      <p className="muted">
        Optional help and suggestions wait here instead of interrupting. At most {QUEUE_LIMIT} are
        kept; the oldest unsolicited item is dropped first. Errors and save problems are never
        queued.
      </p>
      {items.length === 0 ? (
        <p>Nothing is waiting.</p>
      ) : (
        <ul className="queue-list">
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <span className="tag">
                  {item.workspace === 'brief' ? 'Project brief' : 'Learning'}
                </span>
                <span className="tag">
                  {item.origin === 'user-requested' ? 'You asked' : 'Suggestion'}
                </span>
                <strong>{item.title}</strong>
              </p>
              <p>{item.detail}</p>
              <div className="toolbar">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(item);
                  }}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => {
                    onDismiss(item.id);
                  }}
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
