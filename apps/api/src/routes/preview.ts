import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';

import { ImagePreview } from '@p0s/shared';

import type { AppEnv } from '../container';
import { ReceiptRenderer } from '../ReceiptRenderer';
import { jsonResponse, svgResponse, validate } from './openapi';
import { DocBody, ImageForm, MAX_UPLOAD_BYTES, TextBody } from './schemas';

const SVG_HEADERS = { 'content-type': 'image/svg+xml' } as const;

/** POST /preview/* — same inputs as /print, but returns what would be printed instead of printing it. */
export const previewRoutes = new Hono<AppEnv>()
  .post(
    '/',
    describeRoute({
      tags: ['Preview'],
      summary: 'Preview a ReceiptLine document',
      responses: { 200: svgResponse('The receipt as SVG') },
    }),
    validate('json', DocBody),
    (c) => {
      return c.body(c.var.di.get('renderer').toSvg(c.req.valid('json').doc), 200, SVG_HEADERS);
    },
  )

  .post(
    '/text',
    describeRoute({
      tags: ['Preview'],
      summary: 'Preview plain text',
      responses: { 200: svgResponse('The receipt as SVG') },
    }),
    validate('json', TextBody),
    (c) => {
      const doc = ReceiptRenderer.textDocument(c.req.valid('json').text);

      return c.body(c.var.di.get('renderer').toSvg(doc), 200, SVG_HEADERS);
    },
  )

  .post(
    '/image',
    describeRoute({
      tags: ['Preview'],
      summary: 'Preview an image',
      responses: { 200: jsonResponse(ImagePreview, 'SVG, the mode used and the paper length') },
    }),
    bodyLimit({ maxSize: MAX_UPLOAD_BYTES }),
    validate('form', ImageForm),
    async (c) => {
      const { image, mode, width, rotate } = c.req.valid('form');
      const input = Buffer.from(await image.arrayBuffer());

      // Always process (force), and report tooLong instead, so the UI can warn before printing.
      const processed = await c.var.di
        .get('imageProcessor')
        .process(input, { mode, widthPercent: width, rotate, force: true });

      const doc = ReceiptRenderer.imageDocument(processed.png);
      const svg = c.var.di.get('renderer').toSvg(doc, { gradient: processed.mode === 'photo' });

      return c.json<ImagePreview>({
        svg,
        mode: processed.mode,
        lengthCm: processed.lengthCm,
        tooLong: processed.tooLong,
      });
    },
  );
