import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { z } from 'zod';

import { Job } from '@p0s/shared';

import type { AppEnv } from '../container';
import { errorResponse, jsonResponse, sseResponse, validate } from './openapi';
import { streamEvents } from './sse';

const ListQuery = z.object({ limit: z.coerce.number().int().positive().max(500).optional() });

/** /jobs — history, per-job SSE, reprint and cancel. */
export const jobRoutes = new Hono<AppEnv>()
  .get(
    '/',
    describeRoute({
      tags: ['Jobs'],
      summary: 'Job history, newest first',
      responses: { 200: jsonResponse(z.array(Job), 'Jobs') },
    }),
    validate('query', ListQuery),
    (c) => {
      return c.json(c.var.di.get('printQueue').list(c.req.valid('query').limit));
    },
  )

  .get(
    '/:id',
    describeRoute({
      tags: ['Jobs'],
      summary: 'One job',
      responses: { 200: jsonResponse(Job, 'The job'), 404: errorResponse('No such job') },
    }),
    (c) => {
      const job = c.var.di.get('printQueue').get(c.req.param('id'));

      return job ? c.json(job) : c.json({ error: 'not found' }, 404);
    },
  )

  .get(
    '/:id/events',
    describeRoute({
      tags: ['Jobs'],
      summary: 'Live updates for one job (SSE)',
      responses: { 200: sseResponse('`job` events for this job') },
    }),
    (c) => {
      const id = c.req.param('id');

      return streamEvents(c, (e) => e.event.type === 'job' && e.event.job.id === id);
    },
  )

  .post(
    '/:id/reprint',
    describeRoute({
      tags: ['Jobs'],
      summary: 'Print a job again',
      responses: { 202: jsonResponse(Job, 'The new job'), 404: errorResponse('No such job') },
    }),
    async (c) => {
      const job = await c.var.di.get('printQueue').reprint(c.req.param('id'));

      return job ? c.json(job, 202) : c.json({ error: 'not found' }, 404);
    },
  )

  .post(
    '/:id/cancel',
    describeRoute({
      tags: ['Jobs'],
      summary: 'Cancel a job that has not started printing',
      responses: { 200: { description: 'Cancelled' }, 409: errorResponse('Already printing or finished') },
    }),
    async (c) => {
      const cancelled = await c.var.di.get('printQueue').cancel(c.req.param('id'));

      return cancelled ? c.json({ ok: true }) : c.json({ error: 'not cancellable' }, 409);
    },
  );
