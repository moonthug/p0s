import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { buildContainer } from '../src/container';

/** Preflights and /openapi.json never touch the printer or database, so the container doesn't need starting. */
const appWith = (origins: string) =>
  createApp(buildContainer(loadConfig({ PRINTER: 'fake', DB_PATH: ':memory:', CORS_ORIGINS: origins })));

const preflight = (app: ReturnType<typeof appWith>, origin: string, privateNetwork: boolean = false) =>
  app.request('/print', {
    method: 'OPTIONS',
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
      ...(privateNetwork && { 'access-control-request-private-network': 'true' }),
    },
  });

describe('CORS', () => {
  const app = appWith('https://farce.app, http://localhost:3000');

  it('lets an allowed origin call the API from a browser', async () => {
    const res = await preflight(app, 'https://farce.app');

    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://farce.app');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('content-type');
  });

  it('allows each origin in the list, not just the first', async () => {
    const res = await app.request('/openapi.json', { headers: { origin: 'http://localhost:3000' } });

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('gives no CORS headers to other origins', async () => {
    const res = await preflight(app, 'https://evil.example');

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it("opts in to Chrome's private network check for allowed origins only", async () => {
    const allowed = await preflight(app, 'https://farce.app', true);
    const refused = await preflight(app, 'https://evil.example', true);

    expect(allowed.headers.get('access-control-allow-private-network')).toBe('true');
    expect(refused.headers.get('access-control-allow-private-network')).toBeNull();
  });

  it('allows any website with *', async () => {
    const res = await preflight(appWith('*'), 'https://anything.example', true);

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-private-network')).toBe('true');
  });

  it('sends no CORS headers at all when no origins are configured', async () => {
    const res = await preflight(appWith(''), 'https://farce.app', true);

    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(res.headers.get('access-control-allow-private-network')).toBeNull();
  });
});
