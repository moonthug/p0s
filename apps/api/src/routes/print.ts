import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import type { AppEnv } from '../container';
import { ReceiptRenderer } from '../ReceiptRenderer';
import { DocBody, ImageForm, MAX_UPLOAD_BYTES, TextBody } from './schemas';

/** POST /print/* — render, persist and enqueue. Always 202 { job }. */
export const printRoutes = new Hono<AppEnv>()
  .post('/', zValidator('json', DocBody), async (c) => {
    const { doc } = c.req.valid('json');
    const payload = c.var.di.get('renderer').toEscPos(doc);
    const job = await c.var.di.get('printQueue').enqueue({ kind: 'receiptline', source: doc, payload });

    return c.json(job, 202);
  })

  .post('/text', zValidator('json', TextBody), async (c) => {
    const { text } = c.req.valid('json');
    const payload = c.var.di.get('renderer').toEscPos(ReceiptRenderer.textDocument(text));
    const job = await c.var.di.get('printQueue').enqueue({ kind: 'text', source: text, payload });

    return c.json(job, 202);
  })

  .post('/image', bodyLimit({ maxSize: MAX_UPLOAD_BYTES }), zValidator('form', ImageForm), async (c) => {
    const { image, mode, width, rotate, force } = c.req.valid('form');
    const input = Buffer.from(await image.arrayBuffer());

    const processed = await c.var.di.get('imageProcessor').process(input, { mode, widthPercent: width, rotate, force });

    const doc = ReceiptRenderer.imageDocument(processed.png);
    const payload = c.var.di.get('renderer').toEscPos(doc, { gradient: processed.mode === 'photo' });
    const job = await c.var.di.get('printQueue').enqueue({ kind: 'image', image: processed.png, payload });

    return c.json(job, 202);
  })

  .post('/raw', async (c) => {
    const payload = new Uint8Array(await c.req.arrayBuffer());

    if (payload.length === 0) {
      return c.json({ error: 'empty body' }, 400);
    }

    return c.json(await c.var.di.get('printQueue').enqueue({ kind: 'raw', payload }), 202);
  });
