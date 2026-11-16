import { PixelFormat } from '@smartspectra/node-sdk';
import type { RawFrame } from './presage-session';

const PREVIEW_WIDTH = 320;

const CHANNEL_LAYOUT = new Map<number, { bytes: number; red: number; blue: number }>([
  [PixelFormat.kRGB, { bytes: 3, red: 0, blue: 2 }],
  [PixelFormat.kBGR, { bytes: 3, red: 2, blue: 0 }],
  [PixelFormat.kRGBA, { bytes: 4, red: 0, blue: 2 }],
  [PixelFormat.kBGRA, { bytes: 4, red: 2, blue: 0 }],
]);

export interface BgraImage {
  readonly data: Buffer;
  readonly width: number;
  readonly height: number;
}

/**
 * Nearest-neighbour downscale to a small opaque BGRA image for the framing
 * preview. Returns null for pixel formats this preview does not support
 * (for example NV12), so the UI can say the preview is unavailable.
 */
export function downscaleToBgra(frame: RawFrame, targetWidth = PREVIEW_WIDTH): BgraImage | null {
  const layout = CHANNEL_LAYOUT.get(frame.pixelFormat);
  if (layout === undefined || frame.width <= 0 || frame.height <= 0) return null;
  if (
    frame.stride < frame.width * layout.bytes ||
    frame.buffer.byteLength < frame.stride * frame.height
  ) {
    return null;
  }
  const width = Math.min(targetWidth, frame.width);
  const height = Math.max(1, Math.round((frame.height * width) / frame.width));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceRow =
      Math.min(frame.height - 1, Math.floor((y * frame.height) / height)) * frame.stride;
    for (let x = 0; x < width; x++) {
      const source =
        sourceRow + Math.min(frame.width - 1, Math.floor((x * frame.width) / width)) * layout.bytes;
      const target = (y * width + x) * 4;
      data[target] = frame.buffer[source + layout.blue] ?? 0;
      data[target + 1] = frame.buffer[source + 1] ?? 0;
      data[target + 2] = frame.buffer[source + layout.red] ?? 0;
      data[target + 3] = 255;
    }
  }
  return { data, width, height };
}
