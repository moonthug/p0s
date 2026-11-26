import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ImageProcessor } from '../src/images/ImageProcessor';
import { ImageTooLongError } from '../src/images/ImageTooLongError';

const processor = new ImageProcessor();
const defaults = { mode: 'auto', widthPercent: 100, rotate: 0, force: false } as const;

/** A smooth gradient: many greys, like a photo. */
const gradient = (width: number, height: number) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
    ),
  )
    .png()
    .toBuffer();

/** Black text on white: two colours, like a logo or screenshot. */
const lineArt = (width: number, height: number) =>
  sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><rect x="20" y="20" width="200" height="60" fill="#000"/></svg>`,
    ),
  )
    .png()
    .toBuffer();

const size = async (png: Buffer) => {
  const { width, height } = await sharp(png).metadata();

  return { width, height };
};

describe('ImageProcessor', () => {
  it('scales wide images down to the 576-dot paper width', async () => {
    const result = await processor.process(await gradient(1200, 600), defaults);

    expect(await size(result.png)).toEqual({ width: 576, height: 288 });
  });

  it('never scales small images up', async () => {
    const result = await processor.process(await gradient(300, 100), defaults);

    expect((await size(result.png)).width).toBe(300);
  });

  it('honours a narrower width', async () => {
    const result = await processor.process(await gradient(1200, 600), { ...defaults, widthPercent: 50 });

    expect((await size(result.png)).width).toBe(288);
  });

  it('rotates', async () => {
    const result = await processor.process(await gradient(400, 200), { ...defaults, rotate: 90 });

    expect(await size(result.png)).toEqual({ width: 200, height: 400 });
  });

  it('treats smooth images as photos and flat ones as line art', async () => {
    expect((await processor.process(await gradient(600, 300), defaults)).mode).toBe('photo');
    expect((await processor.process(await lineArt(600, 300), defaults)).mode).toBe('line');
  });

  it('keeps an explicit mode', async () => {
    expect((await processor.process(await gradient(600, 300), { ...defaults, mode: 'line' })).mode).toBe('line');
  });

  it('refuses images longer than about 25 cm unless forced', async () => {
    const tall = await gradient(576, 2400);

    await expect(processor.process(tall, defaults)).rejects.toBeInstanceOf(ImageTooLongError);

    const forced = await processor.process(tall, { ...defaults, force: true });

    expect(forced.tooLong).toBe(true);
    expect(forced.lengthCm).toBeCloseTo(30, 0);
  });
});
