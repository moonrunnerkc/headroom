import {
  FIELD_GROUPS,
  FIELD_SPECS,
  REVIEW_STEP,
  completedFieldCount,
  groupErrors,
  groupForField,
  type BriefFieldId,
  type FieldErrors,
} from '../../domain/brief';
import type { Layout } from '../../domain/presentation-controller';
import type { RequestQueue } from '../../domain/request-queue';
import { InlineHelp } from '../shell/inline-help';
import { BriefField, fieldDomId } from './brief-field';
import { BriefReview } from './brief-review';
import { DraftBar } from './draft-bar';
import type { BriefDraftControls } from './use-brief-draft';

const ALL_FIELDS: readonly BriefFieldId[] = FIELD_GROUPS.flatMap((group) => group.fields);

export const BRIEF_STEPS = [...FIELD_GROUPS.map((group) => group.id), REVIEW_STEP];

interface BriefWorkspaceProps {
  readonly brief: BriefDraftControls;
  readonly layout: Layout;
  readonly step: string;
  readonly onStep: (step: string) => void;
  readonly help: RequestQueue;
  readonly onDismissHelp: (id: string) => void;
}

function stepTitle(step: string): string {
  return FIELD_GROUPS.find((group) => group.id === step)?.title ?? 'Review and export';
}

export function BriefWorkspace({
  brief,
  layout,
  step,
  onStep,
  help,
  onDismissHelp,
}: BriefWorkspaceProps) {
  const focused = layout === 'focused';
  const { errors, touched, showAllErrors } = brief;
  // Errors appear once a field has been visited, or for every field after a completion attempt.
  const visible: FieldErrors = {};
  for (const id of ALL_FIELDS) {
    const message = errors[id];
    if (message !== undefined && (showAllErrors || touched.has(id))) visible[id] = message;
  }
  const visibleIds = ALL_FIELDS.filter((id) => visible[id] !== undefined);
  const index = BRIEF_STEPS.indexOf(step);
  const previous = BRIEF_STEPS[index - 1];
  const next = BRIEF_STEPS[index + 1];
  const total = Object.keys(FIELD_SPECS).length;
  const done = completedFieldCount(brief.draft.fields, errors);
  const title = brief.draft.fields.title.trim();

  const goToField = (id: BriefFieldId) => {
    onStep(groupForField(id).id);
    // Wait for the step to render before moving focus to the field the user chose.
    requestAnimationFrame(() => document.getElementById(fieldDomId(id))?.focus());
  };

  return (
    <div className="workspace brief-workspace">
      <header className="workspace-header">
        <h1>Project brief{title === '' ? '' : `: ${title}`}</h1>
        <p className="muted">
          Local document preparation. Headroom never submits this brief to anyone.
        </p>
      </header>
      <DraftBar brief={brief} />
      <nav className="steps" aria-label="Brief steps">
        <p className="progress" aria-live="polite">
          {done} of {total} fields complete{brief.draft.complete ? ' · marked complete' : ''}
        </p>
        <ol>
          {BRIEF_STEPS.map((id, position) => {
            const group = FIELD_GROUPS.find((candidate) => candidate.id === id);
            const problems = group === undefined ? 0 : groupErrors(group, visible).length;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={id === step ? 'step' : undefined}
                  onClick={() => {
                    onStep(id);
                  }}
                >
                  {position + 1}. {stepTitle(id)}
                  {problems > 0 && <span className="badge"> {problems} to fix</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      {visibleIds.length > 0 && (
        <div className="error-summary" role="alert" aria-labelledby="brief-error-summary">
          <h2 id="brief-error-summary">
            {visibleIds.length} {visibleIds.length === 1 ? 'field needs' : 'fields need'} attention
          </h2>
          <ul>
            {visibleIds.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    goToField(id);
                  }}
                >
                  {FIELD_SPECS[id].label} ({groupForField(id).title}): {visible[id]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <InlineHelp items={help} onDismiss={onDismissHelp} />
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        {FIELD_GROUPS.map((group, position) => (
          <fieldset
            key={group.id}
            hidden={focused && step !== group.id}
            onFocus={() => {
              if (step !== group.id) onStep(group.id);
            }}
          >
            <legend>
              {focused && (
                <span className="step-count">
                  Step {position + 1} of {BRIEF_STEPS.length}:{' '}
                </span>
              )}
              {group.title}
            </legend>
            <p className="instructions">{group.instructions}</p>
            {group.fields.map((id) => (
              <BriefField
                key={id}
                id={id}
                value={brief.draft.fields[id]}
                error={visible[id]}
                onChange={brief.update}
                onBlur={brief.touch}
              />
            ))}
          </fieldset>
        ))}
        <section
          className="review-step"
          hidden={focused && step !== REVIEW_STEP}
          aria-labelledby="brief-review-title"
        >
          <h2 id="brief-review-title">
            {focused && (
              <span className="step-count">
                Step {BRIEF_STEPS.length} of {BRIEF_STEPS.length}:{' '}
              </span>
            )}
            Review and export
          </h2>
          <BriefReview brief={brief} errors={errors} onEdit={onStep} />
        </section>
      </form>
      {focused && (
        <nav className="step-actions" aria-label="Step navigation">
          {previous !== undefined && (
            <button
              type="button"
              onClick={() => {
                onStep(previous);
              }}
            >
              Previous: {stepTitle(previous)}
            </button>
          )}
          {next !== undefined && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                onStep(next);
              }}
            >
              Next: {stepTitle(next)}
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
