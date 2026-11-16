import type { PulsePolicyConfig } from './pulse-policy-config';
import { median, ruleForBaseline, type RuleStatus } from './pulse-rule';
import {
  assessPulseCandidate,
  rejectionAdvancesAnchor,
  type OrderingAnchor,
  type PulseCandidate,
  type ReadingAssessment,
} from './pulse-reading';

type SignalQuality = 'warming-up' | 'awaiting-data' | 'usable' | 'unusable' | 'stale';

export interface SignalPolicyState {
  readonly sessionId: string;
  readonly startedAtMs: number;
  readonly quality: SignalQuality;
  readonly anchor: OrderingAnchor | null;
  readonly lastUsableAtMs: number | null;
  readonly interruptedSinceMs: number | null;
  readonly calibration: {
    readonly startedAtMs: number;
    readonly samples: readonly number[];
  } | null;
  readonly rule: RuleStatus;
  readonly persistenceSinceMs: number | null;
  readonly armed: boolean;
  readonly rearmSinceMs: number | null;
  readonly lastTriggerAtMs: number | null;
  readonly triggerCount: number;
}

export type SignalPolicyEvent =
  | { readonly kind: 'quality-changed'; readonly quality: SignalQuality; readonly atMs: number }
  | { readonly kind: 'calibration-restarted'; readonly atMs: number }
  | { readonly kind: 'baseline-established'; readonly rule: RuleStatus; readonly atMs: number }
  | {
      readonly kind: 'baseline-invalidated';
      readonly reason: 'interruption' | 'recalibration';
      readonly atMs: number;
    }
  | { readonly kind: 'triggered'; readonly triggerId: string; readonly atMs: number }
  | { readonly kind: 'rearmed'; readonly atMs: number };

export interface PolicyStep {
  readonly state: SignalPolicyState;
  readonly events: readonly SignalPolicyEvent[];
}

export function createSignalPolicy(sessionId: string, nowMs: number): SignalPolicyState {
  return {
    sessionId,
    startedAtMs: nowMs,
    quality: 'warming-up',
    anchor: null,
    lastUsableAtMs: null,
    interruptedSinceMs: null,
    calibration: null,
    rule: { kind: 'awaiting-baseline' },
    persistenceSinceMs: null,
    armed: true,
    rearmSinceMs: null,
    lastTriggerAtMs: null,
    triggerCount: 0,
  };
}

function inWarmUp(state: SignalPolicyState, nowMs: number, config: PulsePolicyConfig): boolean {
  return nowMs - state.startedAtMs < config.warmUpMs;
}

function withQuality(
  state: SignalPolicyState,
  quality: SignalQuality,
  atMs: number,
  events: SignalPolicyEvent[],
): SignalPolicyState {
  if (state.quality === quality) return state;
  events.push({ kind: 'quality-changed', quality, atMs });
  return { ...state, quality };
}

/** An invalid or stale interval clears persistence, rearm progress, and any calibration in progress. */
function interrupt(
  state: SignalPolicyState,
  quality: 'unusable' | 'stale',
  atMs: number,
  events: SignalPolicyEvent[],
): SignalPolicyState {
  const next = withQuality(state, quality, atMs, events);
  if (next.calibration !== null) events.push({ kind: 'calibration-restarted', atMs });
  return {
    ...next,
    interruptedSinceMs: next.interruptedSinceMs ?? next.lastUsableAtMs ?? atMs,
    calibration: null,
    persistenceSinceMs: null,
    rearmSinceMs: null,
  };
}

function invalidateLongInterruption(
  state: SignalPolicyState,
  nowMs: number,
  config: PulsePolicyConfig,
  events: SignalPolicyEvent[],
): SignalPolicyState {
  if (state.interruptedSinceMs === null || state.rule.kind === 'awaiting-baseline') return state;
  if (nowMs - state.interruptedSinceMs < config.baselineInvalidationGapMs) return state;
  events.push({ kind: 'baseline-invalidated', reason: 'interruption', atMs: nowMs });
  return { ...state, rule: { kind: 'awaiting-baseline' }, armed: true };
}

/** Independent watchdog step; must run on a timer so silence is detected without new packets. */
export function tickSignalPolicy(
  state: SignalPolicyState,
  nowMs: number,
  config: PulsePolicyConfig,
): PolicyStep {
  const events: SignalPolicyEvent[] = [];
  let next = state;
  if (inWarmUp(next, nowMs, config)) return { state: next, events };
  if (next.quality === 'warming-up') next = withQuality(next, 'awaiting-data', nowMs, events);
  const silentSince = next.lastUsableAtMs ?? next.startedAtMs + config.warmUpMs;
  const silentForMs = nowMs - silentSince;
  if (
    (next.quality === 'usable' || next.quality === 'awaiting-data') &&
    silentForMs > config.staleAfterMs
  ) {
    next = interrupt(next, 'stale', nowMs, events);
  }
  next = invalidateLongInterruption(next, nowMs, config, events);
  return { state: next, events };
}

/**
 * Record an invalid interval immediately (non-OK SDK validation status or a
 * malformed packet) rather than waiting for the next reading to arrive.
 */
