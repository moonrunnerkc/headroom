export type Layout = 'standard' | 'focused';
export type PolicyMode = 'manual' | 'suggest' | 'automatic';
type LayoutCause = 'user' | 'accepted-suggestion' | 'automatic';

type PendingSensorChange =
  | { readonly kind: 'suggestion'; readonly triggerId: string; readonly sinceMs: number }
  | {
      readonly kind: 'awaiting-safe-boundary';
      readonly triggerId: string;
      readonly sinceMs: number;
    };

export interface PresentationState {
  readonly layout: Layout;
  readonly layoutCause: LayoutCause;
  readonly mode: PolicyMode;
  /** Separate, session-only permission for sensor-applied changes. */
  readonly automaticConsent: boolean;
  /** Whether the sensing gates for automatic changes have been validated on a device. */
  readonly automaticAvailable: boolean;
  readonly sensorMuted: boolean;
  readonly signalUsable: boolean;
  readonly pending: PendingSensorChange | null;
  /** Present while a sensor-caused layout is active, for the visible reason and undo. */
  readonly sensorChange: { readonly triggerId: string; readonly previous: Layout } | null;
}

export type PresentationAction =
  | { readonly type: 'choose-layout'; readonly layout: Layout }
  | { readonly type: 'set-mode'; readonly mode: PolicyMode }
  | { readonly type: 'grant-automatic' }
  | { readonly type: 'revoke-automatic' }
  | { readonly type: 'signal-usable'; readonly usable: boolean }
  | { readonly type: 'sensor-trigger'; readonly triggerId: string; readonly atMs: number }
  | { readonly type: 'accept-suggestion' }
  | { readonly type: 'dismiss-suggestion' }
  | { readonly type: 'set-sensor-muted'; readonly muted: boolean }
  | { readonly type: 'safe-boundary' }
  | { readonly type: 'undo-sensor-change' }
  | { readonly type: 'sensing-ended' };

export type PresentationEvent =
  | {
      readonly kind: 'layout-changed';
      readonly layout: Layout;
      readonly cause: LayoutCause | 'undo';
    }
  | { readonly kind: 'mode-changed'; readonly mode: PolicyMode }
  | { readonly kind: 'automatic-consent'; readonly granted: boolean }
  | { readonly kind: 'suggestion-offered' }
  | { readonly kind: 'suggestion-accepted' }
  | { readonly kind: 'suggestion-dismissed' }
  | {
      readonly kind: 'suggestion-expired';
      readonly reason: 'signal-not-usable' | 'sensing-ended' | 'user-choice';
    }
  | { readonly kind: 'automatic-waiting' }
  | { readonly kind: 'sensor-muted'; readonly muted: boolean }
  | { readonly kind: 'trigger-ignored'; readonly reason: TriggerIgnoredReason };

type TriggerIgnoredReason =
  'manual-mode' | 'muted' | 'already-focused' | 'pending-exists' | 'signal-not-usable';

export interface PresentationStep {
  readonly state: PresentationState;
  readonly events: readonly PresentationEvent[];
}

export function initialPresentation(
  layout: Layout,
  mode: Exclude<PolicyMode, 'automatic'>,
  automaticAvailable: boolean,
): PresentationState {
  return {
    layout,
    layoutCause: 'user',
    mode,
    automaticConsent: false,
    automaticAvailable,
    sensorMuted: false,
    signalUsable: false,
    pending: null,
    sensorChange: null,
  };
}

function step(state: PresentationState, ...events: PresentationEvent[]): PresentationStep {
  return { state, events };
}

function expirePending(
  state: PresentationState,
  reason: 'signal-not-usable' | 'sensing-ended' | 'user-choice',
): PresentationStep {
  if (state.pending === null) return step(state);
  return step({ ...state, pending: null }, { kind: 'suggestion-expired', reason });
}

function applySensorLayout(
  state: PresentationState,
  triggerId: string,
  cause: LayoutCause,
): PresentationState {
  return {
    ...state,
    layout: 'focused',
    layoutCause: cause,
    pending: null,
    sensorChange: { triggerId, previous: state.layout },
  };
}

