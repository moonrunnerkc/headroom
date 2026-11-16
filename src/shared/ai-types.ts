import { z } from 'zod';
import { SOURCE_CHARACTER_LIMIT } from '../domain/source-blocks';

const EXPLANATION_MAX_CHARACTERS = 1_500;
export const QUESTION_MAX_CHARACTERS = 500;
const MAX_BLOCKS_PER_REQUEST = 5;

const localModelSchema = z.strictObject({
  name: z.string(),
  family: z.string(),
  parameterSize: z.string(),
  sizeBytes: z.number(),
});
export type LocalModel = z.infer<typeof localModelSchema>;

export const modelListSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), models: z.array(localModelSchema) }),
  z.strictObject({ status: z.literal('unavailable'), reason: z.string() }),
]);
export type ModelList = z.infer<typeof modelListSchema>;

const blockIdSchema = z.string().regex(/^b\d{3,5}$/);

export const explainRequestSchema = z
  .strictObject({
    requestId: z.uuid(),
    model: z.string().min(1).max(200),
    targetBlockId: blockIdSchema,
    question: z.string().max(QUESTION_MAX_CHARACTERS),
    blocks: z
      .array(z.strictObject({ id: blockIdSchema, text: z.string().min(1) }))
      .min(1)
      .max(MAX_BLOCKS_PER_REQUEST),
  })
  .refine((r) => r.blocks.some((b) => b.id === r.targetBlockId), 'target block must be included')
  .refine(
    (r) => r.blocks.reduce((sum, b) => sum + b.text.length, 0) <= SOURCE_CHARACTER_LIMIT,
    'source blocks exceed the character limit',
  );
export type ExplainRequest = z.infer<typeof explainRequestSchema>;

const explainErrorCodes = [
  'runtime-unavailable',
  'model-not-local',
  'busy',
  'timeout',
  'cancelled',
  'http-error',
  'malformed-output',
  'invalid-block-ids',
] as const;
export type ExplainErrorCode = (typeof explainErrorCodes)[number];

export const explainResultSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ok'),
    requestId: z.string(),
    explanation: z.string().max(EXPLANATION_MAX_CHARACTERS),
    supportingBlockIds: z.array(blockIdSchema).min(1),
    model: z.string(),
    fromSessionCache: z.boolean(),
    durationMs: z.number(),
  }),
  z.strictObject({
    status: z.literal('error'),
    requestId: z.string(),
    code: z.enum(explainErrorCodes),
    message: z.string(),
  }),
]);
export type ExplainResult = z.infer<typeof explainResultSchema>;

/** Schema the model must follow; also passed to Ollama's `format` for constrained decoding. */
export const modelOutputSchema = z.strictObject({
  explanation: z.string().min(1).max(EXPLANATION_MAX_CHARACTERS),
  supportingBlockIds: z.array(z.string()).min(1).max(MAX_BLOCKS_PER_REQUEST),
});
