import type { PulsePolicyConfig } from './pulse-policy-config';

/** A pulse value extracted from one SDK metrics packet, before any quality decision. */
export interface PulseCandidate {
  readonly bpm: number;
  readonly confidence: number;
  readonly stable: boolean;
  /** SDK measurement timestamp in microseconds; used only for ordering and duplicate detection. */
  readonly sdkTimestampUs: number;
  /** Monotonic application time (ms) when the packet reached the main process. */
  readonly receivedAtMs: number;
}

interface UsablePulseReading extends PulseCandidate {
  readonly unit: 'bpm';
  readonly provenance: 'presage-smartspectra-live';
}

export type RejectionReason =
  | 'nonfinite'
  | 'confidence-off-scale'
  | 'duplicate'
  | 'out-of-order'
  | 'timestamp-jump'
  | 'out-of-operating-range'
  | 'low-confidence'
  | 'not-stable'
  | 'validation-not-ok';

export type ReadingAssessment =
  | { readonly kind: 'usable'; readonly reading: UsablePulseReading }
  | { readonly kind: 'rejected'; readonly reason: RejectionReason };

export interface OrderingAnchor {
  readonly sdkTimestampUs: number;
  readonly receivedAtMs: number;
}

/**
 * Decide whether a candidate may influence policy. Every gate must pass:
 * finite values, strictly advancing SDK time that does not outrun the app
 * clock, SDK validation status OK, operating range, `stable`, and confidence.
 */
export function assessPulseCandidate(
  candidate: PulseCandidate,
  previous: OrderingAnchor | null,
  validationOk: boolean,
  config: PulsePolicyConfig,
): ReadingAssessment {
  const { bpm, confidence, sdkTimestampUs, receivedAtMs } = candidate;
  if (![bpm, confidence, sdkTimestampUs, receivedAtMs].every(Number.isFinite)) {
    return { kind: 'rejected', reason: 'nonfinite' };
  }
  // SDK 3.5.0 documents confidence as a percentage in [0, 100].
  if (confidence < 0 || confidence > 100)
    return { kind: 'rejected', reason: 'confidence-off-scale' };
  if (previous !== null) {
    if (sdkTimestampUs === previous.sdkTimestampUs)
      return { kind: 'rejected', reason: 'duplicate' };
    if (sdkTimestampUs < previous.sdkTimestampUs || receivedAtMs < previous.receivedAtMs) {
      return { kind: 'rejected', reason: 'out-of-order' };
    }
    const sdkAdvanceMs = (sdkTimestampUs - previous.sdkTimestampUs) / 1000;
    const appAdvanceMs = receivedAtMs - previous.receivedAtMs;
    if (sdkAdvanceMs > appAdvanceMs + config.sdkClockToleranceMs) {
      return { kind: 'rejected', reason: 'timestamp-jump' };
    }
  }
  if (!validationOk) return { kind: 'rejected', reason: 'validation-not-ok' };
  const range = config.operatingRangeBpm;
  if (bpm < range.min || bpm > range.max) {
    return { kind: 'rejected', reason: 'out-of-operating-range' };
  }
  if (!candidate.stable) return { kind: 'rejected', reason: 'not-stable' };
  if (confidence < config.minConfidence) {
    return { kind: 'rejected', reason: 'low-confidence' };
  }
  return {
    kind: 'usable',
    reading: { ...candidate, unit: 'bpm', provenance: 'presage-smartspectra-live' },
  };
}

/** Rejections that advance the ordering anchor (the packet was new, just unusable). */
export function rejectionAdvancesAnchor(reason: RejectionReason): boolean {
  return !['duplicate', 'out-of-order', 'nonfinite', 'confidence-off-scale'].includes(reason);
}
