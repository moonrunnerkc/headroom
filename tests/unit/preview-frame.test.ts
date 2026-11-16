import { PixelFormat } from '@smartspectra/node-sdk';
import { describe, expect, it } from 'vitest';
import { downscaleToBgra } from '../../src/main/sensing/preview-frame';

function solid(width: number, height: number, pixel: number[], stridePadding = 0) {
  const stride = width * pixel.length + stridePadding;
  const buffer = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) buffer.set(pixel, y * stride + x * pixel.length);
  }
  return { buffer, width, height, stride };
}

describe('downscaleToBgra', () => {
  it('converts RGB to opaque BGRA and preserves aspect ratio', () => {
    const image = downscaleToBgra({
      ...solid(640, 360, [10, 20, 30], 8),
      pixelFormat: PixelFormat.kRGB,
    });
    expect(image?.width).toBe(320);
    expect(image?.height).toBe(180);
    expect([...(image?.data.subarray(0, 4) ?? [])]).toEqual([30, 20, 10, 255]);
  });

  it('keeps BGRA channel order', () => {
    const image = downscaleToBgra({ ...solid(4, 2, [1, 2, 3, 4]), pixelFormat: PixelFormat.kBGRA });
    expect([...(image?.data.subarray(0, 4) ?? [])]).toEqual([1, 2, 3, 255]);
  });

  it('rejects unsupported formats and truncated buffers', () => {
    expect(
      downscaleToBgra({ ...solid(4, 2, [1, 2, 3]), pixelFormat: PixelFormat.kNV12 }),
    ).toBeNull();
    const frame = solid(4, 2, [1, 2, 3]);
    expect(
      downscaleToBgra({
        ...frame,
        buffer: frame.buffer.subarray(0, 5),
        pixelFormat: PixelFormat.kRGB,
      }),
    ).toBeNull();
  });
});
