import { PULSE_POLICY } from '../../domain/pulse-policy-config';
import type {
  CameraPermission,
  PreviewFrame,
  SensingEvent,
  SensingFailureKind,
  SensingSnapshot,
} from '../../shared/sensing-types';
import {
  IDLE_MEASUREMENT_VIEW,
  createMeasurementSession,
  type MeasurementSession,
} from './measurement-session';
import type { PresageCallbacks, PresageSession, RawFrame } from './presage-session';
import { mapSdkError, processingStatusName, type MappedFailure } from './sdk-codes';
import {
  PIPELINE_ERROR,
  UNEXPECTED_INSIGHT,
  failureFromThrown,
  interpretReadiness,
  permissionProblem,
  type ReadinessVerdict,
} from './sensing-interpretation';

export interface SensingDeps {
  now(): number;
  newSessionId(): string;
  sdkVersion: string;
  cameraPermission(): CameraPermission;
  checkReadiness(
    key: string,
    camera: string,
  ): Promise<{ verdict: ReadinessVerdict; reason: string }>;
  openSession(key: string, camera: string, callbacks: PresageCallbacks): Promise<PresageSession>;
  encodePreview(frame: RawFrame): Omit<PreviewFrame, 'sessionId'> | null;
  publish(snapshot: SensingSnapshot): void;
  emit(event: SensingEvent): void;
  sendPreview(frame: PreviewFrame): void;
  startTimer(callback: () => void, intervalMs: number): () => void;
}

type CommandResult = { status: 'ok' } | { status: 'error'; message: string };

interface ActiveSession {
  readonly id: string;
  readonly cameraId: string;
  session: PresageSession | null;
  readonly measurement: MeasurementSession;
  processingStatus: SensingSnapshot['processingStatus'];
  insightEvents: number;
  previewEnabled: boolean;
  lastPreviewAtMs: number;
  stopTimer: () => void;
}

/** UI updates and the silence watchdog both run at 4 Hz. */
const TICK_MS = 250;
const NOT_RUNNING: CommandResult = { status: 'error', message: 'Sensing is not running.' };

