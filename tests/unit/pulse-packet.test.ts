import { Metrics } from '@smartspectra/node-sdk/messages';
import { describe, expect, it } from 'vitest';
import { readPulsePacket } from '../../src/main/sensing/pulse-packet';

/** SYNTHETIC protobuf packets encoded with the SDK's own message class; not camera data. */
function packet(
  entries: { value: number; confidence: number; stable: boolean; timestamp: number }[],
) {
  return Metrics.encode(Metrics.create({ cardio: { pulseRate: entries } })).finish();
}

const t0 = 1_763_200_000_000_000;

describe('readPulsePacket', () => {
  it('decodes the newest pulse measurement with microsecond timestamps', () => {
    const result = readPulsePacket(
      packet([
        { value: 70, confidence: 80, stable: true, timestamp: t0 },
        { value: 72, confidence: 85, stable: true, timestamp: t0 + 500_000 },
      ]),
      1234,
      null,
    );
    expect(result).toEqual({
      kind: 'pulse',
      superseded: 1,
      candidate: {
        bpm: 72,
        confidence: 85,
        stable: true,
        sdkTimestampUs: t0 + 500_000,
        receivedAtMs: 1234,
      },
    });
  });

  it('skips accumulated entries already seen', () => {
    const buffer = packet([
      { value: 70, confidence: 80, stable: true, timestamp: t0 },
      { value: 71, confidence: 80, stable: true, timestamp: t0 + 1_000_000 },
    ]);
    const result = readPulsePacket(buffer, 5, t0);
    expect(result).toMatchObject({ kind: 'pulse', superseded: 0, candidate: { bpm: 71 } });
  });

  it('passes a pure repeat through so the policy can classify it as a duplicate', () => {
    const buffer = packet([{ value: 70, confidence: 80, stable: true, timestamp: t0 }]);
    expect(readPulsePacket(buffer, 5, t0)).toMatchObject({
      kind: 'pulse',
      candidate: { sdkTimestampUs: t0 },
    });
  });

  it('reports packets without cardio output and rejects malformed bytes', () => {
    const breathingOnly = Metrics.encode(Metrics.create({ breathing: { rate: [] } })).finish();
    expect(readPulsePacket(breathingOnly, 1, null)).toEqual({ kind: 'no-new-pulse' });
    expect(readPulsePacket(new Uint8Array([0xff, 0xff, 0xff, 0x0f]), 1, null)).toEqual({
      kind: 'malformed',
    });
  });
});
