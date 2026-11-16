import { useEffect, useRef, type RefObject } from 'react';
import { isSafeBoundary, type InteractionState } from '../../domain/safe-boundary';

const CHECK_INTERVAL_MS = 500;

/**
 * While `waiting`, watch keyboard, composition, and pointer activity and call
 * `onSafe` once a safe interaction boundary is reached. Listeners and the
 * timer exist only while waiting.
 */
export function useSafeBoundary(
  waiting: boolean,
  contentRef: RefObject<HTMLElement | null>,
  onSafe: () => void,
): void {
  const onSafeRef = useRef(onSafe);
  useEffect(() => {
    onSafeRef.current = onSafe;
  }, [onSafe]);

  useEffect(() => {
    if (!waiting) return;
    let state: InteractionState = {
      composing: false,
      pointerDown: false,
      pointerOverContent: false,
      lastKeyAtMs: performance.now(),
    };
    const update = (patch: Partial<InteractionState>) => {
      state = { ...state, ...patch };
    };
    const onKey = () => {
      update({ lastKeyAtMs: performance.now() });
    };
    const onCompositionStart = () => {
      update({ composing: true });
    };
    const onCompositionEnd = () => {
      update({ composing: false, lastKeyAtMs: performance.now() });
    };
    const onPointerDown = () => {
      update({ pointerDown: true });
    };
    const onPointerUp = () => {
      update({ pointerDown: false });
    };
    const onPointerMove = (event: PointerEvent) => {
      const content = contentRef.current;
      update({
        pointerOverContent:
          content !== null && event.target instanceof Node && content.contains(event.target),
      });
    };
    const onPointerLeave = () => {
      update({ pointerOverContent: false });
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('compositionstart', onCompositionStart, true);
    document.addEventListener('compositionend', onCompositionEnd, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointermove', onPointerMove, true);
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    const timer = window.setInterval(() => {
      if (isSafeBoundary(state, performance.now())) onSafeRef.current();
    }, CHECK_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('compositionstart', onCompositionStart, true);
      document.removeEventListener('compositionend', onCompositionEnd, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('pointermove', onPointerMove, true);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [waiting, contentRef]);
}
