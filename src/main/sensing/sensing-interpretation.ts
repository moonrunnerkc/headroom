import type {
  CameraPermission,
  SensingFailureKind,
  SensingSnapshot,
} from '../../shared/sensing-types';
import { mapSdkError, thrownSdkCode, type MappedFailure } from './sdk-codes';

export type ReadinessVerdict = 'ready' | 'limited' | 'blocked' | 'inconclusive';

/** Why capture may not begin under the current macOS camera permission, or null if it may. */
export function permissionProblem(permission: CameraPermission): MappedFailure | null {
  switch (permission) {
    case 'granted':
      return null;
    case 'denied':
      return {
        kind: 'permission-denied',
        message:
          'macOS camera access is denied for Headroom. Allow it in System Settings > Privacy & Security > Camera, then try again.',
      };
    case 'restricted':
      return {
        kind: 'permission-restricted',
        message: 'Camera access is restricted on this Mac by a device policy.',
      };
    case 'not-determined':
    case 'unknown':
      return {
        kind: 'permission-denied',
        message: 'macOS has not granted camera access yet. Use "Allow camera" first.',
      };
  }
}

export interface ReadinessInterpretation {
  readonly lifecycle: Extract<SensingSnapshot['lifecycle'], 'idle' | 'ready-to-start'>;
  readonly failure: { readonly kind: SensingFailureKind; readonly message: string } | null;
}

/**
 * Interpret a readiness verdict explicitly. Every verdict string is truthy,
 * including 'blocked', so truthiness is never used as readiness.
 */
export function interpretReadiness(
  verdict: ReadinessVerdict,
  reason: string,
): ReadinessInterpretation {
  switch (verdict) {
    case 'ready':
      return { lifecycle: 'ready-to-start', failure: null };
    case 'limited':
      return {
        lifecycle: 'ready-to-start',
        failure: {
          kind: 'readiness-limited',
          message:
            'This Mac is below Presage performance requirements right now. Measurement may stop; close other demanding apps to improve it.',
        },
      };
    case 'blocked':
      return { lifecycle: 'idle', failure: { kind: 'readiness-blocked', message: reason } };
    case 'inconclusive':
      return { lifecycle: 'idle', failure: { kind: 'readiness-inconclusive', message: reason } };
  }
}

export function failureFromThrown(error: unknown, fallback: string): MappedFailure {
  const code = thrownSdkCode(error);
  return code === null ? { kind: 'sdk-failure', message: fallback } : mapSdkError(code);
}

export const PIPELINE_ERROR: MappedFailure = {
  kind: 'sdk-failure',
  message: 'The Presage pipeline stopped unexpectedly. Start again when ready.',
};
export const UNEXPECTED_INSIGHT: MappedFailure = {
  kind: 'sdk-failure',
  message:
    'The Presage SDK produced an LLM insight, which Headroom does not allow. Sensing stopped.',
};
