import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import type { AppEnv } from '@/container';
import { Doc } from '@/routes/print';

/** POST /preview/* — same inputs as /print, returns SVG instead of printing. */
export const previewRoutes = new Hono<AppEnv>().post('/', zValidator('json', Doc), (c) => {
  const svg = c.var.di.get('renderer').toSvg(c.req.valid('json').doc);

  return c.body(svg, 200, { 'content-type': 'image/svg+xml' });
});
