import { useState } from 'react';
import { FIELD_GROUPS, FIELD_SPECS, listItems, type FieldErrors } from '../../domain/brief';
import type { FileWriteResult } from '../../shared/headroom-api';
import { bridge } from '../bridge';
import type { BriefDraftControls } from './use-brief-draft';

function describeExport(result: FileWriteResult): string {
  switch (result.status) {
    case 'saved':
      return `Exported ${result.fileName}.`;
    case 'cancelled':
      return 'Export cancelled; nothing was written.';
    case 'error':
      return `Export failed: ${result.message}`;
  }
}

interface BriefReviewProps {
  readonly brief: BriefDraftControls;
  readonly errors: FieldErrors;
  readonly onEdit: (groupId: string) => void;
}

/** Complete summary of every field, completion, and local export. Nothing is submitted anywhere. */
export function BriefReview({ brief, errors, onEdit }: BriefReviewProps) {
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const errorCount = Object.keys(errors).length;
  const fields = brief.draft.fields;

  const runExport = async (format: 'json' | 'markdown') => {
    const result = await bridge().exportBrief({
      format,
      fields,
      complete: brief.draft.complete,
      sample: brief.draft.sample,
    });
    setExportMessage(describeExport(result));
  };

  return (
    <div className="review">
      {FIELD_GROUPS.map((group) => (
        <section key={group.id} className="review-group" aria-labelledby={`review-${group.id}`}>
          <h3 id={`review-${group.id}`}>{group.title}</h3>
          <dl>
            {group.fields.map((id) => {
              const value = fields[id].trim();
              const items = FIELD_SPECS[id].kind === 'list' ? listItems(fields[id]) : null;
              return (
                <div key={id} className="review-row">
                  <dt>{FIELD_SPECS[id].label}</dt>
                  <dd>
                    {value === '' ? (
                      <span className="muted">Not provided</span>
                    ) : items !== null ? (
                      <ul>
                        {items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="preserve-lines">{value}</span>
                    )}
                    {errors[id] !== undefined && (
                      <span className="field-error"> ⚠ {errors[id]}</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
          <button
            type="button"
            onClick={() => {
              onEdit(group.id);
            }}
          >
            Edit {group.title.toLowerCase()}
          </button>
        </section>
      ))}
      <div className="review-actions">
        {brief.draft.complete ? (
          <p className="success" role="status">
            ✓ This brief is marked complete. Editing any field returns it to draft.
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => {
              if (!brief.markComplete()) brief.revealAllErrors();
            }}
          >
            {errorCount === 0
              ? 'Mark brief complete'
              : `Mark complete (${errorCount} to fix first)`}
          </button>
        )}
        <button type="button" onClick={() => void runExport('json')}>
          Export JSON…
        </button>
        <button type="button" onClick={() => void runExport('markdown')}>
          Export Markdown…
        </button>
        <p className="muted">
          Exports are saved to a file you choose. Headroom does not send the brief anywhere.
        </p>
        {exportMessage !== null && <p role="status">{exportMessage}</p>}
      </div>
    </div>
  );
}
