import { Hono } from 'hono';

import type { StatusResponse } from '@p0s/shared';

import type { AppEnv } from '../container';

export const statusRoutes = new Hono<AppEnv>().get('/', (c) => {
  const queue = c.var.di.get('printQueue');
  const { status, waiting } = queue.printerEvent();

  return c.json<StatusResponse>({ printer: status, waiting, queue: queue.counts() });
});
