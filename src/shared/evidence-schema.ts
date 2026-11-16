import { z } from 'zod';

/**
 * Default evidence export. Event detail is restricted to short kebab-case
 * tokens so free text (document content, answers, keys) cannot be carried,
 * and there is no field for physiological values.
 */
const token = z.string().regex(/^[a-z0-9-]{1,48}$/);

export const evidenceEventSchema = z.strictObject({
  elapsedMs: z.number().int().nonnegative(),
  kind: token,
  detail: token.optional(),
});
export type EvidenceEvent = z.infer<typeof evidenceEventSchema>;

export const EVIDENCE_EVENT_LIMIT = 500;

export const evidenceDocumentSchema = z.strictObject({
  format: z.literal('headroom-evidence'),
  formatVersion: z.literal(1),
  createdAt: z.iso.datetime(),
  appVersion: z.string().max(40),
  policyVersion: token,
  gateValidation: token,
  sensingProvenance: token,
  sessionElapsedMs: z.number().int().nonnegative(),
  eventsDropped: z.number().int().nonnegative(),
  events: z.array(evidenceEventSchema).max(EVIDENCE_EVENT_LIMIT),
  counts: z.record(token, z.number().int().nonnegative()),
  performance: z.strictObject({
    aiRequests: z.number().int().nonnegative(),
    aiMedianDurationMs: z.number().nonnegative().nullable(),
    sensingPackets: z.number().int().nonnegative(),
    sensingMedianPacketIntervalMs: z.number().nonnegative().nullable(),
    rendererHeapUsedMb: z.number().nonnegative().nullable(),
  }),
});
export type EvidenceDocument = z.infer<typeof evidenceDocumentSchema>;
