import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { BrowserWindow, app, nativeImage, powerMonitor, systemPreferences } from 'electron';
import { PUSH_CHANNELS } from '../shared/headroom-api';
import type { CameraList, CameraPermission } from '../shared/sensing-types';
import { createExplanationService } from './ai/explanation-service';
import { createOllamaClient } from './ai/ollama-client';
import { registerIpcHandlers } from './ipc-handlers';
import {
  awaitSdkIdle,
  checkReadiness,
  discoverCameras,
  openPresageSession,
  sdkVersion,
} from './sensing/presage-session';
import { downscaleToBgra } from './sensing/preview-frame';
import { createSensingService } from './sensing/sensing-service';
import { createDraftStore } from './storage/draft-store';
import { applySessionPolicy, createMainWindow, registerAppScheme, serveRenderer } from './window';

// Packaged builds ship the native runtime outside app.asar (see electron-builder.yml).
if (app.isPackaged) {
  process.env['SMARTSPECTRA_CAPI_PATH'] = join(
    process.resourcesPath,
    'smartspectra',
    'libsmartspectra_capi.dylib',
  );
}
// Lets automated tests isolate storage; it changes only where drafts are kept.
const userDataOverride = process.env['HEADROOM_USER_DATA_DIR'];
if (userDataOverride !== undefined && userDataOverride !== '')
  app.setPath('userData', userDataOverride);

registerAppScheme();
if (!app.requestSingleInstanceLock()) app.quit();

let mainWindow: BrowserWindow | null = null;
const liveWindow = () => (mainWindow !== null && !mainWindow.isDestroyed() ? mainWindow : null);
const send = (channel: string, payload: unknown) => {
  liveWindow()?.webContents.send(channel, payload);
};

function cameraPermission(): CameraPermission {
  return systemPreferences.getMediaAccessStatus('camera');
}

const sensing = createSensingService({
  now: () => performance.now(),
  newSessionId: () => randomUUID(),
  sdkVersion: sdkVersion(),
  cameraPermission,
  checkReadiness,
  openSession: openPresageSession,
  encodePreview: (frame) => {
    const image = downscaleToBgra(frame);
    if (image === null) return null;
    const jpeg = nativeImage
      .createFromBitmap(image.data, { width: image.width, height: image.height })
      .toJPEG(70);
    return { jpeg: new Uint8Array(jpeg), width: image.width, height: image.height };
  },
  publish: (snapshot) => {
    send(PUSH_CHANNELS.snapshot, snapshot);
  },
  emit: (event) => {
    send(PUSH_CHANNELS.event, event);
  },
  sendPreview: (frame) => {
    send(PUSH_CHANNELS.preview, frame);
  },
  startTimer: (callback, intervalMs) => {
    const timer = setInterval(callback, intervalMs);
    return () => {
      clearInterval(timer);
    };
  },
});

// Late-bound so a test harness can observe requests; the endpoint stays fixed to loopback.
const ollama = createOllamaClient((url, init) => fetch(url, init));
const explanations = createExplanationService(ollama, () => performance.now());

function listCameras(): CameraList {
  try {
    return { status: 'ok', cameras: discoverCameras() };
  } catch {
    return { status: 'unavailable', reason: 'Camera discovery is not available on this Mac.' };
  }
}

let shutdownComplete = false;
async function shutdown(): Promise<void> {
  explanations.cancelAll();
  await sensing.stop('app-quit');
  await awaitSdkIdle();
}

void app.whenReady().then(() => {
  applySessionPolicy();
  serveRenderer();
  const drafts = createDraftStore(join(app.getPath('userData'), 'headroom-data'));
  registerIpcHandlers({
    window: liveWindow,
    drafts,
    sensing,
    explanations,
    ollama,
    cameras: listCameras,
    cameraPermission: async (request) => {
      if (request && cameraPermission() === 'not-determined') {
        await systemPreferences.askForMediaAccess('camera');
      }
      return cameraPermission();
    },
    appInfo: () => ({
      appVersion: app.getVersion(),
      sdkVersion: sdkVersion(),
      packaged: app.isPackaged,
      apiKeyPresent: sensing.hasApiKey(),
    }),
  });
  mainWindow = createMainWindow();
  mainWindow.on('closed', () => {
    mainWindow = null;
    void sensing.stop('window-closed');
  });
  // Capture never resumes after sleep; the user must start it again.
  powerMonitor.on('suspend', () => {
    void sensing.interrupt(
      'interrupted-by-sleep',
      'Sensing stopped because the Mac went to sleep. Start it again when ready.',
    );
  });
});

app.on('second-instance', () => {
  liveWindow()?.focus();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  void shutdown().finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});
