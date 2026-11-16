import { describe, expect, it, vi } from 'vitest';
import { SmartSpectraErrorCode, ProcessingStatus, ValidationCode } from '@smartspectra/node-sdk';
import { createSensingService, type SensingDeps } from '../../src/main/sensing/sensing-service';
import type { PresageCallbacks } from '../../src/main/sensing/presage-session';
import type { SensingEvent, SensingSnapshot } from '../../src/shared/sensing-types';

/** A fake SDK boundary: no camera, no network, no Presage service. */
function harness(overrides: Partial<SensingDeps> = {}) {
  let clock = 0;
  let sessionCounter = 0;
  const callbacks: PresageCallbacks[] = [];
  const sessions: { start: ReturnType<typeof vi.fn>; shutdown: ReturnType<typeof vi.fn> }[] = [];
  const snapshots: SensingSnapshot[] = [];
  const events: SensingEvent[] = [];
  const timers = { active: 0, started: 0, tick: () => undefined as void };
  const deps: SensingDeps = {
    now: () => clock,
    newSessionId: () => `session-${++sessionCounter}`,
    sdkVersion: 'test',
    cameraPermission: () => 'granted',
    checkReadiness: vi.fn(() => Promise.resolve({ verdict: 'ready' as const, reason: 'ok' })),
    openSession: vi.fn((_key: string, _camera: string, cb: PresageCallbacks) => {
      callbacks.push(cb);
      const session = { start: vi.fn(), shutdown: vi.fn(() => Promise.resolve()) };
      sessions.push(session);
      return Promise.resolve(session);
    }),
    encodePreview: () => null,
    publish: (snapshot) => snapshots.push(snapshot),
    emit: (event) => events.push(event),
    sendPreview: vi.fn(),
    startTimer: (callback) => {
      timers.active += 1;
      timers.started += 1;
      timers.tick = callback;
      return () => {
        timers.active -= 1;
      };
    },
    ...overrides,
  };
  const service = createSensingService(deps);
  return {
    service,
    deps,
    callbacks,
    sessions,
    events,
    timers,
    last: () => service.snapshot(),
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

async function running() {
  const h = harness();
  h.service.setApiKey('test-key-123');
  await h.service.checkReadiness('cam-1');
  expect(await h.service.start('cam-1')).toEqual({ status: 'ok' });
  return h;
}

describe('consent and prerequisites', () => {
  it('refuses readiness and capture without a session API key', async () => {
    const h = harness();
    expect(await h.service.checkReadiness('cam-1')).toMatchObject({ status: 'error' });
    expect(h.last().failure?.kind).toBe('no-api-key');
    expect(h.deps.checkReadiness).not.toHaveBeenCalled();
  });

  it('refuses when macOS camera permission is denied', async () => {
    const h = harness({ cameraPermission: () => 'denied' });
    h.service.setApiKey('test-key-123');
    await h.service.checkReadiness('cam-1');
    expect(h.last().failure?.kind).toBe('permission-denied');
    expect(h.deps.checkReadiness).not.toHaveBeenCalled();
  });

  it('requires a passing readiness check for the same camera and key', async () => {
    const h = harness();
    h.service.setApiKey('test-key-123');
    expect(await h.service.start('cam-1')).toMatchObject({ status: 'error' });
    await h.service.checkReadiness('cam-1');
    expect(await h.service.start('cam-2')).toMatchObject({ status: 'error' });
    h.service.setApiKey('another-key-456');
    expect(await h.service.start('cam-1')).toMatchObject({ status: 'error' });
    expect(h.deps.openSession).not.toHaveBeenCalled();
  });

  it.each([
    ['blocked', 'readiness-blocked'],
    ['inconclusive', 'readiness-inconclusive'],
  ] as const)('a %s verdict blocks capture', async (verdict, kind) => {
    const h = harness({ checkReadiness: () => Promise.resolve({ verdict, reason: 'because' }) });
    h.service.setApiKey('test-key-123');
    await h.service.checkReadiness('cam-1');
    expect(h.last()).toMatchObject({ lifecycle: 'idle', failure: { kind, message: 'because' } });
    expect(await h.service.start('cam-1')).toMatchObject({ status: 'error' });
  });

  it('maps a thrown authentication failure during readiness', async () => {
    const error = Object.assign(new Error('nope'), {
      code: SmartSpectraErrorCode.kAuthenticationFailed,
    });
    const h = harness({ checkReadiness: () => Promise.reject(error) });
    h.service.setApiKey('test-key-123');
    await h.service.checkReadiness('cam-1');
    expect(h.last().failure?.kind).toBe('invalid-key');
  });
});

describe('lifecycle and teardown', () => {
  it('stop releases the session, stops the watchdog timer, and clears measurements', async () => {
    const h = await running();
    const cb = h.callbacks[0];
    cb?.onStatus(ProcessingStatus.kRunning);
    cb?.onValidation(ValidationCode.kOk, '');
    cb?.onMetrics(Buffer.alloc(0));
    expect(h.last().packetCount).toBe(1);
    await h.service.stop('user');
    expect(h.sessions[0]?.shutdown).toHaveBeenCalledTimes(1);
    expect(h.timers.active).toBe(0);
    expect(h.last()).toMatchObject({
      lifecycle: 'idle',
      sessionId: null,
      packetCount: 0,
      latest: null,
    });
    expect(h.events).toContainEqual({
      kind: 'session-ended',
      sessionId: 'session-1',
      reason: 'user',
    });
  });

  it('ignores callbacks that arrive after the session ended', async () => {
    const h = await running();
    await h.service.stop('user');
    const before = h.events.length;
    h.callbacks[0]?.onStatus(ProcessingStatus.kRunning);
    h.callbacks[0]?.onMetrics(Buffer.alloc(0));
    h.callbacks[0]?.onError(SmartSpectraErrorCode.kCreditExhausted);
    expect(h.events.length).toBe(before);
    expect(h.last()).toMatchObject({ lifecycle: 'idle', failure: null, packetCount: 0 });
  });

  it('an SDK error stops capture once and never restarts it', async () => {
    const h = await running();
    h.callbacks[0]?.onError(SmartSpectraErrorCode.kCreditExhausted);
    await vi.waitFor(() => expect(h.last().lifecycle).toBe('idle'));
    expect(h.last().failure?.kind).toBe('credits-exhausted');
    expect(h.sessions[0]?.shutdown).toHaveBeenCalledTimes(1);
    expect(h.deps.openSession).toHaveBeenCalledTimes(1);
  });

  it('rejects a repeated start while running', async () => {
    const h = await running();
    expect(await h.service.start('cam-1')).toMatchObject({ status: 'error' });
    expect(h.deps.openSession).toHaveBeenCalledTimes(1);
  });

  it('a stop while the SDK is still opening shuts the late session down', async () => {
    let resolveOpen: (value: { start: () => void; shutdown: () => Promise<void> }) => void = () =>
      undefined;
    const late = { start: vi.fn(), shutdown: vi.fn(() => Promise.resolve()) };
    const h = harness({
      openSession: () =>
        new Promise((resolve) => {
          resolveOpen = resolve;
        }),
    });
    h.service.setApiKey('test-key-123');
    await h.service.checkReadiness('cam-1');
    const starting = h.service.start('cam-1');
    const stopping = h.service.stop('user');
    resolveOpen(late);
    expect(await starting).toMatchObject({ status: 'error' });
    await stopping;
    expect(late.start).not.toHaveBeenCalled();
    expect(late.shutdown).toHaveBeenCalledTimes(1);
    expect(h.last().lifecycle).toBe('idle');
  });

  it('concurrent stops share one teardown and stay "stopping" until it finishes', async () => {
    let finish: () => void = () => undefined;
    const h = await running();
    h.sessions[0]?.shutdown.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const first = h.service.stop('user');
    const second = h.service.stop('window-closed');
    expect(h.last().lifecycle).toBe('stopping');
    finish();
    await Promise.all([first, second]);
    expect(h.sessions[0]?.shutdown).toHaveBeenCalledTimes(1);
    expect(h.last().lifecycle).toBe('idle');
  });

  it('system sleep interrupts capture and records why', async () => {
    const h = await running();
    await h.service.interrupt(
      'interrupted-by-sleep',
      'Sensing stopped because the Mac went to sleep.',
    );
    expect(h.last()).toMatchObject({
      lifecycle: 'idle',
      failure: { kind: 'interrupted-by-sleep' },
    });
    expect(h.deps.openSession).toHaveBeenCalledTimes(1);
  });

  it('an LLM insight packet is treated as a violation and stops capture', async () => {
    const h = await running();
    h.callbacks[0]?.onInsight();
    await vi.waitFor(() => expect(h.last().lifecycle).toBe('idle'));
    expect(h.last().failure?.message).toMatch(/LLM insight/);
  });

  it('clearing the key stops capture and requires a new readiness check', async () => {
    const h = await running();
    await h.service.clearApiKey();
    expect(h.service.hasApiKey()).toBe(false);
    expect(h.last().readiness).toBeNull();
    expect(h.sessions[0]?.shutdown).toHaveBeenCalledTimes(1);
  });
});
