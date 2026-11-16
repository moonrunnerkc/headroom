import type { MeasurementSession } from './measurement-session';
import type { PresageCallbacks, PresageSession } from './presage-session';
import { mapSdkError, processingStatusName, type MappedFailure } from './sdk-codes';
import { PIPELINE_ERROR, UNEXPECTED_INSIGHT } from './sensing-interpretation';
import type { SensingDeps } from './sensing-service';
import type { SensingSnapshot } from '../../shared/sensing-types';

/** UI updates, preview frames, and the silence watchdog are all limited to 4 Hz. */
export const TICK_MS = 250;

/** Mutable record for the one capture session that is currently allowed to deliver data. */
export interface ActiveSession {
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

interface RouteContext {
  /** The session, or null once it is no longer the active one. */
  readonly current: () => ActiveSession | null;
  readonly running: () => boolean;
  readonly end: (failure: MappedFailure, reason: string) => void;
  readonly deps: Pick<SensingDeps, 'now' | 'encodePreview' | 'sendPreview'>;
}

/** Translate SDK callbacks for one session; anything arriving after that session ended is ignored. */
export function routeSessionCallbacks(id: string, context: RouteContext): PresageCallbacks {
  const { current, deps } = context;
  const endWith = (failure: MappedFailure, reason: string) => {
    if (current() !== null) context.end(failure, reason);
  };
  return {
    onStatus: (status) => {
      const session = current();
      if (session === null) return;
      session.processingStatus = processingStatusName(status);
      if (session.processingStatus === 'running') session.measurement.processingStarted(deps.now());
      if (session.processingStatus === 'error') endWith(PIPELINE_ERROR, 'pipeline-error');
      if (session.processingStatus === 'idle' && context.running())
        endWith(PIPELINE_ERROR, 'pipeline-ended');
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
