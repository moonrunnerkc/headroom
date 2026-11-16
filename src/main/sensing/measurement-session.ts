import { PULSE_POLICY } from '../../domain/pulse-policy-config';
import type { PulseCandidate } from '../../domain/pulse-reading';
import {
  applyPulseCandidate,
  createSignalPolicy,
  markInvalidInterval,
  recalibrate,
  tickSignalPolicy,
  type PolicyStep,
  type SignalPolicyEvent,
  type SignalPolicyState,
} from '../../domain/signal-policy';
import type { SensingEvent, SensingSnapshot } from '../../shared/sensing-types';
import { median } from '../../domain/pulse-rule';
import { readPulsePacket } from './pulse-packet';
import { VALIDATION_OK, validationName } from './sdk-codes';

const INTERVAL_HISTORY = 64;

type MeasurementView = Pick<
  SensingSnapshot,
  | 'validation'
  | 'quality'
  | 'rule'
  | 'calibrationProgress'
  | 'persistenceProgress'
  | 'armed'
  | 'latest'
  | 'packetCount'
  | 'medianIntervalMs'
  | 'rejections'
>;

export const IDLE_MEASUREMENT_VIEW: MeasurementView = {
  validation: null,
  quality: 'awaiting-data',
  rule: { kind: 'awaiting-baseline' },
  calibrationProgress: null,
  persistenceProgress: null,
  armed: true,
  latest: null,
  packetCount: 0,
  medianIntervalMs: null,
  rejections: {},
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Bounded measurement state for one capture session. Holds only the latest
 * reading, a fixed-size interval history, counters, and the policy state;
 * everything is discarded when the session ends.
 */
export function createMeasurementSession(sessionId: string, emit: (event: SensingEvent) => void) {
  let policy: SignalPolicyState | null = null;
  let validation: SensingSnapshot['validation'] = null;
  let latest: PulseCandidate | null = null;
  let lastPacketAtMs: number | null = null;
  const intervals: number[] = [];
  let packetCount = 0;
  const rejections: Record<string, number> = {};

  const count = (reason: string) => {
    rejections[reason] = (rejections[reason] ?? 0) + 1;
  };

  function dispatch(events: readonly SignalPolicyEvent[]) {
    for (const event of events) {
      switch (event.kind) {
        case 'quality-changed':
          emit({ kind: 'quality', sessionId, quality: event.quality });
          break;
        case 'triggered':
          emit({ kind: 'trigger', sessionId, triggerId: event.triggerId });
          break;
        case 'baseline-established':
          emit({
            kind: 'baseline',
            sessionId,
            status: event.rule.kind === 'available' ? 'established' : 'unavailable',
          });
          break;
        case 'baseline-invalidated':
          emit({ kind: 'baseline', sessionId, status: 'invalidated' });
          break;
        case 'calibration-restarted':
        case 'rearmed':
          break;
      }
    }
  }

  function step(update: (state: SignalPolicyState) => PolicyStep) {
    if (policy === null) return;
    const result = update(policy);
    policy = result.state;
    dispatch(result.events);
  }

  return {
    /** The SDK reported Running: warm-up starts now. */
    processingStarted(nowMs: number) {
      policy ??= createSignalPolicy(sessionId, nowMs);
    },
    validation(code: number, hint: string, nowMs: number) {
      validation = { code, name: validationName(code), hint: hint.slice(0, 200) };
      if (code !== VALIDATION_OK) step((state) => markInvalidInterval(state, nowMs, PULSE_POLICY));
    },
    packet(buffer: Uint8Array, nowMs: number) {
      packetCount += 1;
      if (lastPacketAtMs !== null) {
        intervals.push(nowMs - lastPacketAtMs);
        if (intervals.length > INTERVAL_HISTORY) intervals.shift();
      }
      lastPacketAtMs = nowMs;
      if (policy === null) return;
      const packet = readPulsePacket(buffer, nowMs, policy.anchor?.sdkTimestampUs ?? null);
      if (packet.kind === 'no-new-pulse') return;
      if (packet.kind === 'malformed') {
        count('malformed-packet');
        step((state) => markInvalidInterval(state, nowMs, PULSE_POLICY));
        return;
      }
      if (packet.superseded > 0) count('superseded-in-packet');
      latest = packet.candidate;
      const ok = validation?.code === VALIDATION_OK;
      const result = applyPulseCandidate(policy, packet.candidate, ok, PULSE_POLICY);
      if (result.assessment.kind === 'rejected') count(result.assessment.reason);
      policy = result.state;
      dispatch(result.events);
    },
    tick(nowMs: number) {
      step((state) => tickSignalPolicy(state, nowMs, PULSE_POLICY));
    },
    recalibrate(nowMs: number) {
      step((state) => recalibrate(state, nowMs));
    },
    view(nowMs: number): MeasurementView {
      const calibration = policy?.calibration ?? null;
      const persistence = policy?.persistenceSinceMs ?? null;
      const rule = policy?.rule ?? { kind: 'awaiting-baseline' as const };
      return {
        validation,
        quality: policy?.quality ?? 'warming-up',
        rule:
          rule.kind === 'awaiting-baseline'
            ? rule
            : rule.kind === 'available'
              ? {
                  kind: 'available',
                  baselineBpm: round1(rule.baselineBpm),
                  thresholdBpm: round1(rule.thresholdBpm),
                  rearmBelowBpm: round1(rule.rearmBelowBpm),
                }
              : {
                  kind: 'unavailable',
                  baselineBpm: round1(rule.baselineBpm),
                  thresholdBpm: round1(rule.thresholdBpm),
                },
        calibrationProgress:
          calibration === null
            ? null
            : Math.min(1, (nowMs - calibration.startedAtMs) / PULSE_POLICY.calibrationMs),
        persistenceProgress:
          persistence === null
            ? null
            : Math.min(1, (nowMs - persistence) / PULSE_POLICY.persistenceMs),
        armed: policy?.armed ?? true,
        latest:
          latest === null
            ? null
            : {
                bpm: round1(latest.bpm),
                confidence: round1(latest.confidence),
                stable: latest.stable,
                ageMs: Math.round(nowMs - latest.receivedAtMs),
              },
        packetCount,
        medianIntervalMs: intervals.length === 0 ? null : Math.round(median(intervals)),
        rejections: { ...rejections },
      };
    },
  };
}

export type MeasurementSession = ReturnType<typeof createMeasurementSession>;
