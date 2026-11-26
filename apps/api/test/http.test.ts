import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { Job, StatusResponse, TemplateDetail } from '@p0s/shared';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type AppContainer, buildContainer } from '../src/container';

const dir = mkdtempSync(join(tmpdir(), 'p0s-http-'));

let container: AppContainer;
let app: ReturnType<typeof createApp>;

const json = (method: string, path: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function waitForStatus(id: string, status: Job['status']): Promise<Job> {
  for (let i = 0; i < 100; i++) {
    const job = (await (await app.request(`/jobs/${id}`)).json()) as Job;

    if (job.status === status) {
      return job;
    }

    await sleep(50);
  }

  throw new Error(`job ${id} never reached ${status}`);
}

beforeAll(async () => {
  const cfg = loadConfig({ PRINTER: 'fake', DB_PATH: join(dir, 'test.db'), QUEUE_DASHBOARD_PORT: '0' });

  container = buildContainer(cfg);

  await container.get('printer').start();
  await container.get('printQueue').start();

  app = createApp(container);
});

afterAll(async () => {
  await container.dispose();
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /status', () => {
  it('reports the printer and the queue', async () => {
    const res = await app.request('/status');
    const body = (await res.json()) as StatusResponse;

    expect(res.status).toBe(200);
    expect(body.printer).toMatchObject({ connected: true, online: true });
    expect(body.queue).toHaveProperty('queued');
  });
});

describe('POST /print', () => {
  it('queues a document and prints it', async () => {
    const res = await json('POST', '/print', { doc: '^^Hello\n-\nWorld' });
    const job = (await res.json()) as Job;

    expect(res.status).toBe(202);
    expect(job).toMatchObject({ kind: 'receiptline', status: 'queued' });

    await waitForStatus(job.id, 'printed');
  });

  it('explains what is wrong with a bad request', async () => {
    const res = await json('POST', '/print', { doc: '' });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'doc: Too small: expected string to have >=1 characters' });
  });
});

describe('POST /print/image', () => {
  const upload = async (width: number, height: number, fields: Record<string, string> = {}) => {
    const png = await sharp({ create: { width, height, channels: 3, background: '#888' } })
      .png()
      .toBuffer();
    const form = new FormData();

    form.append('image', new File([new Uint8Array(png)], 'test.png', { type: 'image/png' }));

    for (const [key, value] of Object.entries(fields)) {
      form.append(key, value);
    }

    return app.request('/print/image', { method: 'POST', body: form });
  };

  it('queues an image', async () => {
    const res = await upload(400, 200);

    expect(res.status).toBe(202);
    expect(((await res.json()) as Job).kind).toBe('image');
  });

  it('refuses a very long image unless forced', async () => {
    const refused = await upload(576, 2400);

    expect(refused.status).toBe(422);
    expect(((await refused.json()) as { error: string }).error).toMatch(/30 cm of paper/);
    expect((await upload(576, 2400, { force: 'true' })).status).toBe(202);
  });
});

describe('/templates', () => {
  const template = { name: 'greeting', title: 'Greeting', body: '^^Hi {{name}}\n{{#items}}\n- {{.}}\n{{/items}}' };

  it('creates a template and lists its blanks', async () => {
    const res = await json('POST', '/templates', { ...template, sample: { name: 'Sam', items: ['a'] } });
    const created = (await res.json()) as TemplateDetail;

    expect(res.status).toBe(201);
    expect(created.variables).toEqual([
      { name: 'name', kind: 'text' },
      { name: 'items', kind: 'list' },
    ]);
  });

  it('refuses a duplicate name', async () => {
    expect((await json('POST', '/templates', template)).status).toBe(409);
  });

  it('refuses an invalid name or broken Mustache', async () => {
    expect((await json('POST', '/templates', { ...template, name: 'Not Valid' })).status).toBe(400);

    const broken = await json('POST', '/templates', { ...template, name: 'broken', body: '{{#open}}' });

    expect(broken.status).toBe(400);
    expect(((await broken.json()) as { error: string }).error).toMatch(/^Template error:/);
  });

  it('prints with the values given, escaped for ReceiptLine', async () => {
    const res = await json('POST', '/templates/greeting/print', { vars: { name: 'Fish | chips', items: [] } });
    const job = (await res.json()) as Job;

    expect(res.status).toBe(202);
    expect(job.kind).toBe('template');
    expect(job.source).toBe('^^Hi Fish \\| chips\n');
  });

  it('prints with the saved sample when no values are given', async () => {
    const job = (await (await json('POST', '/templates/greeting/print', {})).json()) as Job;

    expect(job.source).toBe('^^Hi Sam\n- a\n');
  });

  it('deletes a template', async () => {
    expect((await json('DELETE', '/templates/greeting')).status).toBe(200);
    expect((await app.request('/templates/greeting')).status).toBe(404);
  });
});

describe('/jobs', () => {
  it('returns 404 for an unknown job', async () => {
    expect((await app.request('/jobs/nope')).status).toBe(404);
  });

  it('lists jobs newest first', async () => {
    const list = (await (await app.request('/jobs')).json()) as Job[];

    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.createdAt).toBeGreaterThanOrEqual(list.at(-1)?.createdAt ?? 0);
  });
});

describe('GET /openapi.json', () => {
  it('documents every route with named schemas', async () => {
    const spec = (await (await app.request('/openapi.json')).json()) as {
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };

    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/status', '/print', '/print/image', '/templates/{name}/print', '/jobs/{id}']),
    );
    expect(Object.keys(spec.components.schemas)).toEqual(
      expect.arrayContaining(['Job', 'StatusResponse', 'TemplateDetail', 'Error']),
    );
  });
});
