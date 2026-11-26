import { describe, expect, it } from 'vitest';

import { P0sClient } from '../src/P0sClient.js';
import { P0sError } from '../src/P0sError.js';

type Sent = { method: string; url: string; body: unknown; headers: Headers };

/** A client whose requests are recorded and answered with `respond`, instead of going over the network. */
function clientWith(respond: (sent: Sent) => Response) {
  const sent: Sent[] = [];

  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const contentType = request.headers.get('content-type') ?? '';
    const body = contentType.includes('json')
      ? await request.json()
      : contentType.includes('form')
        ? await request.formData()
        : null;
    const record = { method: request.method, url: request.url, body, headers: request.headers };

    sent.push(record);

    return respond(record);
  };

  return { client: new P0sClient('http://berry.local:8080/api/', { fetch }), sent };
}

const json = (body: unknown, status: number = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const job = { id: 'j1', kind: 'receiptline', status: 'queued', source: 'hi', error: null, createdAt: 1, updatedAt: 1 };

describe('P0sClient', () => {
  it('prints a ReceiptLine document', async () => {
    const { client, sent } = clientWith(() => json(job, 202));

    await expect(client.print('hi')).resolves.toEqual(job);
    expect(sent[0]).toMatchObject({ method: 'POST', url: 'http://berry.local:8080/api/print', body: { doc: 'hi' } });
  });

  it('prints a template with values, or with its saved sample when none are given', async () => {
    const { client, sent } = clientWith(() => json({ ...job, kind: 'template' }, 202));

    await client.printTemplate('shopping-list', { items: ['Milk'] });
    await client.printTemplate('shopping-list');

    expect(sent[0]).toMatchObject({
      url: 'http://berry.local:8080/api/templates/shopping-list/print',
      body: { vars: { items: ['Milk'] } },
    });
    expect(sent[1]?.body).toEqual({});
  });

  it('uploads an image as multipart, sending only the options that were set', async () => {
    const { client, sent } = clientWith(() => json({ ...job, kind: 'image' }, 202));

    await client.printImage(new Blob(['png'], { type: 'image/png' }), { mode: 'line', width: 50 });

    const form = sent[0]?.body as FormData;

    expect(sent[0]?.url).toBe('http://berry.local:8080/api/print/image');
    expect(form.get('image')).toBeInstanceOf(Blob);
    expect([form.get('mode'), form.get('width'), form.get('rotate'), form.get('force')]).toEqual([
      'line',
      '50',
      null,
      null,
    ]);
  });

  it('reads job history with a limit', async () => {
    const { client, sent } = clientWith(() => json([job]));

    await expect(client.jobs(5)).resolves.toEqual([job]);
    expect(sent[0]?.url).toBe('http://berry.local:8080/api/jobs?limit=5');
  });

  it("throws P0sError with the API's own message and status", async () => {
    const { client } = clientWith(() => json({ error: 'doc: Too small' }, 400));

    const error = await client.print('').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(P0sError);
    expect(error).toMatchObject({ status: 400, message: 'doc: Too small' });
  });

  it('returns preview SVG as text', async () => {
    const { client } = clientWith(() => new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }));

    await expect(client.preview('hi')).resolves.toBe('<svg/>');
  });

  it('passes default headers through to every request', async () => {
    const fetchHeaders: Headers[] = [];
    const client = new P0sClient('http://p0s/api', {
      headers: { 'x-source': 'home-assistant' },
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        fetchHeaders.push(new Request(input, init).headers);

        return json({ printer: {}, waiting: null, queue: {} });
      },
    });

    await client.status();

    expect(fetchHeaders[0]?.get('x-source')).toBe('home-assistant');
  });

  it('builds absolute URLs for links and the event stream', () => {
    const client = new P0sClient('http://berry.local:8080/api/');

    expect(client.eventsUrl()).toBe('http://berry.local:8080/api/events');
  });
});
