import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { storedDraftSchema } from '../../src/shared/draft-schema';
import { apiKeySchema } from '../../src/shared/sensing-types';
import { evidenceDocumentSchema } from '../../src/shared/evidence-schema';

vi.mock('electron', () => ({
  app: { isPackaged: true },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: {},
  net: {},
  protocol: {},
  session: {},
  shell: {},
  dialog: {},
}));

const { acceptInvocation } = await import('../../src/main/ipc-handlers');

const webContents = {};
const window = { webContents };
function event(url: string, options: { sender?: object; parent?: object | null } = {}) {
  return {
    sender: options.sender ?? webContents,
    senderFrame: { url, parent: options.parent ?? null },
  };
}
const schema = z.tuple([z.uuid()]);
const id = '0f3c9d7e-5b6a-4c2d-9e8f-1a2b3c4d5e6f';

describe('IPC boundary', () => {
  it('accepts a valid payload from the app main frame', () => {
    expect(acceptInvocation(event('app://headroom/index.html'), window, schema, [id])).toEqual([
      id,
    ]);
  });

  it.each([
    ['a remote page', event('https://example.com/')],
    ['a file URL', event('file:///Users/x/index.html')],
    ['a subframe', event('app://headroom/index.html', { parent: {} })],
    ['another window', event('app://headroom/index.html', { sender: {} })],
  ])('rejects calls from %s', (_label, untrusted) => {
    expect(() => acceptInvocation(untrusted, window, schema, [id])).toThrow(/untrusted/);
  });

  it('rejects malformed payloads and path-like draft ids', () => {
    expect(() =>
      acceptInvocation(event('app://headroom/'), window, schema, ['../../etc/passwd']),
    ).toThrow(/malformed/);
    expect(() => acceptInvocation(event('app://headroom/'), window, schema, [id, 'extra'])).toThrow(
      /malformed/,
    );
    expect(storedDraftSchema.safeParse({ id: '../x' }).success).toBe(false);
  });

  it('rejects API keys with control characters or excessive length', () => {
    expect(apiKeySchema.safeParse('valid-key-123').success).toBe(true);
    expect(apiKeySchema.safeParse('bad\nkey-123').success).toBe(false);
    expect(apiKeySchema.safeParse('k'.repeat(600)).success).toBe(false);
  });

  it('refuses evidence documents that carry free text or vitals', () => {
    const base = {
      format: 'headroom-evidence',
      formatVersion: 1,
      createdAt: '2026-11-15T00:00:00.000Z',
      appVersion: '0.1.0',
      policyVersion: 'pulse-policy-1',
      gateValidation: 'pending-device-validation',
      sensingProvenance: 'presage-smartspectra-live-native-camera',
      sessionElapsedMs: 10,
      eventsDropped: 0,
      events: [{ elapsedMs: 1, kind: 'layout-changed', detail: 'focused-user' }],
      counts: {},
      performance: {
        aiRequests: 0,
        aiMedianDurationMs: null,
        sensingPackets: 0,
        sensingMedianPacketIntervalMs: null,
      },
    };
    expect(evidenceDocumentSchema.safeParse(base).success).toBe(true);
    expect(
      evidenceDocumentSchema.safeParse({
        ...base,
        events: [{ elapsedMs: 1, kind: 'note', detail: 'My project is secret' }],
      }).success,
    ).toBe(false);
    expect(evidenceDocumentSchema.safeParse({ ...base, pulseBpm: 72 }).success).toBe(false);
  });
});
