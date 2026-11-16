import type { PresentationAction, PresentationState } from '../../domain/presentation-controller';

/** Separate, session-only permission for sensor-applied layout changes, with exactly what may change. */
export function AutomaticConsent({
  presentation,
  dispatch,
}: {
  readonly presentation: PresentationState;
  readonly dispatch: (action: PresentationAction) => void;
}) {
  return (
    <fieldset className="automatic-consent">
      <legend>Sensor-driven changes</legend>
      <label className="choice">
        <input
          type="checkbox"
          checked={presentation.sensorMuted}
          onChange={(event) => {
            dispatch({ type: 'set-sensor-muted', muted: event.currentTarget.checked });
          }}
        />
        Mute sensor suggestions and changes for this session
      </label>
      <p>
        Automatic mode may do exactly one thing: switch Standard to One thing at a time, only at a
        pause in typing and pointer activity, with the reason shown and Undo available. It never
        switches back, moves focus, submits, answers, or changes saved data. Undoing it mutes
        further sensor changes for the session.
      </p>
      {presentation.automaticAvailable ? (
        <label className="choice">
          <input
            type="checkbox"
            checked={presentation.automaticConsent}
            onChange={(event) => {
              dispatch({
                type: event.currentTarget.checked ? 'grant-automatic' : 'revoke-automatic',
              });
            }}
          />
          Allow automatic layout changes for this session
        </label>
      ) : (
        <p className="muted">
          Automatic mode is unavailable in this build: the signal freshness and quality gates have
          not yet been validated on a target Mac. Suggest mode, which changes nothing until you
          accept, remains available.
        </p>
      )}
    </fieldset>
  );
}
