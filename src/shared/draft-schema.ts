import { z } from 'zod';
import { FIELD_SPECS, type BriefFields } from '../domain/brief';

// Storage limits are a little above validation limits so an over-long draft can
// still be saved and corrected instead of being lost.
const fieldText = (id: keyof BriefFields) => z.string().max(FIELD_SPECS[id].maxLength * 4);

export const briefFieldsSchema = z.strictObject({
  title: fieldText('title'),
  objective: fieldText('objective'),
  audience: fieldText('audience'),
  scope: fieldText('scope'),
  constraints: fieldText('constraints'),
  targetDate: fieldText('targetDate'),
  budgetAmount: fieldText('budgetAmount'),
  budgetCurrency: fieldText('budgetCurrency'),
  resources: fieldText('resources'),
  deliverables: fieldText('deliverables'),
  successCriteria: fieldText('successCriteria'),
}) satisfies z.ZodType<BriefFields>;

export const draftIdSchema = z.string().regex(/^[a-f0-9-]{36}$/, 'draft id must be a UUID');

export const storedDraftSchema = z.strictObject({
  formatVersion: z.literal(1),
  id: draftIdSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  complete: z.boolean(),
  sample: z.boolean(),
  fields: briefFieldsSchema,
});

export type StoredDraft = z.infer<typeof storedDraftSchema>;

export const draftListEntrySchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('ok'),
    id: draftIdSchema,
    title: z.string(),
    updatedAt: z.string(),
    complete: z.boolean(),
    sample: z.boolean(),
  }),
  z.strictObject({ status: z.literal('unreadable'), id: draftIdSchema, problem: z.string() }),
]);

export type DraftListEntry = z.infer<typeof draftListEntrySchema>;

export const preferencesSchema = z.strictObject({
  formatVersion: z.literal(1),
  layout: z.enum(['standard', 'focused']),
  // Automatic mode is never persisted: it needs fresh consent each session.
  mode: z.enum(['manual', 'suggest']),
  aiModel: z.string().max(200).nullable(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  formatVersion: 1,
  layout: 'standard',
  mode: 'manual',
  aiModel: null,
};
