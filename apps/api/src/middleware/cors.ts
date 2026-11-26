import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

/**
 * Lets the listed web origins (e.g. a site that prints recipes) call the API from a browser; `*` allows any site.
 * With no origins, this does nothing and the API stays same-origin only.
 *
 * It also answers Chrome's Private Network Access check: a public HTTPS site calling a device on the home
 * network sends `Access-Control-Request-Private-Network: true` in its preflight, and only goes ahead if the
 * response opts in. That opt-in is only given to origins the allowlist accepted.
 */
export function corsFor(origins: string[]): MiddlewareHandler {
  if (origins.length === 0) {
    return async (_c, next) => {
      await next();
    };
  }

  // `*` allows any website. Credentials (cookies) aren't used, so the wildcard is valid CORS.
  const allow = cors({
    origin: origins.includes('*') ? '*' : origins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type'],
    maxAge: 600,
  });

  return async (c, next) => {
    // `cors` answers preflights by returning its own response, which has to be passed on.
    const preflightResponse = await allow(c, next);
    const response = preflightResponse ?? c.res;

    const asksForPrivateNetwork = c.req.header('access-control-request-private-network') === 'true';
    const originAllowed = response.headers.has('access-control-allow-origin');

    if (c.req.method === 'OPTIONS' && asksForPrivateNetwork && originAllowed) {
      response.headers.set('access-control-allow-private-network', 'true');
    }

    return preflightResponse;
  };
}
