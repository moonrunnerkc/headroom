import type { Layout } from '../../domain/presentation-controller';
import type { RequestQueue } from '../../domain/request-queue';
import type { ModelList } from '../../shared/ai-types';
import { InlineHelp } from '../shell/inline-help';
import { ComprehensionCheck } from './comprehension-check';
import { LESSON_SOURCES } from './http-caching-lesson';
import { SourceBlockView } from './source-block';
import { SourceImport } from './source-import';
import { CHECK_TARGET, type LearningControls } from './use-learning';

interface LearningWorkspaceProps {
  readonly learning: LearningControls;
  readonly layout: Layout;
  readonly models: ModelList | null;
  readonly model: string | null;
  readonly onModel: (model: string) => void;
  readonly onRefreshModels: () => void;
  readonly help: RequestQueue;
  readonly onDismissHelp: (id: string) => void;
}

function aiStatus(models: ModelList | null, model: string | null): string | null {
  if (models === null) return 'Checking for local models…';
  if (models.status === 'unavailable')
    return `Explanations are unavailable: ${models.reason} Reading, navigation, and notes still work.`;
  if (models.models.length === 0)
    return 'No local text model is installed in Ollama, so explanations are unavailable. Reading and notes still work.';
  if (model === null) return 'Choose a local model to enable explanations.';
  return null;
}

export function LearningWorkspace(props: LearningWorkspaceProps) {
  const { learning, layout, models, model } = props;
  const { document, position } = learning;
  const focused = layout === 'focused';
  const isLesson = document.origin === 'lesson';
  const targets = [
    ...document.blocks.map((block) => block.id),
    ...(isLesson ? [CHECK_TARGET] : []),
  ];
  const index = Math.max(0, targets.indexOf(position));
  const previous = targets[index - 1];
  const next = targets[index + 1];
  const status = aiStatus(models, model);
  const hasNotes =
    Object.values(learning.annotations).some((note) => note.trim() !== '') ||
    Object.keys(learning.answers).length > 0;
  const label = (target: string) =>
    target === CHECK_TARGET ? 'Comprehension check' : `Section ${String(Number(target.slice(1)))}`;

  return (
    <div className="workspace learning-workspace">
      <header className="workspace-header">
        <h1>Learning: {document.title}</h1>
        <p className="muted">
          {isLesson
            ? 'Bundled original lesson.'
            : document.origin === 'file'
              ? 'Opened from a local file.'
              : 'Pasted text.'}{' '}
          {document.text.length.toLocaleString('en-US')} characters in {document.blocks.length}{' '}
          sections, shown exactly as written.
        </p>
      </header>
      <SourceImport learning={learning} hasNotes={hasNotes} />
      <div className="ai-controls">
        {models?.status === 'ok' && models.models.length > 0 && (
          <label className="inline-label">
            Local model
            <select
              value={model ?? ''}
              onChange={(event) => {
                props.onModel(event.currentTarget.value);
              }}
            >
              <option value="">Choose…</option>
              {models.models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.parameterSize})
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="quiet" onClick={props.onRefreshModels}>
          Refresh models
        </button>
        {status !== null && (
          <p className="muted" role="status">
            {status}
          </p>
        )}
      </div>
      <nav className="reading-position" aria-label="Reading position">
        <p aria-live="polite">
          {position === CHECK_TARGET
            ? `Comprehension check, after section ${String(document.blocks.length)}`
            : `${label(targets[index] ?? CHECK_TARGET)} of ${String(document.blocks.length)}`}
        </p>
        <label className="inline-label">
          Go to
          <select
            value={targets[index] ?? ''}
            onChange={(event) => {
              learning.setPosition(event.currentTarget.value);
            }}
          >
            {targets.map((target) => (
              <option key={target} value={target}>
                {label(target)}
              </option>
            ))}
          </select>
        </label>
      </nav>
      <InlineHelp items={props.help} onDismiss={props.onDismissHelp} />
      <div className="blocks">
        {document.blocks.map((block) => (
          <SourceBlockView
            key={`${document.id}-${block.id}`}
            block={block}
            total={document.blocks.length}
            current={block.id === position}
            hidden={focused && block.id !== position}
            annotation={learning.annotations[block.id] ?? ''}
            explanation={learning.explanations[block.id]}
            generating={learning.pending?.blockId === block.id}
            aiError={learning.aiError?.blockId === block.id ? learning.aiError.message : null}
            canExplain={status === null && model !== null}
            busy={learning.pending !== null}
            onSelect={() => {
              learning.setPosition(block.id);
            }}
            onAnnotate={(text) => {
              learning.annotate(block.id, text);
            }}
            onExplain={(question) => {
              if (model !== null) void learning.explain(block.id, question, model);
            }}
            onCancel={learning.cancel}
            onOpenBlock={learning.setPosition}
          />
        ))}
      </div>
      {isLesson && (
        <ComprehensionCheck
          hidden={focused && position !== CHECK_TARGET}
          answers={learning.answers}
          checked={learning.checked}
          onAnswer={learning.answer}
          onSubmit={learning.submitCheck}
        />
      )}
      {focused && (
        <nav className="step-actions" aria-label="Section navigation">
          {previous !== undefined && (
            <button
              type="button"
              onClick={() => {
                learning.setPosition(previous);
              }}
            >
              Previous: {label(previous)}
            </button>
          )}
          {next !== undefined && (
            <button
              type="button"
              className="primary"
              onClick={() => {
                learning.setPosition(next);
              }}
            >
              Next: {label(next)}
            </button>
          )}
        </nav>
      )}
      {isLesson && (
        <footer className="sources">
          <h2>Lesson references</h2>
          <ul>
            {LESSON_SOURCES.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </div>
  );
}
