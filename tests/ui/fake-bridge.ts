import { vi } from 'vitest';
import type { HeadroomApi } from '../../src/shared/headroom-api';

/** In-memory stand-in for the preload bridge. It performs no I/O and returns explicit fake results. */
export function installFakeBridge(overrides: Partial<HeadroomApi> = {}): HeadroomApi {
  const api: HeadroomApi = {
    appInfo: vi.fn(() =>
      Promise.resolve({
        appVersion: 'test',
        sdkVersion: 'test',
        packaged: false,
        apiKeyPresent: false,
      }),
    ),
    listDrafts: vi.fn(() => Promise.resolve({ status: 'ok' as const, drafts: [] })),
    loadDraft: vi.fn(() => Promise.resolve({ status: 'error' as const, message: 'missing' })),
    saveDraft: vi.fn(() =>
      Promise.resolve({ status: 'saved' as const, savedAt: new Date(0).toISOString() }),
    ),
    deleteDraft: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    loadPreferences: vi.fn(() =>
      Promise.resolve({ status: 'unreadable' as const, message: 'unused' }),
    ),
    savePreferences: vi.fn(() => Promise.resolve({ status: 'saved' as const, savedAt: '' })),
    exportBrief: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    openTextFile: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    saveEvidence: vi.fn(() => Promise.resolve({ status: 'cancelled' as const })),
    listModels: vi.fn(() =>
      Promise.resolve({ status: 'unavailable' as const, reason: 'Ollama is not running.' }),
    ),
    explain: vi.fn(() => Promise.reject(new Error('not used'))),
    cancelExplain: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    listCameras: vi.fn(() => Promise.resolve({ status: 'ok' as const, cameras: [] })),
    cameraPermission: vi.fn(() => Promise.resolve('not-determined' as const)),
    setApiKey: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    clearApiKey: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    checkReadiness: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    startSensing: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    stopSensing: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    recalibrate: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    setPreview: vi.fn(() => Promise.resolve({ status: 'ok' as const })),
    onSnapshot: vi.fn(() => () => undefined),
    onSensingEvent: vi.fn(() => () => undefined),
    onPreview: vi.fn(() => () => undefined),
    ...overrides,
  };
  Object.defineProperty(window, 'headroom', { value: api, configurable: true });
  return api;
}
