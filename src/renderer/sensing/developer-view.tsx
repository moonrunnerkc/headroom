import { PULSE_POLICY } from '../../domain/pulse-policy-config';
import type { SensingSnapshot } from '../../shared/sensing-types';

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

/** Expandable diagnostics. Values here are live session state and are not saved or exported. */
export function DeveloperView({ snapshot }: { readonly snapshot: SensingSnapshot }) {
  const { rule, latest } = snapshot;
  const rows: [string, string][] = [
    ['Provenance', snapshot.provenance],
    ['SDK version', snapshot.sdkVersion],
    ['Policy', `${snapshot.policyVersion} (unvalidated interaction heuristic)`],
    ['Gate validation', snapshot.gateValidation],
    ['Lifecycle / SDK status', `${snapshot.lifecycle} / ${snapshot.processingStatus}`],
    [
      'Validation',
      snapshot.validation === null
        ? '—'
        : `${snapshot.validation.name}${snapshot.validation.hint === '' ? '' : `: ${snapshot.validation.hint}`}`,
    ],
    ['Signal quality', snapshot.quality],
    [
      'Latest reading',
      latest === null
        ? '—'
        : `${latest.bpm} BPM, confidence ${latest.confidence}, stable ${String(latest.stable)}, ${latest.ageMs} ms old`,
    ],
    [
      'Baseline / threshold',
      rule.kind === 'awaiting-baseline'
        ? 'awaiting baseline'
        : `${rule.baselineBpm} / ${rule.thresholdBpm} BPM${rule.kind === 'unavailable' ? ' (rule unavailable)' : ''}`,
    ],
    ['Calibration progress', percent(snapshot.calibrationProgress)],
    ['Persistence progress', percent(snapshot.persistenceProgress)],
    ['Armed', String(snapshot.armed)],
    [
      'Packets / median interval',
      `${snapshot.packetCount} / ${snapshot.medianIntervalMs === null ? '—' : `${snapshot.medianIntervalMs} ms`}`,
    ],
    [
      'Rejections',
      Object.entries(snapshot.rejections)
        .map(([reason, count]) => `${reason}: ${count}`)
        .join(', ') || 'none',
    ],
    ['LLM insight packets', String(snapshot.insightEventsReceived)],
    [
      'Gates',
      `stable && confidence ≥ ${PULSE_POLICY.minConfidence}; ${PULSE_POLICY.operatingRangeBpm.min}–${PULSE_POLICY.operatingRangeBpm.max} BPM; stale after ${PULSE_POLICY.staleAfterMs} ms; warm-up ${PULSE_POLICY.warmUpMs} ms`,
    ],
  ];
  return (
    <details className="developer-view">
      <summary>Developer diagnostics</summary>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="review-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
