import type { PresentationAction, PresentationState } from '../../domain/presentation-controller';

const REASON = "Your pulse reading has stayed above this session's starting range.";

/**
 * Non-modal banner for the one active sensor decision, or the visible reason
 * and undo for a sensor-caused change. It never takes focus; screen readers
 * hear it through a polite live region.
 */
export function AdaptationBanner({
  presentation,
  dispatch,
}: {
  readonly presentation: PresentationState;
  readonly dispatch: (action: PresentationAction) => void;
}) {
  const { pending, sensorChange, layoutCause } = presentation;
  let content = null;
  if (pending?.kind === 'suggestion') {
    content = (
      <>
        <p>{REASON} Show one thing at a time?</p>
        <div className="toolbar">
          <button
            type="button"
            className="primary"
            onClick={() => {
              dispatch({ type: 'accept-suggestion' });
            }}
          >
            Show one thing at a time
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'dismiss-suggestion' });
            }}
          >
            Not now
          </button>
          <button
            type="button"
            className="quiet"
            onClick={() => {
              dispatch({ type: 'set-sensor-muted', muted: true });
            }}
          >
            Mute suggestions this session
          </button>
        </div>
      </>
    );
  } else if (pending?.kind === 'awaiting-safe-boundary') {
    content = (
      <>
        <p>
          {REASON} Headroom will show one thing at a time at the next pause in typing and pointer
          activity.
        </p>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'safe-boundary' });
            }}
          >
            Apply now
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'dismiss-suggestion' });
            }}
          >
            Cancel
          </button>
        </div>
      </>
    );
  } else if (sensorChange !== null) {
    content = (
      <>
        <p>
          Showing one thing at a time{' '}
          {layoutCause === 'automatic' ? 'automatically' : 'after you accepted a suggestion'}{' '}
          because your pulse reading stayed above this session&apos;s starting range. Everything
          remains reachable.
        </p>
        <div className="toolbar">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'undo-sensor-change' });
            }}
          >
            Undo
          </button>
        </div>
      </>
    );
  }
  return (
    <div className="adaptation-banner" role="status" aria-live="polite" hidden={content === null}>
      {content}
    </div>
  );
}
