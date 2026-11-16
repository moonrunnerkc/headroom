import { describe, expect, it } from 'vitest';
import {
  initialPresentation,
  reducePresentation,
  type PresentationAction,
  type PresentationEvent,
  type PresentationState,
} from '../../src/domain/presentation-controller';

function apply(state: PresentationState, ...actions: PresentationAction[]) {
  const events: PresentationEvent[] = [];
  let current = state;
  for (const action of actions) {
    const result = reducePresentation(current, action);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

const suggest = () =>
  apply(initialPresentation('standard', 'suggest', true), { type: 'signal-usable', usable: true })
    .state;
const trigger = (id = 't1'): PresentationAction => ({
  type: 'sensor-trigger',
  triggerId: id,
  atMs: 1_000,
});

describe('manual mode', () => {
  it('works with no sensing and ignores sensor triggers', () => {
    const { state, events } = apply(
      initialPresentation('standard', 'manual', false),
      { type: 'choose-layout', layout: 'focused' },
      { type: 'signal-usable', usable: true },
      trigger(),
    );
    expect(state.layout).toBe('focused');
    expect(state.pending).toBeNull();
    expect(events).toContainEqual({ kind: 'trigger-ignored', reason: 'manual-mode' });
  });
});

describe('suggest mode', () => {
  it('changes nothing until the suggestion is accepted', () => {
    const offered = apply(suggest(), trigger());
    expect(offered.state.layout).toBe('standard');
    expect(offered.state.pending).toMatchObject({ kind: 'suggestion', triggerId: 't1' });
    const accepted = apply(offered.state, { type: 'accept-suggestion' });
    expect(accepted.state.layout).toBe('focused');
    expect(accepted.state.layoutCause).toBe('accepted-suggestion');
    expect(accepted.state.sensorChange).toEqual({ triggerId: 't1', previous: 'standard' });
  });

  it('never stacks a duplicate pending suggestion', () => {
    const { state, events } = apply(suggest(), trigger('t1'), trigger('t2'));
    expect(state.pending).toMatchObject({ triggerId: 't1' });
    expect(events).toContainEqual({ kind: 'trigger-ignored', reason: 'pending-exists' });
  });

  it('expires an unaccepted suggestion when the signal stops being usable', () => {
    const { state, events } = apply(
      suggest(),
      trigger(),
      { type: 'signal-usable', usable: false },
      { type: 'accept-suggestion' },
    );
    expect(state.pending).toBeNull();
    expect(state.layout).toBe('standard');
    expect(events).toContainEqual({ kind: 'suggestion-expired', reason: 'signal-not-usable' });
  });

  it('ignores triggers while the signal is unusable, muted, or already focused', () => {
    const unusable = apply(initialPresentation('standard', 'suggest', true), trigger());
    expect(unusable.events).toContainEqual({
      kind: 'trigger-ignored',
      reason: 'signal-not-usable',
    });
    const muted = apply(suggest(), { type: 'set-sensor-muted', muted: true }, trigger());
    expect(muted.events).toContainEqual({ kind: 'trigger-ignored', reason: 'muted' });
    const focused = apply(suggest(), { type: 'choose-layout', layout: 'focused' }, trigger());
    expect(focused.events).toContainEqual({ kind: 'trigger-ignored', reason: 'already-focused' });
  });

  it('lets a direct layout choice override and clear a pending suggestion', () => {
    const { state, events } = apply(suggest(), trigger(), {
      type: 'choose-layout',
      layout: 'standard',
    });
    expect(state.pending).toBeNull();
    expect(events).toContainEqual({ kind: 'suggestion-expired', reason: 'user-choice' });
  });

  it('keeps the chosen layout when sensing ends', () => {
    const { state } = apply(
      suggest(),
      trigger(),
      { type: 'accept-suggestion' },
      { type: 'sensing-ended' },
    );
    expect(state.layout).toBe('focused');
    expect(state.signalUsable).toBe(false);
  });
});

describe('automatic mode', () => {
  it('cannot be selected without separate consent or with unvalidated gates', () => {
    const noConsent = apply(suggest(), { type: 'set-mode', mode: 'automatic' });
    expect(noConsent.state.mode).toBe('suggest');
    const unvalidated = apply(
      initialPresentation('standard', 'suggest', false),
      { type: 'grant-automatic' },
      { type: 'set-mode', mode: 'automatic' },
    );
    expect(unvalidated.state.automaticConsent).toBe(false);
    expect(unvalidated.state.mode).toBe('suggest');
  });

  const automatic = () =>
    apply(suggest(), { type: 'grant-automatic' }, { type: 'set-mode', mode: 'automatic' }).state;

  it('waits for a safe boundary before applying, then shows reason and undo', () => {
    const waiting = apply(automatic(), trigger());
    expect(waiting.state.layout).toBe('standard');
    expect(waiting.state.pending?.kind).toBe('awaiting-safe-boundary');
    const applied = apply(waiting.state, { type: 'safe-boundary' });
    expect(applied.state.layout).toBe('focused');
    expect(applied.state.layoutCause).toBe('automatic');
    expect(applied.state.sensorChange).not.toBeNull();
  });

  it('undoing an automatic change restores the layout and mutes sensor changes for the session', () => {
    const { state, events } = apply(
      automatic(),
      trigger(),
      { type: 'safe-boundary' },
      { type: 'undo-sensor-change' },
    );
    expect(state.layout).toBe('standard');
    expect(state.sensorMuted).toBe(true);
    expect(events).toContainEqual({ kind: 'sensor-muted', muted: true });
    const again = apply(state, { type: 'signal-usable', usable: true }, trigger('t2'));
    expect(again.state.layout).toBe('standard');
    expect(again.events).toContainEqual({ kind: 'trigger-ignored', reason: 'muted' });
  });

  it('safe boundary does nothing without a waiting change', () => {
    const { state } = apply(automatic(), { type: 'safe-boundary' });
    expect(state.layout).toBe('standard');
  });

  it('revoking consent cancels a waiting change and returns to suggest mode', () => {
    const { state } = apply(
      automatic(),
      trigger(),
      { type: 'revoke-automatic' },
      { type: 'safe-boundary' },
    );
    expect(state.layout).toBe('standard');
    expect(state.mode).toBe('suggest');
    expect(state.pending).toBeNull();
  });

  describe('leaving automatic mode', () => {
    it('cancels a change still waiting for a safe boundary', () => {
      const waiting = apply(
        suggest(),
        { type: 'grant-automatic' },
        { type: 'set-mode', mode: 'automatic' },
        trigger(),
      ).state;
      expect(waiting.pending?.kind).toBe('awaiting-safe-boundary');
      const { state, events } = apply(
        waiting,
        { type: 'set-mode', mode: 'suggest' },
        { type: 'safe-boundary' },
      );
      expect(state.pending).toBeNull();
      expect(state.layout).toBe('standard');
      expect(events).toContainEqual({ kind: 'suggestion-expired', reason: 'user-choice' });
    });
  });
});
