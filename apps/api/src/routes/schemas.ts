import { z } from 'zod';

import { ImageMode } from '@p0s/shared';

/** A ReceiptLine document. */
export const DocBody = z.object({ doc: z.string().min(1) });

/** Plain text, printed as typed. */
export const TextBody = z.object({ text: z.string().min(1) });

/** Multipart upload for /print/image and /preview/image. Form fields arrive as strings. */
export const ImageForm = z.object({
  image: z.file().describe('PNG, JPEG, WebP, GIF or HEIC'),
  mode: ImageMode.default('auto').describe('auto picks photo (dithered) or line (thresholded)'),
  width: z.coerce.number().int().min(10).max(100).default(100).describe('Printed width, as a percentage of the paper'),
  rotate: z.coerce
    .number()
    .pipe(z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]))
    .default(0),
  force: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type ImageFormValues = z.infer<typeof ImageForm>;

/** Uploads are phone photos at most; the printed result is far smaller. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
