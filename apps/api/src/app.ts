import { inferdiHono } from '@inferdi/hono';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import type { AppContainer } from '@/container';
import { eventRoutes, jobRoutes, previewRoutes, printRoutes, statusRoutes } from '@/routes';

/** Builds the Hono app: a DI request scope on `c.var.di`, then one controller per area. */
export const createApp = (container: AppContainer) =>
  new Hono()
    .use(logger())
    .use(inferdiHono({ container }))
    .onError((err, c) => {
      console.error(err);

      return c.json({ error: err.message }, 500);
    })
    .route('/status', statusRoutes)
    .route('/print', printRoutes)
    .route('/preview', previewRoutes)
    .route('/jobs', jobRoutes)
    .route('/events', eventRoutes);
