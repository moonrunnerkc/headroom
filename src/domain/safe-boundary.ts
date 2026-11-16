export interface InteractionState {
  readonly composing: boolean;
  readonly pointerDown: boolean;
  /** Whether the pointer currently rests over workspace content that a layout change would move. */
  readonly pointerOverContent: boolean;
  readonly lastKeyAtMs: number;
}

/** Keyboard quiet period before an automatic change may apply; typing is never interrupted. */
const KEYBOARD_QUIET_MS = 3_000;

/**
 * A layout change may be applied automatically only when it cannot interrupt
 * typing or IME composition, a press in progress, or move content under the
 * pointer. Otherwise the change waits.
 */
export function isSafeBoundary(state: InteractionState, nowMs: number): boolean {
  return (
    !state.composing &&
    !state.pointerDown &&
    !state.pointerOverContent &&
    nowMs - state.lastKeyAtMs >= KEYBOARD_QUIET_MS
  );
}
