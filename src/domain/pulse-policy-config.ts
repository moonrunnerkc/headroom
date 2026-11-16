/**
 * Engineering defaults for the pulse suggestion rule. These are unvalidated
 * interaction heuristics, not clinical thresholds, and they do not estimate
 * stress, workload, or any other internal state.
 */
export const PULSE_POLICY = {
  version: 'pulse-policy-1',
  /** SDK pulse output is a 12-second average; confidence is meaningless until that window fills. */
  warmUpMs: 12_000,
  calibrationMs: 60_000,
  minIncreaseBpm: 10,
  minIncreaseFraction: 0.2,
  persistenceMs: 20_000,
  suggestionIntervalMs: 120_000,
  rearmMs: 60_000,
  baselineInvalidationGapMs: 30_000,
  /**
   * Maximum monotonic gap between usable readings before the stream is stale.
   * Provisional until observed cadence on the target Mac is recorded in
   * docs/verification.md; automatic changes stay disabled until then.
   */
  staleAfterMs: 3_000,
  /** SDK 3.5.0 documents `stable` as confidence >= 40 (about +/-3 BPM). Both are required. */
  minConfidence: 40,
  /** Presage documents pulse validity for 40-110 BPM. Readings outside are unavailable, not extreme. */
  operatingRangeBpm: { min: 40, max: 110 },
  /** SDK timestamps may not advance faster than the app clock by more than this tolerance. */
  sdkClockToleranceMs: 2_000,
  /** Bound on calibration samples; 60 s at 30 Hz is 1,800, so overflow restarts calibration. */
  maxCalibrationSamples: 4_096,
  /** Device-validation status of freshness/quality gates. Automatic mode requires 'device-validated'. */
  gateValidation: 'pending-device-validation' as GateValidation,
} as const;

export type GateValidation = 'pending-device-validation' | 'device-validated';

export type PulsePolicyConfig = Omit<typeof PULSE_POLICY, 'gateValidation'> & {
  readonly gateValidation: GateValidation;
};

export function qualifyingIncrease(baselineBpm: number, config: PulsePolicyConfig): number {
  return Math.max(config.minIncreaseBpm, baselineBpm * config.minIncreaseFraction);
}
