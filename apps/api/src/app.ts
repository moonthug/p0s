import { swaggerUI } from '@hono/swagger-ui';
import { inferdiHono } from '@inferdi/hono';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { openAPIRouteHandler } from 'hono-openapi';

import type { AppContainer } from './container';
import { ImageTooLongError } from './images/ImageTooLongError';
import { apiRoutes } from './routes/api';
import { validationErrorResponse } from './routes/openapi';
import { TemplateSyntaxError } from './templates/TemplateSyntaxError';

/** Builds the Hono app: a DI request scope on `c.var.di`, then one controller per area. */
export const createApp = (container: AppContainer) => {
  const app = new Hono()
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
    .route('/', apiRoutes);

  // Docs are added after the chain: they're for people, not part of the typed RPC surface.
  // Both URLs are relative, so they work directly (:3300/docs) and behind the /api proxy (/api/docs).
  app.get(
    '/openapi.json',
    openAPIRouteHandler(app, {
      documentation: {
        info: {
          title: 'p0s API',
          version: '0.1.0',
          description: 'Print to the Epson TM-T20II: ReceiptLine documents, images, templates and raw ESC/POS.',
        },
        servers: [{ url: '.', description: 'This server' }],
      },
      defaultValidationErrorResponse: validationErrorResponse,
    }),
  );

  app.get('/docs', swaggerUI({ url: './openapi.json', title: 'p0s API' }));

  return app;
};

export type { AppType } from './routes/api';
