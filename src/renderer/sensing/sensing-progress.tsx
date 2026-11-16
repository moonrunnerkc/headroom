import { PULSE_POLICY } from '../../domain/pulse-policy-config';
import type { SensingSnapshot } from '../../shared/sensing-types';

function qualityText(snapshot: SensingSnapshot): string {
  switch (snapshot.quality) {
    case 'warming-up':
      return `Warming up: the SDK needs about ${PULSE_POLICY.warmUpMs / 1000} seconds before its pulse average is meaningful.`;
    case 'awaiting-data':
      return 'Waiting for a usable pulse reading.';
    case 'usable':
      return 'Receiving usable readings.';
    case 'unusable':
      return 'The current reading is not usable, so sensing makes no decisions right now.';
    case 'stale':
      return 'No recent reading has arrived, so sensing makes no decisions right now.';
  }
}

function ruleText(snapshot: SensingSnapshot): string {
  const rule = snapshot.rule;
  switch (rule.kind) {
    case 'awaiting-baseline':
      return `Calibrating a starting range from ${PULSE_POLICY.calibrationMs / 1000} uninterrupted seconds of usable readings. Any interruption restarts calibration.`;
    case 'available':
      return 'Starting range set for this session. A suggestion is possible only if the reading stays clearly above it for 20 seconds.';
    case 'unavailable':
      return `This session's starting range is too high for the SDK's validated measurement range (${PULSE_POLICY.operatingRangeBpm.min}–${PULSE_POLICY.operatingRangeBpm.max} BPM), so sensor suggestions are unavailable. Manual layout choices still work.`;
  }
}

/** Setup feedback during warm-up and calibration, with the SDK's own framing hint. */
export function SensingProgress({ snapshot }: { readonly snapshot: SensingSnapshot }) {
  const hint = snapshot.validation;
  return (
    <div className="sensing-progress" aria-live="polite">
      <p>{qualityText(snapshot)}</p>
      {hint !== null && hint.name !== 'Ok' && (
        <p className="alert">Camera feedback: {hint.hint === '' ? hint.name : hint.hint}</p>
      )}
      <p>{ruleText(snapshot)}</p>
      {snapshot.calibrationProgress !== null && (
        <label className="field">
          Calibration
          <progress max={1} value={snapshot.calibrationProgress}>
            {Math.round(snapshot.calibrationProgress * 100)}%
          </progress>
        </label>
      )}
    </div>
  );
}
