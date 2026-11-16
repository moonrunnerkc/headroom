import { useCallback, useRef, useState } from 'react';
import {
  initialPresentation,
  reducePresentation,
  type PresentationAction,
  type PresentationEvent,
  type PresentationState,
} from '../../domain/presentation-controller';
import { PULSE_POLICY } from '../../domain/pulse-policy-config';
import type { EvidenceRecorder } from '../evidence-log';

function recordEvent(recorder: EvidenceRecorder, event: PresentationEvent): void {
  switch (event.kind) {
    case 'layout-changed':
      recorder.record('layout-changed', `${event.layout}-${event.cause}`);
      break;
    case 'mode-changed':
      recorder.record('mode-changed', event.mode);
      break;
    case 'automatic-consent':
      recorder.record('automatic-consent', event.granted ? 'granted' : 'revoked');
      break;
    case 'suggestion-expired':
      recorder.record('suggestion-expired', event.reason);
      break;
    case 'sensor-muted':
      recorder.record('sensor-muted', event.muted ? 'muted' : 'unmuted');
      break;
    case 'trigger-ignored':
      recorder.record('trigger-ignored', event.reason);
      break;
    case 'suggestion-offered':
    case 'suggestion-accepted':
    case 'suggestion-dismissed':
    case 'automatic-waiting':
      recorder.record(event.kind);
      break;
  }
}

/** The single presentation controller shared by both workspaces. */
export function usePresentation(
  initialLayout: PresentationState['layout'],
  initialMode: 'manual' | 'suggest',
  recorder: EvidenceRecorder,
) {
  const [state, setState] = useState(() =>
    initialPresentation(
      initialLayout,
      initialMode,
      PULSE_POLICY.gateValidation === 'device-validated',
    ),
  );
  const current = useRef(state);
  const dispatch = useCallback(
    (action: PresentationAction) => {
      const result = reducePresentation(current.current, action);
      current.current = result.state;
      setState(result.state);
      for (const event of result.events) recordEvent(recorder, event);
    },
    [recorder],
  );
  return { presentation: state, dispatch };
}
