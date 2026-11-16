import { Metrics, decodeMetrics } from '@smartspectra/node-sdk/messages';
import { z } from 'zod';
import type { PulseCandidate } from '../../domain/pulse-reading';

const measurementSchema = z.object({
  value: z.number(),
  confidence: z.number(),
  stable: z.boolean(),
  /** SDK 3.5.0: microseconds; converted from int64 by protobufjs `longs: Number`. */
  timestamp: z.number(),
});

const packetSchema = z.object({
  cardio: z.object({ pulseRate: z.array(measurementSchema) }).nullish(),
});

export type PulsePacket =
  | { readonly kind: 'pulse'; readonly candidate: PulseCandidate; readonly superseded: number }
  | { readonly kind: 'no-new-pulse' }
  | { readonly kind: 'malformed' };

/**
 * Decode one SDK metrics packet and pick the newest pulse measurement that is
 * later than the last one seen. Older entries in the same packet (possible if
 * the SDK repeats history) are counted as superseded rather than replayed, so
 * overlapping windows are never treated as independent observations.
 */
export function readPulsePacket(
  buffer: Uint8Array,
  receivedAtMs: number,
  lastSdkTimestampUs: number | null,
): PulsePacket {
  let plain: unknown;
  try {
    plain = Metrics.toObject(decodeMetrics(buffer), { longs: Number, defaults: true });
  } catch {
    return { kind: 'malformed' };
  }
  const parsed = packetSchema.safeParse(plain);
  if (!parsed.success) return { kind: 'malformed' };
  const entries = parsed.data.cardio?.pulseRate ?? [];
  const fresh = entries.filter(
    (entry) => lastSdkTimestampUs === null || entry.timestamp > lastSdkTimestampUs,
  );
  const newest = fresh.reduce<(typeof fresh)[number] | null>(
    (best, entry) => (best === null || entry.timestamp > best.timestamp ? entry : best),
    null,
  );
  if (newest === null) {
    if (entries.length === 0) return { kind: 'no-new-pulse' };
    // Only repeats of already-seen measurements; pass the newest through so the
    // policy records it as a duplicate rather than as silence.
    const latest = entries.reduce((best, entry) =>
      entry.timestamp > best.timestamp ? entry : best,
    );
    return {
      kind: 'pulse',
      candidate: toCandidate(latest, receivedAtMs),
      superseded: entries.length - 1,
    };
  }
  return {
    kind: 'pulse',
    candidate: toCandidate(newest, receivedAtMs),
    superseded: fresh.length - 1,
  };
}

function toCandidate(
  entry: z.infer<typeof measurementSchema>,
  receivedAtMs: number,
): PulseCandidate {
  return {
    bpm: entry.value,
    confidence: entry.confidence,
    stable: entry.stable,
    sdkTimestampUs: entry.timestamp,
    receivedAtMs,
  };
}
