import { describe, expect, it } from 'vitest';
import { PULSE_POLICY } from '../../src/domain/pulse-policy-config';
import {
  applyPulseCandidate,
  createSignalPolicy,
  median,
  noteValidationStatus,
  recalibrate,
  ruleForBaseline,
  tickSignalPolicy,
  type SignalPolicyEvent,
  type SignalPolicyState,
} from '../../src/domain/signal-policy';
import type { PulseCandidate } from '../../src/domain/pulse-reading';
import { syntheticPulseStream, type SyntheticSegment } from '../fixtures/synthetic-pulse';

const config = PULSE_POLICY;
const WARM = config.warmUpMs;

interface Run {
  state: SignalPolicyState;
  events: SignalPolicyEvent[];
  endMs: number;
}

function feed(
  state: SignalPolicyState,
  candidates: readonly PulseCandidate[],
  validationOk = true,
): Run {
  const events: SignalPolicyEvent[] = [];
  let current = state;
  let endMs = state.startedAtMs;
  for (const candidate of candidates) {
    const tick = tickSignalPolicy(current, candidate.receivedAtMs, config);
    events.push(...tick.events);
    const step = applyPulseCandidate(tick.state, candidate, validationOk, config);
    events.push(...step.events);
    current = step.state;
    endMs = candidate.receivedAtMs;
  }
  return { state: current, events, endMs };
}

function run(segments: readonly SyntheticSegment[], intervalMs = 500, startMs = 0): Run {
  const stream = syntheticPulseStream(startMs + WARM, intervalMs, segments);
  return feed(createSignalPolicy('s1', startMs), stream.candidates);
}

const kinds = (events: readonly SignalPolicyEvent[]) => events.map((e) => e.kind);
const triggers = (events: readonly SignalPolicyEvent[]) =>
  events.filter((e) => e.kind === 'triggered');

describe('calibration', () => {
  it('ignores readings during the SDK warm-up window', () => {
    const stream = syntheticPulseStream(0, 500, [{ durationMs: WARM - 1, bpm: 70 }]);
    const result = feed(createSignalPolicy('s1', 0), stream.candidates);
    expect(result.state.calibration).toBeNull();
    expect(result.state.quality).toBe('warming-up');
  });

  it('establishes the median baseline only after 60 consecutive usable seconds', () => {
    const almost = run([{ durationMs: 60_000, bpm: 70 }]);
    expect(almost.state.rule.kind).toBe('awaiting-baseline');
    const done = run([{ durationMs: 60_001, bpm: 70 }]);
    expect(done.state.rule).toMatchObject({ kind: 'available', baselineBpm: 70, thresholdBpm: 84 });
  });

  it('restarts calibration after any invalid interval', () => {
    const result = run([
      { durationMs: 40_000, bpm: 70 },
      { durationMs: 1_000, bpm: 70, stable: false },
      { durationMs: 40_000, bpm: 70 },
    ]);
    expect(result.state.rule.kind).toBe('awaiting-baseline');
    expect(kinds(result.events)).toContain('calibration-restarted');
  });

  it('computes the median, not the mean', () => {
    expect(median([60, 61, 200])).toBe(61);
    expect(median([60, 62, 64, 66])).toBe(63);
    expect(() => median([])).toThrow(RangeError);
  });
});

describe('threshold boundaries', () => {
  it('uses the greater of 10 BPM or 20% of baseline', () => {
    expect(ruleForBaseline(45, config)).toMatchObject({ thresholdBpm: 55 });
    expect(ruleForBaseline(50, config)).toMatchObject({ thresholdBpm: 60 });
    expect(ruleForBaseline(80, config)).toMatchObject({ thresholdBpm: 96, rearmBelowBpm: 88 });
  });

  it('marks the rule unavailable when the threshold cannot be measured in range', () => {
    expect(ruleForBaseline(91, config).kind).toBe('available');
    expect(ruleForBaseline(91.7, config).kind).toBe('unavailable');
    const result = run([
      { durationMs: 60_001, bpm: 95 },
      { durationMs: 60_000, bpm: 110 },
    ]);
    expect(result.state.rule.kind).toBe('unavailable');
    expect(triggers(result.events)).toHaveLength(0);
  });

  it('requires a reading strictly above the threshold', () => {
    const atThreshold = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 30_000, bpm: 84 },
    ]);
    expect(triggers(atThreshold.events)).toHaveLength(0);
  });
});