export function createSensingService(deps: SensingDeps) {
  let apiKey: string | null = null;
  let keyGeneration = 0;
  let lifecycle: SensingSnapshot['lifecycle'] = 'idle';
  let failure: SensingSnapshot['failure'] = null;
  let readiness: SensingSnapshot['readiness'] = null;
  let readinessKeyGeneration = -1;
  let active: ActiveSession | null = null;
  let pendingWork: Promise<unknown> = Promise.resolve();
  let operation = 0;
  let stopping: Promise<void> | null = null;

  function snapshot(): SensingSnapshot {
    const now = deps.now();
    return {
      sessionId: active?.id ?? null,
      lifecycle,
      failure,
      cameraId: active?.cameraId ?? readiness?.cameraId ?? null,
      readiness,
      processingStatus: active?.processingStatus ?? 'uninitialized',
      ...(active?.measurement.view(now) ?? IDLE_MEASUREMENT_VIEW),
      insightEventsReceived: active?.insightEvents ?? 0,
      policyVersion: PULSE_POLICY.version,
      gateValidation: PULSE_POLICY.gateValidation,
      provenance: 'presage-smartspectra-live-native-camera',
      sdkVersion: deps.sdkVersion,
    };
  }

  const publish = () => {
    deps.publish(snapshot());
  };

  function preconditions(cameraId: string): string | null {
    if (lifecycle !== 'idle' && lifecycle !== 'ready-to-start') {
      return 'Sensing is busy. Wait for the current step to finish.';
    }
    if (cameraId === '') return 'Choose a camera first.';
    const problem =
      apiKey === null
        ? { kind: 'no-api-key' as const, message: 'Enter a Presage API key for this session.' }
        : permissionProblem(deps.cameraPermission());
    if (problem === null) return null;
    failure = problem;
    return problem.message;
  }

  async function checkReadiness(cameraId: string): Promise<CommandResult> {
    const problem = preconditions(cameraId);
    if (problem !== null || apiKey === null) {
      publish();
      return { status: 'error', message: problem ?? 'Missing API key.' };
    }
    const token = ++operation;
    const generation = keyGeneration;
    lifecycle = 'checking-readiness';
    failure = null;
    readiness = null;
    publish();
    const work = deps.checkReadiness(apiKey, cameraId).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    pendingWork = work;
    const outcome = await work;
    if (token !== operation) {
      return { status: 'error', message: 'The readiness check was cancelled.' };
    }
    if (!outcome.ok) {
      failure = failureFromThrown(outcome.error, 'The readiness check could not run.');
      lifecycle = 'idle';
      publish();
      return { status: 'error', message: failure.message };
    }
    const { verdict, reason } = outcome.result;
    readiness = { verdict, reason, cameraId };
    readinessKeyGeneration = generation;
    ({ lifecycle, failure } = interpretReadiness(verdict, reason));
    publish();
    return { status: 'ok' };
  }

  /** Callbacks for one session; anything arriving after that session ended is ignored. */
  function sessionCallbacks(id: string): PresageCallbacks {
    const current = () => (active?.id === id ? active : null);
    const endWith = (ending: MappedFailure, reason: string) => {
      if (current() === null) return;
      failure ??= ending;
      void stop(reason);
    };
    return {
      onStatus: (status) => {
        const session = current();
        if (session === null) return;
        session.processingStatus = processingStatusName(status);
        if (session.processingStatus === 'running')
          session.measurement.processingStarted(deps.now());
        if (session.processingStatus === 'error') endWith(PIPELINE_ERROR, 'pipeline-error');
        if (session.processingStatus === 'idle' && lifecycle === 'running') {
          endWith(PIPELINE_ERROR, 'pipeline-ended');
        }
      },
      onValidation: (code, hint) => current()?.measurement.validation(code, hint, deps.now()),
      onMetrics: (buffer) => current()?.measurement.packet(buffer, deps.now()),
      onError: (code) => {
        endWith(mapSdkError(code), 'sdk-error');
      },
      onInsight: () => {
        const session = current();
        if (session !== null) session.insightEvents += 1;
        endWith(UNEXPECTED_INSIGHT, 'unexpected-insight');
      },
      onFrame: (frame) => {
        const session = current();
        const now = deps.now();
        if (session?.previewEnabled !== true || now - session.lastPreviewAtMs < TICK_MS) return;
        session.lastPreviewAtMs = now;
        const encoded = deps.encodePreview(frame);
        if (encoded !== null) deps.sendPreview({ sessionId: id, ...encoded });
      },
    };
  }

  async function start(cameraId: string): Promise<CommandResult> {
    const problem = preconditions(cameraId);
    if (problem !== null || apiKey === null) {
      publish();
      return { status: 'error', message: problem ?? 'Missing API key.' };
    }
    const checked =
      readiness !== null &&
      readiness.cameraId === cameraId &&
      readinessKeyGeneration === keyGeneration;
    if (!checked || (readiness?.verdict !== 'ready' && readiness?.verdict !== 'limited')) {
      return { status: 'error', message: 'Run the readiness check for this camera first.' };
    }
    const token = ++operation;
    const id = deps.newSessionId();
    lifecycle = 'starting';
    if (failure?.kind !== 'readiness-limited') failure = null;
    active = {
      id,
      cameraId,
      session: null,
      measurement: createMeasurementSession(id, deps.emit),
      processingStatus: 'uninitialized',
      insightEvents: 0,
      previewEnabled: false,
      lastPreviewAtMs: 0,
      stopTimer: deps.startTimer(() => {
        active?.measurement.tick(deps.now());
        publish();
      }, TICK_MS),
    };
    publish();
    try {
      const opened = deps.openSession(apiKey, cameraId, sessionCallbacks(id));
      pendingWork = opened;
      const session = await opened;
      if (token !== operation || active?.id !== id) {
        await session.shutdown();
        return { status: 'error', message: 'Sensing was stopped before it started.' };
      }
      active.session = session;
      session.start();
      lifecycle = 'running';
      publish();
      return { status: 'ok' };
    } catch (error) {
      failure = failureFromThrown(error, 'The Presage SDK could not start.');
      if (active?.id === id) await stop('start-failed');
      return { status: 'error', message: failure.message };
    }
  }

  async function release(reason: string): Promise<void> {
    operation += 1;
    const ending = active;
    active = null;
    lifecycle = ending === null && lifecycle !== 'checking-readiness' ? 'idle' : 'stopping';
    publish();
    if (ending !== null) {
      ending.stopTimer();
      await ending.session?.shutdown();
      deps.emit({ kind: 'session-ended', sessionId: ending.id, reason });
    }
    await pendingWork.catch(() => undefined);
    lifecycle = 'idle';
    publish();
  }

  /** Releases capture and discards all session measurements. Never restarts anything. */
  function stop(reason: string): Promise<void> {
    stopping ??= release(reason).finally(() => {
      stopping = null;
    });
    return stopping;
  }

  return {
    snapshot,
    checkReadiness,
    start,
    stop,
    hasApiKey: () => apiKey !== null,
    setApiKey(key: string) {
      apiKey = key;
      keyGeneration += 1;
      readiness = null;
      if (lifecycle === 'ready-to-start') lifecycle = 'idle';
      if (failure?.kind === 'no-api-key' || failure?.kind === 'invalid-key') failure = null;
      publish();
    },
    async clearApiKey() {
      await stop('api-key-cleared');
      apiKey = null;
      keyGeneration += 1;
      readiness = null;
      publish();
    },
    recalibrate(): CommandResult {
      if (active === null || lifecycle !== 'running') return NOT_RUNNING;
      active.measurement.recalibrate(deps.now());
      publish();
      return { status: 'ok' };
    },
    setPreview(enabled: boolean): CommandResult {
      if (active === null) return NOT_RUNNING;
      active.previewEnabled = enabled;
      return { status: 'ok' };
    },
    async interrupt(kind: SensingFailureKind, message: string) {
      if (active === null && lifecycle !== 'checking-readiness') return;
      failure = { kind, message };
      await stop(kind);
    },
  };
}

export type SensingService = ReturnType<typeof createSensingService>;
