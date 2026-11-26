import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '@/container';

export const Doc = z.object({ doc: z.string().min(1) });

/** POST /print/* — render, persist and enqueue. Always 202 { job }. */
export const printRoutes = new Hono<AppEnv>()
  .post('/', zValidator('json', Doc), async (c) => {
    const { doc } = c.req.valid('json');
    const payload = c.var.di.get('renderer').toEscPos(doc);
    const job = await c.var.di.get('printQueue').enqueue({ kind: 'receiptline', source: doc, payload });

    return c.json(job, 202);
  })

  .post('/raw', async (c) => {
    const payload = new Uint8Array(await c.req.arrayBuffer());

    if (payload.length === 0) {
      return c.json({ error: 'empty body' }, 400);
    }

    return c.json(await c.var.di.get('printQueue').enqueue({ kind: 'raw', payload }), 202);
  });
