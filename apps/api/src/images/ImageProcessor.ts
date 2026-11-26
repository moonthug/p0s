import sharp from 'sharp';

import type { ImageMode } from '@p0s/shared';

import { ImageTooLongError } from './ImageTooLongError';

export type ImageOptions = {
  mode: ImageMode;
  /** Printed width as a percentage of the paper width */
  widthPercent: number;
  rotate: 0 | 90 | 180 | 270;
  /** Skip the length guard */
  force: boolean;
};

export type ProcessedImage = {
  /** Greyscale PNG at print resolution; ReceiptLine turns it black and white */
  png: Buffer;
  height: number;
  mode: Exclude<ImageMode, 'auto'>;
  lengthCm: number;
  tooLong: boolean;
};

/** Printable width of the TM-T20II: 576 dots across 72 mm. */
const PAPER_DOTS = 576;
const DOTS_PER_CM = 80;
/** Above this, an image is rejected unless forced (~25 cm of paper). */
const MAX_DOTS = 2000;
/** Greyscale entropy above which an image is treated as a photo rather than line art. */
const PHOTO_ENTROPY = 5;

/** Prepares an uploaded image for the printer: orient, flatten, greyscale, fit to the paper. */
export class ImageProcessor {
  async process(input: Buffer, options: ImageOptions): Promise<ProcessedImage> {
    const width = Math.round((PAPER_DOTS * options.widthPercent) / 100);

    const pipeline = sharp(input)
      .autoOrient()
      .rotate(options.rotate)
      .flatten({ background: '#ffffff' })
      .greyscale()
      .normalise()
      .resize({ width, withoutEnlargement: true });

    const { data, info } = await pipeline.png().toBuffer({ resolveWithObject: true });

    const lengthCm = info.height / DOTS_PER_CM;
    const tooLong = info.height > MAX_DOTS;

    if (tooLong && !options.force) {
      throw new ImageTooLongError(lengthCm);
    }

    return { png: data, height: info.height, mode: await this.resolveMode(data, options.mode), lengthCm, tooLong };
  }

  /** Photos have a wide spread of greys; logos, screenshots and QR codes have few. */
  private async resolveMode(png: Buffer, mode: ImageMode): Promise<ProcessedImage['mode']> {
    if (mode !== 'auto') {
      return mode;
    }

    const { entropy } = await sharp(png).stats();

    return entropy > PHOTO_ENTROPY ? 'photo' : 'line';
  }
}
