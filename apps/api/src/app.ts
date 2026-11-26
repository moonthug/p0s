import { inferdiHono } from '@inferdi/hono';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import type { AppContainer } from './container';
import { ImageTooLongError } from './images/ImageTooLongError';
import { eventRoutes, jobRoutes, previewRoutes, printRoutes, statusRoutes, templateRoutes } from './routes';
import { TemplateSyntaxError } from './templates/TemplateSyntaxError';

/** Builds the Hono app: a DI request scope on `c.var.di`, then one controller per area. */
export const createApp = (container: AppContainer) =>
  new Hono()
    .use(logger())
    .use(inferdiHono({ container }))
    .onError((err, c) => {
      if (err instanceof ImageTooLongError) {
        return c.json({ error: err.message }, 422);
      }

      if (err instanceof TemplateSyntaxError) {
        return c.json({ error: err.message }, 400);
      }

      console.error(err);

      return c.json({ error: err.message }, 500);
    })
    .route('/status', statusRoutes)
    .route('/print', printRoutes)
    .route('/preview', previewRoutes)
    .route('/jobs', jobRoutes)
    .route('/templates', templateRoutes)
    .route('/events', eventRoutes);

/** The route tree's type, for the web app's `hc<AppType>` client. */
export type AppType = ReturnType<typeof createApp>;
