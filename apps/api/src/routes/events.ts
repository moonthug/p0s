import { Hono } from 'hono';

import type { AppEnv } from '../container';
import { streamEvents } from './sse';

/** GET /events — SSE stream of every printer and job event. */
export const eventRoutes = new Hono<AppEnv>().get('/', (c) => streamEvents(c));
