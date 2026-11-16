import {
  ProcessingStatus,
  SmartSpectraErrorCode,
  ValidationCode,
  type ProcessingStatusValue,
} from '@smartspectra/node-sdk';
import type { SensingFailureKind, SensingSnapshot } from '../../shared/sensing-types';

export function processingStatusName(
  status: ProcessingStatusValue,
): SensingSnapshot['processingStatus'] {
  switch (status) {
    case ProcessingStatus.kUninitialized:
      return 'uninitialized';
    case ProcessingStatus.kIdle:
      return 'idle';
    case ProcessingStatus.kStarting:
      return 'starting';
    case ProcessingStatus.kRunning:
      return 'running';
    case ProcessingStatus.kStopping:
      return 'stopping';
    case ProcessingStatus.kError:
      return 'error';
  }
}

const validationNames = new Map<number, string>(
  Object.entries(ValidationCode).map(([name, code]) => [code, name.replace(/^k/, '')]),
);

export function validationName(code: number): string {
  return validationNames.get(code) ?? `Unknown(${code})`;
}

export const VALIDATION_OK: number = ValidationCode.kOk;

export interface MappedFailure {
  readonly kind: SensingFailureKind;
  readonly message: string;
}

/** Translate an SDK error code into a user-actionable category. SDK message text is not shown. */
export function mapSdkError(code: number): MappedFailure {
  switch (code) {
    case SmartSpectraErrorCode.kAuthenticationFailed:
      return {
        kind: 'invalid-key',
        message: 'Presage rejected the API key. Check the key and try again.',
      };
    case SmartSpectraErrorCode.kCreditExhausted:
      return {
        kind: 'credits-exhausted',
        message: 'The Presage account has no remaining credits.',
      };
    case SmartSpectraErrorCode.kMetricNotAuthorized:
      return {
        kind: 'metric-not-authorized',
        message: 'This API key is not authorized for pulse measurement.',
      };
    case SmartSpectraErrorCode.kNetworkError:
    case SmartSpectraErrorCode.kServerError:
      return {
        kind: 'network',
        message: 'Presage authentication could not be reached. Check the network connection.',
      };
    case SmartSpectraErrorCode.kInputUnavailable:
      return {
        kind: 'camera-unavailable',
        message: 'The selected camera is unavailable or in use by another app.',
      };
    case SmartSpectraErrorCode.kSustainedLowFrameRate:
      return {
        kind: 'low-frame-rate',
        message:
          'Measurement stopped because the camera frame rate stayed too low. Improve lighting or close other camera apps, then start again.',
      };
    default:
      return {
        kind: 'sdk-failure',
        message: `The Presage SDK reported an error (code ${code}). Sensing stopped.`,
      };
  }
}

/** Extract the numeric code that SmartSpectra attaches to thrown lifecycle errors. */
export function thrownSdkCode(error: unknown): number | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'number'
  ) {
    return error.code;
  }
  return null;
}
