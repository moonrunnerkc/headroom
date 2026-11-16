import { join, normalize, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app, net, protocol, session, shell, type WebContents } from 'electron';

export const APP_SCHEME = 'app';
const APP_HOST = 'headroom';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true } },
  ]);
}

function devServerUrl(): string | null {
  const url = process.env['ELECTRON_RENDERER_URL'];
  return !app.isPackaged && url !== undefined && url !== '' ? url : null;
}

/** Serves only files inside the built renderer directory; anything else is 404. */
export function serveRenderer(): void {
  const root = join(__dirname, '../renderer');
  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
    const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = normalize(join(root, requested));
    const inside = relative(root, file);
    if (inside.startsWith('..') || isAbsolute(inside))
      return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

/** True only for the main frame of Headroom's own renderer. */
export function isTrustedRendererUrl(url: string): boolean {
  const dev = devServerUrl();
  if (dev !== null && url.startsWith(new URL(dev).origin)) return true;
  return url.startsWith(`${APP_ORIGIN}/`);
}

function harden(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    // External citation links open in the user's browser, never inside the app.
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) event.preventDefault();
  });
  contents.on('will-redirect', (event) => {
    event.preventDefault();
  });
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

export function applySessionPolicy(): void {
  // Capture runs natively in the main process, so the renderer needs no media
  // or any other browser permission.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 640,
    minHeight: 560,
    show: false,
    title: 'Headroom',
    backgroundColor: '#f7f6f2',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: true,
      devTools: !app.isPackaged,
    },
  });
  harden(window.webContents);
  window.once('ready-to-show', () => {
    window.show();
  });
  const dev = devServerUrl();
  void (dev !== null ? window.loadURL(dev) : window.loadURL(`${APP_ORIGIN}/index.html`));
  return window;
}
