import type { RequestQueue } from '../../domain/request-queue';

/** Contextual help shown beside the active task; it never takes focus or blocks input. */
export function InlineHelp({
  items,
  onDismiss,
}: {
  readonly items: RequestQueue;
  readonly onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <aside className="inline-help" aria-label="Help for this step">
      {items.map((item) => (
        <div key={item.id} className="help-item">
          <p>
            <strong>{item.title}</strong> {item.detail}
          </p>
          <button
            type="button"
            className="quiet"
            aria-label={`Dismiss: ${item.title}`}
            onClick={() => {
              onDismiss(item.id);
            }}
          >
            Dismiss
          </button>
        </div>
      ))}
    </aside>
  );
}