function onTrigger(state: PresentationState, triggerId: string, atMs: number): PresentationStep {
  const ignored = (reason: TriggerIgnoredReason) =>
    step(state, { kind: 'trigger-ignored', reason });
  if (state.mode === 'manual') return ignored('manual-mode');
  if (state.sensorMuted) return ignored('muted');
  if (!state.signalUsable) return ignored('signal-not-usable');
  if (state.pending !== null) return ignored('pending-exists');
  // Sensor rules only ever reduce simultaneous content; they never restore density.
  if (state.layout === 'focused') return ignored('already-focused');
  if (state.mode === 'automatic' && state.automaticConsent && state.automaticAvailable) {
    return step(
      { ...state, pending: { kind: 'awaiting-safe-boundary', triggerId, sinceMs: atMs } },
      { kind: 'automatic-waiting' },
    );
  }
  return step(
    { ...state, pending: { kind: 'suggestion', triggerId, sinceMs: atMs } },
    { kind: 'suggestion-offered' },
  );
}

export function reducePresentation(
  state: PresentationState,
  action: PresentationAction,
): PresentationStep {
  switch (action.type) {
    case 'choose-layout': {
      const expired = expirePending(state, 'user-choice');
      const next = {
        ...expired.state,
        layout: action.layout,
        layoutCause: 'user' as const,
        sensorChange: null,
      };
      if (state.layout === action.layout) return step(next, ...expired.events);
      return step(next, ...expired.events, {
        kind: 'layout-changed',
        layout: action.layout,
        cause: 'user',
      });
    }
    case 'set-mode': {
      if (action.mode === state.mode) return step(state);
      if (action.mode === 'automatic' && !(state.automaticConsent && state.automaticAvailable)) {
        return step(state);
      }
      const expired = action.mode === 'manual' ? expirePending(state, 'user-choice') : step(state);
      return step({ ...expired.state, mode: action.mode }, ...expired.events, {
        kind: 'mode-changed',
        mode: action.mode,
      });
    }
    case 'grant-automatic':
      if (!state.automaticAvailable || state.automaticConsent) return step(state);
      return step(
        { ...state, automaticConsent: true },
        { kind: 'automatic-consent', granted: true },
      );
    case 'revoke-automatic': {
      if (!state.automaticConsent) return step(state);
      const waiting = state.pending?.kind === 'awaiting-safe-boundary';
      const base = { ...state, automaticConsent: false, pending: waiting ? null : state.pending };
      const mode = state.mode === 'automatic' ? 'suggest' : state.mode;
      const events: PresentationEvent[] = [{ kind: 'automatic-consent', granted: false }];
      if (waiting) events.push({ kind: 'suggestion-expired', reason: 'user-choice' });
      if (mode !== state.mode) events.push({ kind: 'mode-changed', mode });
      return step({ ...base, mode }, ...events);
    }
    case 'signal-usable': {
      const next = { ...state, signalUsable: action.usable };
      return action.usable ? step(next) : expirePending(next, 'signal-not-usable');
    }
    case 'sensor-trigger':
      return onTrigger(state, action.triggerId, action.atMs);
    case 'accept-suggestion': {
      if (state.pending?.kind !== 'suggestion') return step(state);
      const next = applySensorLayout(state, state.pending.triggerId, 'accepted-suggestion');
      return step(
        next,
        { kind: 'suggestion-accepted' },
        { kind: 'layout-changed', layout: 'focused', cause: 'accepted-suggestion' },
      );
    }
    case 'dismiss-suggestion':
      if (state.pending === null) return step(state);
      return step({ ...state, pending: null }, { kind: 'suggestion-dismissed' });
    case 'set-sensor-muted': {
      if (state.sensorMuted === action.muted) return step(state);
      const expired = action.muted ? expirePending(state, 'user-choice') : step(state);
      return step({ ...expired.state, sensorMuted: action.muted }, ...expired.events, {
        kind: 'sensor-muted',
        muted: action.muted,
      });
    }
    case 'safe-boundary': {
      if (state.pending?.kind !== 'awaiting-safe-boundary') return step(state);
      const next = applySensorLayout(state, state.pending.triggerId, 'automatic');
      return step(next, { kind: 'layout-changed', layout: 'focused', cause: 'automatic' });
    }
    case 'undo-sensor-change': {
      if (state.sensorChange === null) return step(state);
      const previous = state.sensorChange.previous;
      // Undoing a sensor-applied automatic change mutes further sensor changes for the session.
      const mute = state.layoutCause === 'automatic';
      const next = {
        ...state,
        layout: previous,
        layoutCause: 'user' as const,
        sensorChange: null,
        sensorMuted: state.sensorMuted || mute,
      };
      const events: PresentationEvent[] = [
        { kind: 'layout-changed', layout: previous, cause: 'undo' },
      ];
      if (mute && !state.sensorMuted) events.push({ kind: 'sensor-muted', muted: true });
      return step(next, ...events);
    }
    case 'sensing-ended':
      return expirePending({ ...state, signalUsable: false }, 'sensing-ended');
  }
}
