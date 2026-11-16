import { ipcMain, type BrowserWindow } from 'electron';
import { z } from 'zod';
import { explainRequestSchema } from '../shared/ai-types';
import { draftIdSchema, preferencesSchema, storedDraftSchema } from '../shared/draft-schema';
import { evidenceDocumentSchema } from '../shared/evidence-schema';
import { INVOKE_CHANNELS, exportBriefRequestSchema, type AppInfo } from '../shared/headroom-api';
import { apiKeySchema, type CameraList, type CameraPermission } from '../shared/sensing-types';
import type { ExplanationService } from './ai/explanation-service';
import type { OllamaClient } from './ai/ollama-client';
import { exportBrief, openTextFile, saveEvidence } from './files';
import type { SensingService } from './sensing/sensing-service';
import type { DraftStore } from './storage/draft-store';
import { isTrustedRendererUrl } from './window';

export interface IpcServices {
  readonly window: () => BrowserWindow | null;
  readonly drafts: DraftStore;
  readonly sensing: SensingService;
  readonly explanations: ExplanationService;
  readonly ollama: OllamaClient;
  readonly cameras: () => CameraList;
  readonly cameraPermission: (request: boolean) => Promise<CameraPermission>;
  readonly appInfo: () => AppInfo;
}

type Channel = (typeof INVOKE_CHANNELS)[keyof typeof INVOKE_CHANNELS];

interface InvocationSource {
  readonly sender: unknown;
  readonly senderFrame: { readonly url: string; readonly parent: unknown } | null;
}

/** Accepts a call only from the main frame of Headroom's own window, with a payload matching the schema. */
export function acceptInvocation<A>(
  event: InvocationSource,
  window: { readonly webContents: unknown } | null,
  schema: z.ZodType<A>,
  raw: unknown[],
): A {
  const frame = event.senderFrame;
  const trusted =
    window !== null &&
    event.sender === window.webContents &&
    frame !== null &&
    frame.parent === null &&
    isTrustedRendererUrl(frame.url);
  if (!trusted) throw new Error('Rejected a request from an untrusted sender.');
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error('Rejected a malformed request.');
  return parsed.data;
}

export function registerIpcHandlers(services: IpcServices): () => void {
  const channels: Channel[] = [];
  function handle<A extends unknown[]>(
    channel: Channel,
    schema: z.ZodType<A>,
    run: (window: BrowserWindow, ...args: A) => unknown,
  ) {
    channels.push(channel);
    ipcMain.handle(channel, (event, ...raw: unknown[]) => {
      const window = services.window();
      const args = acceptInvocation(event, window, schema, raw);
      if (window === null) throw new Error('No window.');
      return run(window, ...args);
    });
  }
  const none = z.tuple([]);

  handle(INVOKE_CHANNELS.appInfo, none, () => services.appInfo());
  handle(INVOKE_CHANNELS.draftsList, none, async () => ({
    status: 'ok',
    drafts: await services.drafts.list(),
  }));
  handle(INVOKE_CHANNELS.draftsLoad, z.tuple([draftIdSchema]), (_w, id) =>
    services.drafts.load(id),
  );
  handle(INVOKE_CHANNELS.draftsSave, z.tuple([storedDraftSchema]), (_w, draft) =>
    services.drafts.save(draft),
  );
  handle(INVOKE_CHANNELS.draftsDelete, z.tuple([draftIdSchema]), (_w, id) =>
    services.drafts.remove(id),
  );
  handle(INVOKE_CHANNELS.deleteLocalData, none, () => services.drafts.removeAll());
  handle(INVOKE_CHANNELS.preferencesLoad, none, () => services.drafts.loadPreferences());
  handle(INVOKE_CHANNELS.preferencesSave, z.tuple([preferencesSchema]), (_w, prefs) =>
    services.drafts.savePreferences(prefs),
  );
  handle(INVOKE_CHANNELS.exportBrief, z.tuple([exportBriefRequestSchema]), (w, request) =>
    exportBrief(w, request),
  );
  handle(INVOKE_CHANNELS.openText, none, (w) => openTextFile(w));
  handle(INVOKE_CHANNELS.saveEvidence, z.tuple([evidenceDocumentSchema]), (w, doc) =>
    saveEvidence(w, doc),
  );
  handle(INVOKE_CHANNELS.aiModels, none, async () => {
    try {
      return { status: 'ok', models: await services.ollama.listLocalModels() };
    } catch (error) {
      return {
        status: 'unavailable',
        reason: error instanceof Error ? error.message : 'Ollama is unavailable.',
      };
    }
  });
  handle(INVOKE_CHANNELS.aiExplain, z.tuple([explainRequestSchema]), (_w, request) =>
    services.explanations.explain(request),
  );
  handle(INVOKE_CHANNELS.aiCancel, z.tuple([z.uuid()]), (_w, id) =>
    services.explanations.cancel(id)
      ? { status: 'ok' }
      : { status: 'error', message: 'Nothing to cancel.' },
  );
  handle(INVOKE_CHANNELS.cameras, none, () => services.cameras());
  handle(INVOKE_CHANNELS.cameraPermission, z.tuple([z.boolean()]), (_w, request) =>
    services.cameraPermission(request),
  );
  // The key is accepted here and never sent back to the renderer, logged, or persisted.
  handle(INVOKE_CHANNELS.setApiKey, z.tuple([apiKeySchema]), (_w, key) =>
    services.sensing.setApiKey(key),
  );
  handle(INVOKE_CHANNELS.clearApiKey, none, async () => {
    await services.sensing.clearApiKey();
    return { status: 'ok' };
  });
  const cameraId = z.tuple([z.string().min(1).max(256)]);
  handle(INVOKE_CHANNELS.checkReadiness, cameraId, (_w, id) => services.sensing.checkReadiness(id));
  handle(INVOKE_CHANNELS.startSensing, cameraId, (_w, id) => services.sensing.start(id));
  handle(INVOKE_CHANNELS.stopSensing, none, async () => {
    await services.sensing.stop('user');
    return { status: 'ok' };
  });
  handle(INVOKE_CHANNELS.recalibrate, none, () => services.sensing.recalibrate());
  handle(INVOKE_CHANNELS.setPreview, z.tuple([z.boolean()]), (_w, enabled) =>
    services.sensing.setPreview(enabled),
  );

  return () => {
    for (const channel of channels) ipcMain.removeHandler(channel);
  };
}
