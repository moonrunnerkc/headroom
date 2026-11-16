import { z } from 'zod';

export const sensingFailureKinds = [
  'permission-denied',
  'permission-restricted',
  'camera-unavailable',
  'no-api-key',
  'invalid-key',
  'credits-exhausted',
  'metric-not-authorized',
  'network',
  'low-frame-rate',
  'readiness-blocked',
  'readiness-inconclusive',
  'readiness-limited',
  'interrupted-by-sleep',
  'sdk-failure',
] as const;

export type SensingFailureKind = (typeof sensingFailureKinds)[number];

const ruleSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('awaiting-baseline') }),
  z.strictObject({
    kind: z.literal('available'),
    baselineBpm: z.number(),
    thresholdBpm: z.number(),
    rearmBelowBpm: z.number(),
  }),
  z.strictObject({
    kind: z.literal('unavailable'),
    baselineBpm: z.number(),
    thresholdBpm: z.number(),
  }),
]);

export const sensingSnapshotSchema = z.strictObject({
  sessionId: z.string().nullable(),
  lifecycle: z.enum([
    'idle',
    'checking-readiness',
    'ready-to-start',
    'starting',
    'running',
    'stopping',
  ]),
  failure: z.strictObject({ kind: z.enum(sensingFailureKinds), message: z.string() }).nullable(),
  cameraId: z.string().nullable(),
  readiness: z
    .strictObject({
      verdict: z.enum(['ready', 'limited', 'blocked', 'inconclusive']),
      reason: z.string(),
      cameraId: z.string(),
    })
    .nullable(),
  processingStatus: z.enum(['uninitialized', 'idle', 'starting', 'running', 'stopping', 'error']),
  validation: z.strictObject({ code: z.number(), name: z.string(), hint: z.string() }).nullable(),
  quality: z.enum(['warming-up', 'awaiting-data', 'usable', 'unusable', 'stale']),
  rule: ruleSchema,
  calibrationProgress: z.number().min(0).max(1).nullable(),
  persistenceProgress: z.number().min(0).max(1).nullable(),
  armed: z.boolean(),
  latest: z
    .strictObject({
      bpm: z.number(),
      confidence: z.number(),
      stable: z.boolean(),
      ageMs: z.number(),
    })
    .nullable(),
  packetCount: z.number().int(),
  medianIntervalMs: z.number().nullable(),
  rejections: z.record(z.string(), z.number().int()),
  insightEventsReceived: z.number().int(),
  policyVersion: z.string(),
  gateValidation: z.enum(['pending-device-validation', 'device-validated']),
  provenance: z.literal('presage-smartspectra-live-native-camera'),
  sdkVersion: z.string(),
});

export type SensingSnapshot = z.infer<typeof sensingSnapshotSchema>;

export const sensingEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('trigger'), sessionId: z.string(), triggerId: z.string() }),
  z.strictObject({
    kind: z.literal('quality'),
    sessionId: z.string(),
    quality: z.enum(['warming-up', 'awaiting-data', 'usable', 'unusable', 'stale']),
  }),
  z.strictObject({
    kind: z.literal('baseline'),
    sessionId: z.string(),
    status: z.enum(['established', 'unavailable', 'invalidated']),
  }),
  z.strictObject({ kind: z.literal('session-ended'), sessionId: z.string(), reason: z.string() }),
]);

export type SensingEvent = z.infer<typeof sensingEventSchema>;

export const cameraInfoSchema = z.strictObject({ id: z.string(), name: z.string() });
export type CameraInfo = z.infer<typeof cameraInfoSchema>;

export const cameraListSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), cameras: z.array(cameraInfoSchema) }),
  z.strictObject({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type CameraList = z.infer<typeof cameraListSchema>;

export const cameraPermissionSchema = z.enum([
  'granted',
  'denied',
  'restricted',
  'not-determined',
  'unknown',
]);
export type CameraPermission = z.infer<typeof cameraPermissionSchema>;

export const previewFrameSchema = z.strictObject({
  sessionId: z.string(),
  jpeg: z.instanceof(Uint8Array),
  width: z.number().int(),
  height: z.number().int(),
});
export type PreviewFrame = z.infer<typeof previewFrameSchema>;

export const apiKeySchema = z
  .string()
  .trim()
  .min(8, 'The key looks too short.')
  .max(512, 'The key is too long.')
  .regex(/^[\x21-\x7e]+$/, 'The key contains unsupported characters.');
