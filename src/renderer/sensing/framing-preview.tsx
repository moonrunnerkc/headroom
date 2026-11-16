import { useEffect, useRef, useState } from 'react';
import { bridge } from '../bridge';

/**
 * Low-rate framing preview (at most 4 frames per second, 320 px wide) taken
 * from the frames the SDK processes. Frames bypass React state and are never
 * stored; each object URL is revoked when replaced or on unmount.
 */
export function FramingPreview({ sessionId }: { readonly sessionId: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [received, setReceived] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    void bridge().setPreview(true);
    const unsubscribe = bridge().onPreview((frame) => {
      if (frame.sessionId !== sessionId || image.current === null) return;
      const next = URL.createObjectURL(
        new Blob([new Uint8Array(frame.jpeg)], { type: 'image/jpeg' }),
      );
      image.current.src = next;
      if (url !== null) URL.revokeObjectURL(url);
      url = next;
      setReceived(true);
    });
    return () => {
      unsubscribe();
      void bridge().setPreview(false);
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [sessionId]);

  return (
    <figure className="framing-preview">
      <img ref={image} alt="Camera framing preview" width={320} height={180} hidden={!received} />
      {!received && <p className="muted">Waiting for preview frames from the SDK…</p>}
      <figcaption className="muted">Preview only. Frames are not saved.</figcaption>
    </figure>
  );
}
