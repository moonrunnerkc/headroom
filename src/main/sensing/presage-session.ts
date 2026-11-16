import {
  CameraSelection,
  MetricType,
  SmartSpectraLogLevel,
  SmartSpectraSDK,
  type DeviceReadinessResult,
  type ProcessingStatusValue,
  type SmartSpectraOptions,
} from '@smartspectra/node-sdk';

export interface RawFrame {
  readonly buffer: Buffer;
  readonly width: number;
  readonly height: number;
  readonly stride: number;
  readonly pixelFormat: number;
}

export interface PresageCallbacks {
  onStatus(status: ProcessingStatusValue): void;
  onValidation(code: number, hint: string): void;
  onMetrics(buffer: Buffer): void;
  onError(code: number): void;
  onInsight(): void;
  onFrame(frame: RawFrame): void;
}

export interface PresageSession {
  start(): void;
  /** Stops capture, waits for the pipeline to drain, and releases the native session. */
  shutdown(): Promise<void>;
}

const CAPTURE = { width: 1280, height: 720, fps: 30 } as const;

/**
 * Pulse only. Breathing is deliberately not requested: Presage documents that
 * auto-fired LLM Insights require breathing and cardio together, and Headroom
 * must not send vitals to that service. Telemetry is disabled before any
 * readiness check or measurement.
 */
function sdkOptions(apiKey: string): SmartSpectraOptions {
  return {
    apiKey,
    requestedMetrics: [MetricType.PULSE_RATE],
    enableTelemetry: false,
    enableAccumulatedOutput: false,
    logLevel: SmartSpectraLogLevel.kError,
  };
}

// Native SDK state is process-global: a new instance must never start before
// the previous one has finished tearing down.
let teardownBarrier: Promise<void> = Promise.resolve();

function retire(sdk: SmartSpectraSDK, stopFirst: boolean): Promise<void> {
  const done = (stopFirst ? sdk.stopAsync() : Promise.resolve()).finally(() => sdk.destroy());
  teardownBarrier = teardownBarrier.then(
    () => done,
    () => done,
  );
  return done;
}

export function awaitSdkIdle(): Promise<void> {
  return teardownBarrier.catch(() => undefined);
}

export function sdkVersion(): string {
  return SmartSpectraSDK.version;
}

export function discoverCameras(): { id: string; name: string }[] {
  return SmartSpectraSDK.availableCameras().map((camera) => ({
    id: camera.id,
    name: camera.name ?? 'Unnamed camera',
  }));
}

/** Runs the SDK's documented readiness check for the exact configuration used for measurement. */
export async function checkReadiness(
  apiKey: string,
  cameraId: string,
): Promise<DeviceReadinessResult> {
  await awaitSdkIdle();
  const sdk = new SmartSpectraSDK(sdkOptions(apiKey));
  sdk.useCamera(CameraSelection.byId(cameraId), CAPTURE);
  try {
    return await sdk.checkDeviceReadiness();
  } finally {
    await retire(sdk, false);
  }
}

export async function openPresageSession(
  apiKey: string,
  cameraId: string,
  callbacks: PresageCallbacks,
): Promise<PresageSession> {
  await awaitSdkIdle();
  const sdk = new SmartSpectraSDK(sdkOptions(apiKey));
  sdk
    .on('processingStatus', (status) => {
      callbacks.onStatus(status);
    })
    .on('validationStatus', (code, _timestampUs, hint) => {
      callbacks.onValidation(code, hint);
    })
    .on('metrics', (buffer) => {
      callbacks.onMetrics(buffer);
    })
    .on('error', (code) => {
      callbacks.onError(code);
    })
    // Insight payloads are never read; any arrival is treated as a policy violation by the owner.
    .on('insight', () => {
      callbacks.onInsight();
    })
    .on('videoOutput', (buffer, width, height, stride, pixelFormat) => {
      callbacks.onFrame({ buffer, width, height, stride, pixelFormat });
    });
  sdk.useCamera(CameraSelection.byId(cameraId), CAPTURE);
  let shutdownPromise: Promise<void> | null = null;
  return {
    start: () => {
      sdk.start();
    },
    shutdown: () => {
      shutdownPromise ??= retire(sdk, true);
      return shutdownPromise;
    },
  };
}
