import { useState } from 'react';
import type { SourceBlock } from '../../domain/source-blocks';
import { QUESTION_MAX_CHARACTERS } from '../../shared/ai-types';
import type { Explanation } from './use-learning';

interface SourceBlockViewProps {
  readonly block: SourceBlock;
  readonly total: number;
  readonly current: boolean;
  readonly hidden: boolean;
  readonly annotation: string;
  readonly explanation: Explanation | undefined;
  readonly generating: boolean;
  readonly aiError: string | null;
  readonly canExplain: boolean;
  readonly busy: boolean;
  readonly onSelect: () => void;
  readonly onAnnotate: (text: string) => void;
  readonly onExplain: (question: string) => void;
  readonly onCancel: () => void;
  readonly onOpenBlock: (blockId: string) => void;
}

const sectionLabel = (id: string) => `Section ${String(Number(id.slice(1)))}`;

/**
 * One source block, rendered as inert text. Note and explanation tools stay mounted for every
 * block (so typing state survives navigation and layout changes) but are shown only for the
 * current block; existing notes and explanations remain visible everywhere.
 */
export function SourceBlockView(props: SourceBlockViewProps) {
  const { block, explanation } = props;
  const [question, setQuestion] = useState('');
  const headingId = `block-${block.id}-heading`;
  const noteId = `block-${block.id}-note`;
  return (
    <article
      className="source-block"
      data-current={props.current}
      hidden={props.hidden}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} className="block-heading">
        {sectionLabel(block.id)} of {props.total}
      </h2>
      <div className="source-text">{block.text}</div>
      {!props.current && (
        <>
          {props.annotation.trim() !== '' && (
            <p className="note-preview preserve-lines">
              <span className="muted">Your note: </span>
              {props.annotation}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              props.onSelect();
              // The note field replaces this button, so move focus to it explicitly.
              requestAnimationFrame(() => document.getElementById(noteId)?.focus());
            }}
          >
            Work with {sectionLabel(block.id).toLowerCase()}
          </button>
        </>
      )}
      <div className="block-tools" hidden={!props.current}>
        <label className="field">
          Your note on this section
          <textarea
            id={noteId}
            rows={2}
            value={props.annotation}
            onChange={(event) => {
              props.onAnnotate(event.currentTarget.value);
            }}
          />
        </label>
        <label className="field">
          Question for the explanation (optional)
          <input
            type="text"
            value={question}
            maxLength={QUESTION_MAX_CHARACTERS}
            onChange={(event) => {
              setQuestion(event.currentTarget.value);
            }}
          />
        </label>
        <div className="toolbar">
          {props.generating ? (
            <>
              <span role="status">Generating a local explanation…</span>
              <button type="button" onClick={props.onCancel}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!props.canExplain || props.busy}
              onClick={() => {
                props.onExplain(question);
              }}
            >
              {explanation === undefined ? 'Explain this section' : 'Explain again'}
            </button>
          )}
        </div>
        {props.aiError !== null && (
          <p className="alert" role="alert">
            {props.aiError} The source text is unchanged.
          </p>
        )}
      </div>
      {explanation !== undefined && (
        <aside className="explanation" aria-label={`AI explanation for ${sectionLabel(block.id)}`}>
          <p className="ai-label">
            AI-generated supplementary explanation · local model {explanation.model}
            {explanation.fromSessionCache ? ' · reused from this session' : ''}
          </p>
          <p className="preserve-lines">{explanation.explanation}</p>
          <p className="muted">
            Based on:{' '}
            {explanation.supportingBlockIds.map((id, index) => (
              <span key={id}>
                {index > 0 && ', '}
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    props.onOpenBlock(id);
                  }}
                >
                  {sectionLabel(id)}
                </button>
              </span>
            ))}
            . The structure was checked; the content may still be wrong. The source text is
            authoritative.
          </p>
        </aside>
      )}
    </article>
  );
}