export function markInvalidInterval(
  state: SignalPolicyState,
  nowMs: number,
  config: PulsePolicyConfig,
): PolicyStep {
  const events: SignalPolicyEvent[] = [];
  if (inWarmUp(state, nowMs, config)) return { state, events };
  return { state: interrupt(state, 'unusable', nowMs, events), events };
}

export function recalibrate(state: SignalPolicyState, nowMs: number): PolicyStep {
  const events: SignalPolicyEvent[] = [];
  if (state.rule.kind !== 'awaiting-baseline') {
    events.push({ kind: 'baseline-invalidated', reason: 'recalibration', atMs: nowMs });
  }
  events.push({ kind: 'calibration-restarted', atMs: nowMs });
  return {
    state: {
      ...state,
      rule: { kind: 'awaiting-baseline' },
      calibration: null,
      persistenceSinceMs: null,
      rearmSinceMs: null,
      armed: true,
    },
    events,
  };
}

function calibrate(
  state: SignalPolicyState,
  bpm: number,
  atMs: number,
  config: PulsePolicyConfig,
  events: SignalPolicyEvent[],
): SignalPolicyState {
  const current = state.calibration;
  if (current === null) return { ...state, calibration: { startedAtMs: atMs, samples: [bpm] } };
  if (current.samples.length >= config.maxCalibrationSamples) {
    events.push({ kind: 'calibration-restarted', atMs });
    return { ...state, calibration: { startedAtMs: atMs, samples: [bpm] } };
  }
  const samples = [...current.samples, bpm];
  if (atMs - current.startedAtMs < config.calibrationMs) {
    return { ...state, calibration: { startedAtMs: current.startedAtMs, samples } };
  }
  const rule = ruleForBaseline(median(samples), config);
  events.push({ kind: 'baseline-established', rule, atMs });
  return {
    ...state,
    calibration: null,
    rule,
    armed: true,
    persistenceSinceMs: null,
    rearmSinceMs: null,
  };
}

function monitor(
  state: SignalPolicyState,
  bpm: number,
  atMs: number,
  config: PulsePolicyConfig,
  events: SignalPolicyEvent[],
): SignalPolicyState {
  const rule = state.rule;
  if (rule.kind !== 'available') return state;
  if (!state.armed) {
    if (bpm >= rule.rearmBelowBpm) return { ...state, rearmSinceMs: null };
    const since = state.rearmSinceMs ?? atMs;
    if (atMs - since < config.rearmMs) return { ...state, rearmSinceMs: since };
    events.push({ kind: 'rearmed', atMs });
    return { ...state, armed: true, rearmSinceMs: null, persistenceSinceMs: null };
  }
  if (bpm <= rule.thresholdBpm) return { ...state, persistenceSinceMs: null };
  const since = state.persistenceSinceMs ?? atMs;
  const persisted = atMs - since >= config.persistenceMs;
  const cooledDown =
    state.lastTriggerAtMs === null || atMs - state.lastTriggerAtMs >= config.suggestionIntervalMs;
  if (!persisted || !cooledDown) return { ...state, persistenceSinceMs: since };
  const triggerCount = state.triggerCount + 1;
  events.push({ kind: 'triggered', triggerId: `${state.sessionId}-${triggerCount}`, atMs });
  return {
    ...state,
    armed: false,
    persistenceSinceMs: null,
    lastTriggerAtMs: atMs,
    triggerCount,
  };
}

export interface CandidateStep extends PolicyStep {
  readonly assessment: ReadingAssessment;
}

export function applyPulseCandidate(
  state: SignalPolicyState,
  candidate: PulseCandidate,
  validationOk: boolean,
  config: PulsePolicyConfig,
): CandidateStep {
  const events: SignalPolicyEvent[] = [];
  const assessment = assessPulseCandidate(candidate, state.anchor, validationOk, config);
  const atMs = candidate.receivedAtMs;
  const anchor = { sdkTimestampUs: candidate.sdkTimestampUs, receivedAtMs: atMs };
  const warmingUp = inWarmUp(state, atMs, config);

  if (assessment.kind === 'rejected') {
    let next = rejectionAdvancesAnchor(assessment.reason) ? { ...state, anchor } : state;
    // A repeated packet carries no new information and is not a quality failure.
    if (!warmingUp && assessment.reason !== 'duplicate') {
      next = interrupt(next, 'unusable', atMs, events);
    }
    return { state: next, events, assessment };
  }

  let next: SignalPolicyState = { ...state, anchor };
  if (warmingUp) return { state: next, events, assessment };
  if (
    next.lastUsableAtMs !== null &&
    next.interruptedSinceMs === null &&
    atMs - next.lastUsableAtMs > config.staleAfterMs
  ) {
    next = interrupt(next, 'stale', next.lastUsableAtMs + config.staleAfterMs, events);
  }
  next = invalidateLongInterruption(next, atMs, config, events);
  next = withQuality(
    { ...next, interruptedSinceMs: null, lastUsableAtMs: atMs },
    'usable',
    atMs,
    events,
  );
  const bpm = assessment.reading.bpm;
  next =
    next.rule.kind === 'awaiting-baseline'
      ? calibrate(next, bpm, atMs, config, events)
      : monitor(next, bpm, atMs, config, events);
  return { state: next, events, assessment };
}
