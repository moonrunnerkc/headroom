import { z } from 'zod';
import type { ExplainRequest, ExplainResult, ModelList } from './ai-types';
import {
  briefFieldsSchema,
  type DraftListEntry,
  type Preferences,
  type StoredDraft,
} from './draft-schema';
import type { EvidenceDocument } from './evidence-schema';
import type {
  CameraList,
  CameraPermission,
  PreviewFrame,
  SensingEvent,
  SensingSnapshot,
} from './sensing-types';

/** Every privileged operation the renderer may request. Nothing else crosses the bridge. */
export const INVOKE_CHANNELS = {
  appInfo: 'app:info',
  draftsList: 'drafts:list',
  draftsLoad: 'drafts:load',
  draftsSave: 'drafts:save',
  draftsDelete: 'drafts:delete',
  preferencesLoad: 'preferences:load',
  preferencesSave: 'preferences:save',
  exportBrief: 'files:export-brief',
  openText: 'files:open-text',
  saveEvidence: 'files:save-evidence',
  aiModels: 'ai:models',
  aiExplain: 'ai:explain',
  aiCancel: 'ai:cancel',
  cameras: 'sensing:cameras',
  cameraPermission: 'sensing:camera-permission',
  setApiKey: 'sensing:set-api-key',
  clearApiKey: 'sensing:clear-api-key',
  checkReadiness: 'sensing:check-readiness',
  startSensing: 'sensing:start',
  stopSensing: 'sensing:stop',
  recalibrate: 'sensing:recalibrate',
  setPreview: 'sensing:set-preview',
} as const;

export const PUSH_CHANNELS = {
  snapshot: 'sensing:snapshot',
  event: 'sensing:event',
  preview: 'sensing:preview',
} as const;

export const appInfoSchema = z.strictObject({
  appVersion: z.string(),
  sdkVersion: z.string(),
  packaged: z.boolean(),
  apiKeyPresent: z.boolean(),
});
export type AppInfo = z.infer<typeof appInfoSchema>;

export const operationErrorSchema = z.strictObject({
  status: z.literal('error'),
  message: z.string(),
});

export const saveResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('saved'), savedAt: z.string() }),
  operationErrorSchema,
]);
export type SaveResult = z.infer<typeof saveResultSchema>;

export const fileWriteResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('saved'), fileName: z.string() }),
  z.strictObject({ status: z.literal('cancelled') }),
  operationErrorSchema,
]);
export type FileWriteResult = z.infer<typeof fileWriteResultSchema>;

export const openTextResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('opened'), fileName: z.string(), text: z.string() }),
  z.strictObject({ status: z.literal('cancelled') }),
  operationErrorSchema,
]);
export type OpenTextResult = z.infer<typeof openTextResultSchema>;

export const exportBriefRequestSchema = z.strictObject({
  format: z.enum(['json', 'markdown']),
  fields: briefFieldsSchema,
  complete: z.boolean(),
  sample: z.boolean(),
});
export type ExportBriefRequest = z.infer<typeof exportBriefRequestSchema>;

export const sensingCommandResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok') }),
  operationErrorSchema,
]);
export type SensingCommandResult = z.infer<typeof sensingCommandResultSchema>;

export type Unsubscribe = () => void;

export interface HeadroomApi {
  appInfo(): Promise<AppInfo>;
  listDrafts(): Promise<
    { status: 'ok'; drafts: DraftListEntry[] } | { status: 'error'; message: string }
  >;
  loadDraft(
    id: string,
  ): Promise<{ status: 'ok'; draft: StoredDraft } | { status: 'error'; message: string }>;
  saveDraft(draft: StoredDraft): Promise<SaveResult>;
  deleteDraft(id: string): Promise<SensingCommandResult>;
  loadPreferences(): Promise<
    { status: 'ok'; preferences: Preferences } | { status: 'unreadable'; message: string }
  >;
  savePreferences(preferences: Preferences): Promise<SaveResult>;
  exportBrief(request: ExportBriefRequest): Promise<FileWriteResult>;
  openTextFile(): Promise<OpenTextResult>;
  saveEvidence(document: EvidenceDocument): Promise<FileWriteResult>;
  listModels(): Promise<ModelList>;
  explain(request: ExplainRequest): Promise<ExplainResult>;
  cancelExplain(requestId: string): Promise<SensingCommandResult>;
  listCameras(): Promise<CameraList>;
  cameraPermission(request: boolean): Promise<CameraPermission>;
  setApiKey(key: string): Promise<SensingCommandResult>;
  clearApiKey(): Promise<SensingCommandResult>;
  checkReadiness(cameraId: string): Promise<SensingCommandResult>;
  startSensing(cameraId: string): Promise<SensingCommandResult>;
  stopSensing(): Promise<SensingCommandResult>;
  recalibrate(): Promise<SensingCommandResult>;
  setPreview(enabled: boolean): Promise<SensingCommandResult>;
  onSnapshot(listener: (snapshot: SensingSnapshot) => void): Unsubscribe;
  onSensingEvent(listener: (event: SensingEvent) => void): Unsubscribe;
  onPreview(listener: (frame: PreviewFrame) => void): Unsubscribe;
}
