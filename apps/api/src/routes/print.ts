import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { describeRoute } from 'hono-openapi';

import { Job } from '@p0s/shared';

import type { AppEnv } from '../container';
import { ReceiptRenderer } from '../ReceiptRenderer';
import { errorResponse, jsonResponse, validate } from './openapi';
import { DocBody, ImageForm, MAX_UPLOAD_BYTES, TextBody } from './schemas';

/** POST /print/* — render, persist and enqueue. Always 202 { job }. */
export const printRoutes = new Hono<AppEnv>()
  .post(
    '/',
    describeRoute({
      tags: ['Print'],
      summary: 'Print a ReceiptLine document',
      responses: { 202: jsonResponse(Job, 'Queued') },
    }),
    validate('json', DocBody),
    async (c) => {
      const { doc } = c.req.valid('json');
      const payload = c.var.di.get('renderer').toEscPos(doc);
      const job = await c.var.di.get('printQueue').enqueue({ kind: 'receiptline', source: doc, payload });

      return c.json(job, 202);
    },
  )

  .post(
    '/text',
    describeRoute({
      tags: ['Print'],
      summary: 'Print plain text exactly as written',
      responses: { 202: jsonResponse(Job, 'Queued') },
    }),
    validate('json', TextBody),
    async (c) => {
      const { text } = c.req.valid('json');
      const payload = c.var.di.get('renderer').toEscPos(ReceiptRenderer.textDocument(text));
      const job = await c.var.di.get('printQueue').enqueue({ kind: 'text', source: text, payload });

      return c.json(job, 202);
    },
  )

  .post(
    '/image',
    describeRoute({
      tags: ['Print'],
      summary: 'Print an image',
      description: 'Multipart upload. Images longer than about 25 cm are rejected unless `force` is true.',
      responses: { 202: jsonResponse(Job, 'Queued'), 422: errorResponse('Too long to print without force') },
    }),
    bodyLimit({ maxSize: MAX_UPLOAD_BYTES }),
    validate('form', ImageForm),
    async (c) => {
      const { image, mode, width, rotate, force } = c.req.valid('form');
      const input = Buffer.from(await image.arrayBuffer());

      const processed = await c.var.di
        .get('imageProcessor')
        .process(input, { mode, widthPercent: width, rotate, force });

      const doc = ReceiptRenderer.imageDocument(processed.png);
      const payload = c.var.di.get('renderer').toEscPos(doc, { gradient: processed.mode === 'photo' });
      const job = await c.var.di.get('printQueue').enqueue({ kind: 'image', image: processed.png, payload });

      return c.json(job, 202);
    },
  )

  .post(
    '/raw',
    describeRoute({
      tags: ['Print'],
      summary: 'Send raw ESC/POS bytes',
      description: 'Body is sent to the printer unchanged (application/octet-stream).',
      requestBody: { content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
      responses: { 202: jsonResponse(Job, 'Queued'), 400: errorResponse('Empty body') },
    }),
    async (c) => {
      const payload = new Uint8Array(await c.req.arrayBuffer());

      if (payload.length === 0) {
        return c.json({ error: 'empty body' }, 400);
      }

      return c.json(await c.var.di.get('printQueue').enqueue({ kind: 'raw', payload }), 202);
    },
  );
