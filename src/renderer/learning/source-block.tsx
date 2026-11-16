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
  readonly onFocusBlock: () => void;
  readonly onAnnotate: (text: string) => void;
  readonly onExplain: (question: string) => void;
  readonly onCancel: () => void;
  readonly onOpenBlock: (blockId: string) => void;
}

const sectionLabel = (id: string) => `Section ${String(Number(id.slice(1)))}`;

/** One source block, rendered as inert text, with its annotation and any AI explanation beside it. */
export function SourceBlockView(props: SourceBlockViewProps) {
  const { block, explanation } = props;
  const [question, setQuestion] = useState('');
  const headingId = `block-${block.id}-heading`;
  return (
    <article
      className="source-block"
      data-current={props.current}
      hidden={props.hidden}
      aria-labelledby={headingId}
      onFocus={props.onFocusBlock}
    >
      <h2 id={headingId} className="block-heading">
        {sectionLabel(block.id)} of {props.total}
      </h2>
      <div className="source-text">{block.text}</div>
      <div className="block-tools">
        <label className="field">
          Your note on this section
          <textarea
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
