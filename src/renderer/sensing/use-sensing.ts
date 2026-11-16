import { useEffect, useRef, useState } from 'react';
import type { SensingEvent, SensingSnapshot } from '../../shared/sensing-types';
import { bridge } from '../bridge';

/**
 * Subscribe to main-process sensing. Snapshots arrive at most 4 Hz; raw frames
 * and per-packet data never enter React state.
 */
export function useSensing(onEvent: (event: SensingEvent) => void): SensingSnapshot | null {
  const [snapshot, setSnapshot] = useState<SensingSnapshot | null>(null);
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);
  useEffect(() => {
    const api = bridge();
    const offSnapshot = api.onSnapshot(setSnapshot);
    const offEvent = api.onSensingEvent((event) => {
      handler.current(event);
    });
    return () => {
      offSnapshot();
      offEvent();
    };
  }, []);
  return snapshot;
}

/** Sensing is consuming the camera or about to. */
export function captureActive(snapshot: SensingSnapshot | null): boolean {
  return (
    snapshot !== null &&
    (snapshot.lifecycle === 'starting' ||
      snapshot.lifecycle === 'running' ||
      snapshot.lifecycle === 'checking-readiness' ||
      snapshot.lifecycle === 'stopping')
  );
}

export function sensingSummary(snapshot: SensingSnapshot | null): string {
  if (snapshot === null) return 'Sensing off';
  switch (snapshot.lifecycle) {
    case 'idle':
    case 'ready-to-start':
      return 'Sensing off';
    case 'checking-readiness':
      return 'Checking camera readiness';
    case 'starting':
      return 'Starting sensing';
    case 'stopping':
      return 'Stopping sensing';
    case 'running':
      break;
  }
  switch (snapshot.quality) {
    case 'warming-up':
      return 'Sensing: warming up';
    case 'usable':
      return snapshot.rule.kind === 'awaiting-baseline' ? 'Sensing: calibrating' : 'Sensing: on';
    case 'awaiting-data':
      return 'Sensing: waiting for a reading';
    case 'unusable':
    case 'stale':
      return 'Sensing: reading unavailable';
  }
}
