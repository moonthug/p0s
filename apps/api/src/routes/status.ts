import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';

import { StatusResponse } from '@p0s/shared';

import type { AppEnv } from '../container';
import { jsonResponse } from './openapi';

export const statusRoutes = new Hono<AppEnv>().get(
  '/',
  describeRoute({
    tags: ['Printer'],
    summary: 'Printer status and queue counts',
    responses: { 200: jsonResponse(StatusResponse, 'Current status') },
  }),
  (c) => {
    const queue = c.var.di.get('printQueue');
    const { status, waiting } = queue.printerEvent();

    return c.json<StatusResponse>({ printer: status, waiting, queue: queue.counts() });
  },
);
