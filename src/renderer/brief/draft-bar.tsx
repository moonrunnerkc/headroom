import { useEffect, useRef, useState } from 'react';
import type { BriefDraftControls, SaveState } from './use-brief-draft';

function saveLabel(save: SaveState): string {
  switch (save.kind) {
    case 'unsaved':
      return 'Not saved yet';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return `Saved locally at ${new Date(save.at).toLocaleTimeString()}`;
    case 'failed':
      return 'Save failed';
  }
}

/** Draft management. Save failures stay visible here; they are never queued as optional content. */
/** In focused layout the draft actions collapse behind one disclosure; status and errors stay visible. */
export function DraftBar({
  brief,
  compact,
}: {
  readonly brief: BriefDraftControls;
  readonly compact: boolean;
}) {
  const [selected, setSelected] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const options = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const element = options.current;
    // Never collapse around the focused control; a layout change must not hide what the user is using.
    if (element !== null && !element.contains(document.activeElement)) element.open = !compact;
  }, [compact]);
  const others = brief.drafts.filter((entry) => entry.id !== brief.draft.id);
  const currentSaved = brief.drafts.some((entry) => entry.id === brief.draft.id);

  return (
    <div className="draft-bar" aria-label="Drafts">
      <p className="save-status" role="status" data-state={brief.save.kind}>
        {saveLabel(brief.save)}
        {brief.draft.sample && <span className="tag">Sample content</span>}
      </p>
      {brief.save.kind === 'failed' && (
        <div className="alert" role="alert">
          <p>
            Your draft could not be saved: {brief.save.message} Your entries are still here; retry
            or export them.
          </p>
          <button type="button" onClick={brief.retrySave}>
            Retry save
          </button>
        </div>
      )}
      {brief.listProblem !== null && (
        <p className="alert" role="alert">
          Saved drafts could not be listed: {brief.listProblem}
        </p>
      )}
      <details className="draft-options" ref={options}>
        <summary>Draft options</summary>
        <div className="toolbar">
          <button type="button" onClick={brief.startNew}>
            New blank brief
          </button>
          <button type="button" onClick={brief.loadSample}>
            Start from sample
          </button>
          <label className="inline-label">
            Saved drafts
            <select
              value={selected}
              onChange={(event) => {
                setSelected(event.currentTarget.value);
              }}
            >
              <option value="">Choose a draft…</option>
              {others.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.status === 'ok'
                    ? `${entry.title === '' ? 'Untitled brief' : entry.title}${entry.complete ? ' (complete)' : ''}`
                    : `Unreadable draft: ${entry.problem}`}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={selected === '' || others.find((e) => e.id === selected)?.status !== 'ok'}
            onClick={() => {
              void brief.open(selected).then((message) => {
                setProblem(message);
                setSelected('');
              });
            }}
          >
            Open
          </button>
          <button
            type="button"
            disabled={selected === ''}
            onClick={() => {
              void brief.remove(selected).then((message) => {
                setProblem(message);
                setSelected('');
              });
            }}
          >
            Delete selected
          </button>
          {currentSaved &&
            (confirmDelete ? (
              <span className="confirm">
                Delete this draft file?
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setConfirmDelete(false);
                    void brief.remove(brief.draft.id).then(setProblem);
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(false);
                  }}
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(true);
                }}
              >
                Delete this draft
              </button>
            ))}
        </div>
      </details>
      {problem !== null && (
        <p className="alert" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
