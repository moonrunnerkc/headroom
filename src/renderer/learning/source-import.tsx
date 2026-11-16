import { useState } from 'react';
import { SOURCE_CHARACTER_LIMIT, checkSourceText } from '../../domain/source-blocks';
import { bridge } from '../bridge';
import type { LearningControls } from './use-learning';

const PROBLEMS = {
  empty: 'Paste some text first.',
  'too-long': `Text is limited to ${SOURCE_CHARACTER_LIMIT.toLocaleString('en-US')} characters in this release. Nothing was truncated.`,
  'contains-nul': 'The text contains binary data.',
} as const;

/** Replace the current source with pasted text, a local file, or the bundled lesson. */
export function SourceImport({
  learning,
  hasNotes,
}: {
  readonly learning: LearningControls;
  readonly hasNotes: boolean;
}) {
  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<(() => void) | null>(null);

  const guard = (action: () => void) => {
    if (hasNotes) setConfirming(() => action);
    else action();
  };

  return (
    <details className="source-import">
      <summary>Change source material</summary>
      <p className="muted">
        Pasted text and opened files stay in memory for this session only. Notes and answers are
        cleared when the source changes.
      </p>
      <label className="field">
        Paste text ({pasted.length.toLocaleString('en-US')} /{' '}
        {SOURCE_CHARACTER_LIMIT.toLocaleString('en-US')} characters)
        <textarea
          rows={5}
          value={pasted}
          onChange={(event) => {
            setPasted(event.currentTarget.value);
          }}
        />
      </label>
      <div className="toolbar">
        <button
          type="button"
          onClick={() => {
            const problem = checkSourceText(pasted);
            if (problem !== null) {
              setMessage(PROBLEMS[problem]);
              return;
            }
            guard(() => {
              learning.loadText('Pasted text', 'pasted', pasted);
              setPasted('');
              setMessage('Loaded pasted text.');
            });
          }}
        >
          Use pasted text
        </button>
        <button
          type="button"
          onClick={() => {
            void bridge()
              .openTextFile()
              .then((result) => {
                if (result.status === 'opened') {
                  guard(() => {
                    learning.loadText(result.fileName, 'file', result.text);
                    setMessage(`Opened ${result.fileName}.`);
                  });
                } else if (result.status === 'error') setMessage(result.message);
              });
          }}
        >
          Open .txt or .md file…
        </button>
        <button
          type="button"
          onClick={() => {
            guard(() => {
              learning.loadLesson();
              setMessage('Loaded the HTTP caching lesson.');
            });
          }}
        >
          Use the HTTP caching lesson
        </button>
      </div>
      {confirming !== null && (
        <div className="alert" role="alert">
          <p>Replacing the source clears your notes and answers for the current material.</p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              confirming();
              setConfirming(null);
            }}
          >
            Replace and clear notes
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirming(null);
            }}
          >
            Keep current material
          </button>
        </div>
      )}
      {message !== null && <p role="status">{message}</p>}
    </details>
  );
}
