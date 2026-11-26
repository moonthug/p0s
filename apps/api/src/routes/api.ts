import { Hono } from 'hono';

import { eventRoutes } from './events';
import { jobRoutes } from './jobs';
import { previewRoutes } from './preview';
import { printRoutes } from './print';
import { statusRoutes } from './status';
import { templateRoutes } from './templates';

/**
 * The public route tree: every controller, and nothing else.
 *
 * Built on a plain `new Hono()` on purpose. `.route()` keeps the parent's env type, so `AppType` describes only the
 * routes' inputs and outputs, with none of the server's wiring (DI container, database, USB). That keeps its
 * declaration small enough to ship in `@moonthug/p0s-client`. Middleware is added around it in `createApp`.
 */
export const apiRoutes = new Hono()
  .route('/status', statusRoutes)
  .route('/print', printRoutes)
  .route('/preview', previewRoutes)
  .route('/jobs', jobRoutes)
  .route('/templates', templateRoutes)
  .route('/events', eventRoutes);

/** The API's routes as a type, for `hc<AppType>` in `@moonthug/p0s-client`. */
export type AppType = typeof apiRoutes;
