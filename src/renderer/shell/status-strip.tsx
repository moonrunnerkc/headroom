import type { Layout, PolicyMode, PresentationState } from '../../domain/presentation-controller';
import type { WorkspaceId } from '../../domain/request-queue';
import type { SensingSnapshot } from '../../shared/sensing-types';
import { captureActive, sensingSummary } from '../sensing/use-sensing';

export type Panel = 'sensing' | 'queue' | 'evidence' | null;

interface StatusStripProps {
  readonly workspace: WorkspaceId;
  readonly onWorkspace: (workspace: WorkspaceId) => void;
  readonly presentation: PresentationState;
  readonly onLayout: (layout: Layout) => void;
  readonly onMode: (mode: PolicyMode) => void;
  readonly sensing: SensingSnapshot | null;
  readonly onStopSensing: () => void;
  readonly queueCount: number;
  readonly panel: Panel;
  readonly onPanel: (panel: Panel) => void;
}

const MODES: readonly PolicyMode[] = ['manual', 'suggest', 'automatic'];
const LAYOUT_LABELS: Record<Layout, string> = {
  standard: 'Standard',
  focused: 'One thing at a time',
};

/** Small persistent strip: workspace, layout, policy, sensing state with stop, and queue count. */
export function StatusStrip(props: StatusStripProps) {
  const { presentation, sensing } = props;
  const active = captureActive(sensing);
  const togglePanel = (panel: Exclude<Panel, null>) => {
    props.onPanel(props.panel === panel ? null : panel);
  };
  return (
    <header className="status-strip">
      <div className="strip-group">
        <span className="app-name">Headroom</span>
        <div role="group" aria-label="Workspace" className="segmented">
          {(['brief', 'learning'] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={props.workspace === id}
              onClick={() => {
                props.onWorkspace(id);
              }}
            >
              {id === 'brief' ? 'Project brief' : 'Learning'}
            </button>
          ))}
        </div>
      </div>
      <div className="strip-group">
        <div role="group" aria-label="Layout" className="segmented">
          {(['standard', 'focused'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              aria-pressed={presentation.layout === layout}
              onClick={() => {
                props.onLayout(layout);
              }}
            >
              {LAYOUT_LABELS[layout]}
            </button>
          ))}
        </div>
        <label className="inline-label">
          Adaptation
          <select
            value={presentation.mode}
            onChange={(event) => {
              const value = event.currentTarget.value;
              const mode = MODES.find((candidate) => candidate === value);
              if (mode !== undefined) props.onMode(mode);
            }}
          >
            <option value="manual">Manual</option>
            <option value="suggest">Suggest</option>
            <option
              value="automatic"
              disabled={!(presentation.automaticConsent && presentation.automaticAvailable)}
            >
              Automatic{presentation.automaticAvailable ? '' : ' (unavailable)'}
            </option>
          </select>
        </label>
      </div>
      <div className="strip-group">
        <button
          type="button"
          className="sensing-chip"
          data-active={active}
          aria-expanded={props.panel === 'sensing'}
          onClick={() => {
            togglePanel('sensing');
          }}
        >
          <span aria-hidden="true">{active ? '◉' : '○'}</span> {sensingSummary(sensing)}
        </button>
        {active && (
          <button type="button" className="stop" onClick={props.onStopSensing}>
            Stop sensing
          </button>
        )}
        <button
          type="button"
          aria-expanded={props.panel === 'queue'}
          onClick={() => {
            togglePanel('queue');
          }}
        >
          Queue ({props.queueCount})
        </button>
        <button
          type="button"
          aria-expanded={props.panel === 'evidence'}
          onClick={() => {
            togglePanel('evidence');
          }}
        >
          Evidence
        </button>
      </div>
    </header>
  );
}