describe('persistence and cooldown', () => {
  it('triggers only after 20 consecutive usable seconds above threshold', () => {
    const short = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 19_500, bpm: 90 },
    ]);
    expect(triggers(short.events)).toHaveLength(0);
    const long = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 20_500, bpm: 90 },
    ]);
    expect(triggers(long.events)).toHaveLength(1);
  });

  it('does not assume a 1 Hz cadence', () => {
    for (const interval of [250, 700, 2_000]) {
      const result = run(
        [
          { durationMs: 62_000, bpm: 70 },
          { durationMs: 24_000, bpm: 90 },
        ],
        interval,
      );
      expect(triggers(result.events)).toHaveLength(1);
    }
  });

  it('resets persistence when a reading drops to the threshold', () => {
    const result = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 15_000, bpm: 90 },
      { durationMs: 500, bpm: 80 },
      { durationMs: 15_000, bpm: 90 },
    ]);
    expect(triggers(result.events)).toHaveLength(0);
  });

  it('stays disarmed while elevated and rearms only after 60 usable seconds below half the increase', () => {
    const elevated = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 400_000, bpm: 90 },
    ]);
    expect(triggers(elevated.events)).toHaveLength(1);
    const recovered = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 21_000, bpm: 90 },
      { durationMs: 59_000, bpm: 76 },
      { durationMs: 60_000, bpm: 90 },
    ]);
    expect(kinds(recovered.events)).not.toContain('rearmed');
    expect(triggers(recovered.events)).toHaveLength(1);
    const rearmed = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 21_000, bpm: 90 },
      { durationMs: 61_000, bpm: 76 },
      { durationMs: 60_000, bpm: 90 },
    ]);
    expect(kinds(rearmed.events)).toContain('rearmed');
    expect(triggers(rearmed.events)).toHaveLength(2);
  });

  it('allows at most one trigger per 120 seconds even after rearming', () => {
    const result = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 21_000, bpm: 90 },
      { durationMs: 61_000, bpm: 70 },
      { durationMs: 21_000, bpm: 90 },
    ]);
    const fired = triggers(result.events);
    expect(fired).toHaveLength(1);
    const later = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 21_000, bpm: 90 },
      { durationMs: 61_000, bpm: 70 },
      { durationMs: 60_000, bpm: 90 },
    ]);
    const twice = triggers(later.events);
    expect(twice).toHaveLength(2);
    const [first, second] = twice;
    expect((second?.atMs ?? 0) - (first?.atMs ?? 0)).toBeGreaterThanOrEqual(120_000);
  });
});

describe('dropouts and invalid data', () => {
  it('detects a silent stream from the watchdog alone', () => {
    const calibrated = run([{ durationMs: 60_001, bpm: 70 }]);
    const silentStep = tickSignalPolicy(calibrated.state, calibrated.endMs + 3_001, config);
    expect(silentStep.state.quality).toBe('stale');
    const almost = tickSignalPolicy(calibrated.state, calibrated.endMs + 3_000, config);
    expect(almost.state.quality).toBe('usable');
  });

  it('invalidates the baseline after a 30-second interruption but not a shorter one', () => {
    const calibrated = run([{ durationMs: 60_001, bpm: 70 }]);
    const stale = tickSignalPolicy(calibrated.state, calibrated.endMs + 4_000, config).state;
    const short = tickSignalPolicy(stale, calibrated.endMs + 29_999, config);
    expect(short.state.rule.kind).toBe('available');
    const long = tickSignalPolicy(stale, calibrated.endMs + 30_000, config);
    expect(long.state.rule.kind).toBe('awaiting-baseline');
    expect(kinds(long.events)).toContain('baseline-invalidated');
  });

  it('requires a new uninterrupted persistence interval after a short gap', () => {
    const before = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 15_000, bpm: 90 },
    ]);
    const gapEnd = before.endMs + 5_000;
    const resumed = syntheticPulseStream(gapEnd, 500, [{ durationMs: 10_000, bpm: 90 }]);
    const after = feed(before.state, resumed.candidates);
    expect(triggers(after.events)).toHaveLength(0);
    expect(after.state.persistenceSinceMs).toBe(gapEnd);
  });

  it('treats a non-OK validation status as an immediate invalid interval', () => {
    const before = run([
      { durationMs: 60_001, bpm: 70 },
      { durationMs: 15_000, bpm: 90 },
    ]);
    const step = noteValidationStatus(before.state, false, before.endMs + 10, config);
    expect(step.state.quality).toBe('unusable');
    expect(step.state.persistenceSinceMs).toBeNull();
    const rejected = feed(
      before.state,
      syntheticPulseStream(before.endMs + 500, 500, [{ durationMs: 30_000, bpm: 90 }]).candidates,
      false,
    );
    expect(triggers(rejected.events)).toHaveLength(0);
  });

  it('ignores duplicates without treating them as quality loss', () => {
    const calibrated = run([{ durationMs: 60_001, bpm: 70 }]);
    const last = syntheticPulseStream(calibrated.endMs, 500, [{ durationMs: 1, bpm: 70 }])
      .candidates[0];
    if (last === undefined) throw new Error('fixture produced no candidate');
    const duplicate = { ...last, receivedAtMs: last.receivedAtMs + 100 };
    const step = applyPulseCandidate(calibrated.state, duplicate, true, config);
    expect(step.assessment).toEqual({ kind: 'rejected', reason: 'duplicate' });
    expect(step.state.quality).toBe('usable');
  });

  it('survives a backwards SDK clock change without acting on readings', () => {
    const before = run([{ durationMs: 60_001, bpm: 70 }]);
    const shifted = syntheticPulseStream(before.endMs + 500, 500, [
      { durationMs: 30_000, bpm: 90 },
    ]).candidates.map((c) => ({ ...c, sdkTimestampUs: c.sdkTimestampUs - 3_600_000_000 }));
    const after = feed(before.state, shifted);
    expect(triggers(after.events)).toHaveLength(0);
    expect(after.state.quality).not.toBe('usable');
  });

  it('recalibration discards the baseline and requires a fresh 60-second window', () => {
    const calibrated = run([{ durationMs: 60_001, bpm: 70 }]);
    const step = recalibrate(calibrated.state, calibrated.endMs + 1);
    expect(step.state.rule.kind).toBe('awaiting-baseline');
    expect(kinds(step.events)).toEqual(['baseline-invalidated', 'calibration-restarted']);
  });
});
