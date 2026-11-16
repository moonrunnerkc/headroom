import { PULSE_POLICY } from '../domain/pulse-policy-config';
import { median } from '../domain/pulse-rule';
import {
  EVIDENCE_EVENT_LIMIT,
  evidenceDocumentSchema,
  type EvidenceDocument,
  type EvidenceEvent,
} from '../shared/evidence-schema';

/** Event kinds that may appear in the default evidence export. None carries content or vitals. */
type EvidenceKind =
  | 'layout-changed'
  | 'mode-changed'
  | 'automatic-consent'
  | 'suggestion-offered'
  | 'suggestion-accepted'
  | 'suggestion-dismissed'
  | 'suggestion-expired'
  | 'automatic-waiting'
  | 'sensor-muted'
  | 'trigger-ignored'
  | 'signal-quality'
  | 'baseline'
  | 'sensing-ended'
  | 'workspace-changed'
  | 'queue-added'
  | 'queue-dismissed'
  | 'queue-opened'
  | 'ai-result'
  | 'draft-saved'
  | 'draft-save-failed'
  | 'brief-completed'
  | 'lesson-check-submitted';

const AI_DURATION_LIMIT = 200;

export interface EvidenceRecorder {
  record(kind: EvidenceKind, detail?: string): void;
  recordAiDuration(durationMs: number): void;
  build(context: {
    appVersion: string;
    sensingPackets: number;
    sensingMedianIntervalMs: number | null;
  }): EvidenceDocument;
}

export function createEvidenceRecorder(now: () => number, wallClock: () => Date): EvidenceRecorder {
  const startedAt = now();
  const events: EvidenceEvent[] = [];
  const counts: Record<string, number> = {};
  const aiDurations: number[] = [];
  let dropped = 0;

  return {
    record(kind, detail) {
      counts[kind] = (counts[kind] ?? 0) + 1;
      const event: EvidenceEvent = { elapsedMs: Math.max(0, Math.round(now() - startedAt)), kind };
      events.push(detail === undefined ? event : { ...event, detail });
      if (events.length > EVIDENCE_EVENT_LIMIT) {
        events.shift();
        dropped += 1;
      }
    },
    recordAiDuration(durationMs) {
      aiDurations.push(durationMs);
      if (aiDurations.length > AI_DURATION_LIMIT) aiDurations.shift();
    },
    build(context) {
      // Parsing here guarantees the preview shows exactly what the main process will accept.
      return evidenceDocumentSchema.parse({
        format: 'headroom-evidence',
        formatVersion: 1,
        createdAt: wallClock().toISOString(),
        appVersion: context.appVersion,
        policyVersion: PULSE_POLICY.version,
        gateValidation: PULSE_POLICY.gateValidation,
        sensingProvenance: 'presage-smartspectra-live-native-camera',
        sessionElapsedMs: Math.round(now() - startedAt),
        eventsDropped: dropped,
        events: [...events],
        counts: { ...counts },
        performance: {
          aiRequests: aiDurations.length,
          aiMedianDurationMs: aiDurations.length === 0 ? null : Math.round(median(aiDurations)),
          sensingPackets: context.sensingPackets,
          sensingMedianPacketIntervalMs: context.sensingMedianIntervalMs,
        },
      });
    },
  };
}
