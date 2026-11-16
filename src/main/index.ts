import { join } from 'node:path';
import { app, dialog } from 'electron';

// The Presage SDK resolves its native runtime as soon as it is first loaded, so the packaged
// location (outside app.asar; see electron-builder.yml) must be set before anything imports it.
// The rest of the main process is therefore loaded only after this assignment.
if (app.isPackaged) {
  process.env['SMARTSPECTRA_CAPI_PATH'] = join(
    process.resourcesPath,
    'smartspectra',
    'libsmartspectra_capi.dylib',
  );
}

// Lets automated tests isolate storage; it changes only where drafts are kept.
const userDataOverride = process.env['HEADROOM_USER_DATA_DIR'];
if (userDataOverride !== undefined && userDataOverride !== '') {
  app.setPath('userData', userDataOverride);
}

import('./app-main').catch((error: unknown) => {
  dialog.showErrorBox(
    'Headroom could not start',
    error instanceof Error ? error.message : 'Unknown startup error.',
  );
  app.exit(1);
});
