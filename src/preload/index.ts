import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { z } from 'zod';
import { explainResultSchema, modelListSchema } from '../shared/ai-types';
import { draftListEntrySchema, preferencesSchema, storedDraftSchema } from '../shared/draft-schema';
import {
  INVOKE_CHANNELS,
  PUSH_CHANNELS,
  appInfoSchema,
  fileWriteResultSchema,
  openTextResultSchema,
  operationErrorSchema,
  saveResultSchema,
  sensingCommandResultSchema,
  type HeadroomApi,
} from '../shared/headroom-api';
import {
  cameraListSchema,
  cameraPermissionSchema,
  previewFrameSchema,
  sensingEventSchema,
  sensingSnapshotSchema,
} from '../shared/sensing-types';

type Channel = (typeof INVOKE_CHANNELS)[keyof typeof INVOKE_CHANNELS];

async function invoke<T>(channel: Channel, schema: z.ZodType<T>, ...args: unknown[]): Promise<T> {
  const response: unknown = await ipcRenderer.invoke(channel, ...args);
  return schema.parse(response);
}

function subscribe<T>(channel: string, schema: z.ZodType<T>, listener: (value: T) => void) {
  const handler = (_event: IpcRendererEvent, payload: unknown) => {
    const parsed = schema.safeParse(payload);
    if (parsed.success) listener(parsed.data);
    else console.error(`Rejected malformed ${channel} message from the main process.`);
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const draftsResult = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), drafts: z.array(draftListEntrySchema) }),
  operationErrorSchema,
]);
const draftResult = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), draft: storedDraftSchema }),
  operationErrorSchema,
]);
const preferencesResult = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('ok'), preferences: preferencesSchema }),
  z.strictObject({ status: z.literal('unreadable'), message: z.string() }),
]);

const api: HeadroomApi = {
  appInfo: () => invoke(INVOKE_CHANNELS.appInfo, appInfoSchema),
  listDrafts: () => invoke(INVOKE_CHANNELS.draftsList, draftsResult),
  loadDraft: (id) => invoke(INVOKE_CHANNELS.draftsLoad, draftResult, id),
  saveDraft: (draft) => invoke(INVOKE_CHANNELS.draftsSave, saveResultSchema, draft),
  deleteDraft: (id) => invoke(INVOKE_CHANNELS.draftsDelete, sensingCommandResultSchema, id),
  loadPreferences: () => invoke(INVOKE_CHANNELS.preferencesLoad, preferencesResult),
  savePreferences: (preferences) =>
    invoke(INVOKE_CHANNELS.preferencesSave, saveResultSchema, preferences),
  exportBrief: (request) => invoke(INVOKE_CHANNELS.exportBrief, fileWriteResultSchema, request),
  openTextFile: () => invoke(INVOKE_CHANNELS.openText, openTextResultSchema),
  saveEvidence: (document) => invoke(INVOKE_CHANNELS.saveEvidence, fileWriteResultSchema, document),
  listModels: () => invoke(INVOKE_CHANNELS.aiModels, modelListSchema),
  explain: (request) => invoke(INVOKE_CHANNELS.aiExplain, explainResultSchema, request),
  cancelExplain: (requestId) =>
    invoke(INVOKE_CHANNELS.aiCancel, sensingCommandResultSchema, requestId),
  listCameras: () => invoke(INVOKE_CHANNELS.cameras, cameraListSchema),
  cameraPermission: (request) =>
    invoke(INVOKE_CHANNELS.cameraPermission, cameraPermissionSchema, request),
  setApiKey: (key) => invoke(INVOKE_CHANNELS.setApiKey, sensingCommandResultSchema, key),
  clearApiKey: () => invoke(INVOKE_CHANNELS.clearApiKey, sensingCommandResultSchema),
  checkReadiness: (cameraId) =>
    invoke(INVOKE_CHANNELS.checkReadiness, sensingCommandResultSchema, cameraId),
  startSensing: (cameraId) =>
    invoke(INVOKE_CHANNELS.startSensing, sensingCommandResultSchema, cameraId),
  stopSensing: () => invoke(INVOKE_CHANNELS.stopSensing, sensingCommandResultSchema),
  recalibrate: () => invoke(INVOKE_CHANNELS.recalibrate, sensingCommandResultSchema),
  setPreview: (enabled) => invoke(INVOKE_CHANNELS.setPreview, sensingCommandResultSchema, enabled),
  onSnapshot: (listener) => subscribe(PUSH_CHANNELS.snapshot, sensingSnapshotSchema, listener),
  onSensingEvent: (listener) => subscribe(PUSH_CHANNELS.event, sensingEventSchema, listener),
  onPreview: (listener) => subscribe(PUSH_CHANNELS.preview, previewFrameSchema, listener),
};

contextBridge.exposeInMainWorld('headroom', api);
