import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../container';
import { streamEvents } from './sse';

const ListQuery = z.object({ limit: z.coerce.number().int().positive().max(500).optional() });

/** /jobs — history, per-job SSE, reprint and cancel. */
export const jobRoutes = new Hono<AppEnv>()
  .get('/', zValidator('query', ListQuery), (c) => {
    return c.json(c.var.di.get('printQueue').list(c.req.valid('query').limit));
  })

  .get('/:id', (c) => {
    const job = c.var.di.get('printQueue').get(c.req.param('id'));

    return job ? c.json(job) : c.json({ error: 'not found' }, 404);
  })

  .get('/:id/events', (c) => {
    const id = c.req.param('id');

    return streamEvents(c, (e) => e.event.type === 'job' && e.event.job.id === id);
  })

  .post('/:id/reprint', async (c) => {
    const job = await c.var.di.get('printQueue').reprint(c.req.param('id'));

    return job ? c.json(job, 202) : c.json({ error: 'not found' }, 404);
  })

  .post('/:id/cancel', async (c) => {
    const cancelled = await c.var.di.get('printQueue').cancel(c.req.param('id'));

    return cancelled ? c.json({ ok: true }) : c.json({ error: 'not cancellable' }, 409);
  });
