import { useEffect, useState } from 'react';
import type { PresentationAction, PresentationState } from '../../domain/presentation-controller';
import type { CameraInfo, CameraPermission, SensingSnapshot } from '../../shared/sensing-types';
import { bridge } from '../bridge';
import { AutomaticConsent } from './automatic-consent';
import { DeveloperView } from './developer-view';
import { FramingPreview } from './framing-preview';
import { SensingExplainer } from './sensing-explainer';
import { SensingProgress } from './sensing-progress';

interface SensingPanelProps {
  readonly snapshot: SensingSnapshot | null;
  readonly consent: boolean;
  readonly onConsent: (consent: boolean) => void;
  readonly presentation: PresentationState;
  readonly dispatch: (action: PresentationAction) => void;
}

const PERMISSION_TEXT: Record<CameraPermission, string> = {
  granted: 'macOS camera access: allowed.',
  denied:
    'macOS camera access: denied. Allow Headroom in System Settings > Privacy & Security > Camera.',
  restricted: 'macOS camera access: restricted by a device policy.',
  'not-determined': 'macOS camera access: not yet requested.',
  unknown: 'macOS camera access: unknown.',
};

export function SensingPanel({
  snapshot,
  consent,
  onConsent,
  presentation,
  dispatch,
}: SensingPanelProps) {
  const [key, setKey] = useState('');
  const [keySet, setKeySet] = useState(false);
  const [cameras, setCameras] = useState<CameraInfo[] | null>(null);
  const [cameraId, setCameraId] = useState('');
  const [permission, setPermission] = useState<CameraPermission>('unknown');
  const [message, setMessage] = useState<string | null>(null);
  const lifecycle = snapshot?.lifecycle ?? 'idle';
  const busy =
    lifecycle === 'checking-readiness' || lifecycle === 'starting' || lifecycle === 'stopping';

  const refreshCameras = () => {
    void bridge()
      .listCameras()
      .then((list) => {
        if (list.status === 'ok') {
          setCameras(list.cameras);
          setCameraId((current) =>
            list.cameras.some((c) => c.id === current) ? current : (list.cameras[0]?.id ?? ''),
          );
        } else setMessage(list.reason);
      });
  };
  useEffect(() => {
    // Checking permission status and listing devices does not open the camera.
    void bridge().cameraPermission(false).then(setPermission);
    void bridge()
      .appInfo()
      .then((info) => {
        setKeySet(info.apiKeyPresent);
      });
  }, []);
  useEffect(() => {
    if (consent && cameras === null) refreshCameras();
  }, [consent, cameras]);

  const run = (action: () => Promise<{ status: 'ok' } | { status: 'error'; message: string }>) => {
    setMessage(null);
    void action().then((result) => {
      if (result.status === 'error') setMessage(result.message);
    });
  };

  return (
    <section className="panel sensing-panel" aria-labelledby="sensing-heading">
      <h2 id="sensing-heading">Camera sensing (optional)</h2>
      <SensingExplainer />
      {snapshot !== null && snapshot.failure !== null && (
        <div className="alert" role="alert" data-kind={snapshot.failure.kind}>
          <p>{snapshot.failure.message}</p>
        </div>
      )}
      {message !== null && (
        <p className="alert" role="alert">
          {message}
        </p>
      )}
      <label className="choice">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            onConsent(event.currentTarget.checked);
          }}
        />
        I choose to let Headroom use my camera for pulse readings during this session.
      </label>
      <fieldset disabled={!consent || busy}>
        <legend>Set up</legend>
        <form
          className="field"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              const result = await bridge().setApiKey(key);
              setKey('');
              if (result.status === 'ok') setKeySet(true);
              return result;
            });
          }}
        >
          <label htmlFor="presage-key">
            Presage API key (kept in memory for this session only)
          </label>
          <div className="toolbar">
            <input
              id="presage-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(event) => {
                setKey(event.currentTarget.value);
              }}
            />
            <button type="submit" disabled={key.trim() === ''}>
              Use key for this session
            </button>
            {keySet && (
              <button
                type="button"
                onClick={() => {
                  run(async () => {
                    const r = await bridge().clearApiKey();
                    setKeySet(false);
                    return r;
                  });
                }}
              >
                Forget key
              </button>
            )}
          </div>
          <p className="muted">{keySet ? 'A key is set for this session.' : 'No key is set.'}</p>
        </form>
        <div className="toolbar">
          <label className="inline-label">
            Camera
            <select
              value={cameraId}
              onChange={(event) => {
                setCameraId(event.currentTarget.value);
              }}
            >
              {(cameras ?? []).map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={refreshCameras}>
            Refresh cameras
          </button>
        </div>
        <p className="muted">{PERMISSION_TEXT[permission]}</p>
        {permission !== 'granted' && (
          <button
            type="button"
            onClick={() => {
              void bridge().cameraPermission(true).then(setPermission);
            }}
          >
            Ask macOS for camera access
          </button>
        )}
        <div className="toolbar">
          <button
            type="button"
            disabled={
              !keySet || cameraId === '' || permission !== 'granted' || lifecycle === 'running'
            }
            onClick={() => {
              run(() => bridge().checkReadiness(cameraId));
            }}
          >
            Check readiness
          </button>
          <button
            type="button"
            className="primary"
            disabled={lifecycle !== 'ready-to-start' || snapshot?.readiness?.cameraId !== cameraId}
            onClick={() => {
              run(() => bridge().startSensing(cameraId));
            }}
          >
            Start sensing
          </button>
        </div>
        <p className="muted">
          The readiness check uses the camera for up to about 40 seconds to confirm this Mac can
          measure reliably. It records nothing. The SDK cannot cancel a check once it starts, so
          Stop takes effect when the check ends.
        </p>
        {snapshot !== null && snapshot.readiness !== null && (
          <p role="status">
            Readiness: {snapshot.readiness.verdict}. {snapshot.readiness.reason}
          </p>
        )}
      </fieldset>
      {snapshot !== null && lifecycle === 'running' && (
        <>
          <SensingProgress snapshot={snapshot} />
          {snapshot.sessionId !== null && <FramingPreview sessionId={snapshot.sessionId} />}
          <div className="toolbar">
            <button
              type="button"
              onClick={() => {
                run(() => bridge().recalibrate());
              }}
            >
              Recalibrate
            </button>
            <button
              type="button"
              className="stop"
              onClick={() => {
                run(() => bridge().stopSensing());
              }}
            >
              Stop sensing
            </button>
          </div>
        </>
      )}
      <AutomaticConsent presentation={presentation} dispatch={dispatch} />
      {snapshot !== null && <DeveloperView snapshot={snapshot} />}
    </section>
  );
}
