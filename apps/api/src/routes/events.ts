import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';

import type { AppEnv } from '../container';
import { sseResponse } from './openapi';
import { streamEvents } from './sse';

/** GET /events — SSE stream of every printer and job event. */
export const eventRoutes = new Hono<AppEnv>().get(
  '/',
  describeRoute({
    tags: ['Printer'],
    summary: 'Live printer and job events (SSE)',
    description: 'Sends the current printer state first. Supports `Last-Event-ID` to resume.',
    responses: { 200: sseResponse('`printer` and `job` events') },
  }),
  (c) => streamEvents(c),
);
