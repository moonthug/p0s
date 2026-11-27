import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { type AppContainer, buildContainer } from '../src/container';

const dir = mkdtempSync(join(tmpdir(), 'p0s-mcp-'));

let container: AppContainer;
let client: Client;

/** Calls a tool and returns its first text block (and whether it was an error). */
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await client.callTool({ name, arguments: args })) as CallToolResult;
  const first = result.content[0];

  return { result, text: first?.type === 'text' ? first.text : '', isError: result.isError ?? false };
}

beforeAll(async () => {
  const cfg = loadConfig({ PRINTER: 'fake', DB_PATH: join(dir, 'test.db'), QUEUE_DASHBOARD_PORT: '0' });

  container = buildContainer(cfg);

  await container.get('printer').start();
  await container.get('printQueue').start();

  const app = createApp(container);

  // The MCP client talks HTTP to the app in-process, with no server listening.
  const transport = new StreamableHTTPClientTransport(new URL('http://p0s/mcp'), {
    fetch: async (input, init) => app.request(String(input), init),
  });

  client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  await container.dispose();
  rmSync(dir, { recursive: true, force: true });
});

describe('MCP', () => {
  it('explains the markup when a client connects', () => {
    expect(client.getInstructions()).toContain('ReceiptLine');
  });

  it('lists the tools', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['printer_status', 'print_receipt', 'preview_receipt', 'print_template', 'list_jobs']),
    );
  });

  it('reports printer status', async () => {
    const { text } = await call('printer_status');

    expect(JSON.parse(text)).toMatchObject({ printer: { connected: true } });
  });

  it('prints a receipt and waits until it has printed', async () => {
    const { text, isError } = await call('print_receipt', { doc: '^^Hello\n-\nFrom MCP' });

    expect(isError).toBe(false);
    expect(text).toMatch(/^Printed \(job /);
  });

  it('previews a receipt as a PNG', async () => {
    const { result } = await call('preview_receipt', { doc: '"Bold' });
    const image = result.content[0];

    expect(image?.type).toBe('image');

    if (image?.type === 'image') {
      expect(image.mimeType).toBe('image/png');
      expect((await sharp(Buffer.from(image.data, 'base64')).metadata()).format).toBe('png');
    }
  });

  it('saves a template, then updates it, previews it and prints it', async () => {
    await call('save_template', { name: 'mcp-note', title: 'Note', body: '{{text}}', sample: { text: 'hi' } });

    const { text: saved } = await call('save_template', {
      name: 'mcp-note',
      title: 'Note (v2)',
      body: '"{{text}}',
      sample: { text: 'hi' },
    });

    expect(JSON.parse(saved)).toMatchObject({ name: 'mcp-note', title: 'Note (v2)' });
    expect((await call('preview_template', { name: 'mcp-note', vars: { text: 'yo' } })).result.content[0]?.type).toBe(
      'image',
    );
    expect((await call('print_template', { name: 'mcp-note' })).text).toMatch(/^Printed/);
  });

  it('answers API errors as a tool error the model can read', async () => {
    const { text, isError } = await call('print_template', { name: 'no-such-template' });

    expect(isError).toBe(true);
    expect(text).toContain('404');
  });

  it('lists jobs without their source', async () => {
    const jobs = JSON.parse((await call('list_jobs', { limit: 2 })).text) as Record<string, unknown>[];

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).not.toHaveProperty('source');
    expect(jobs[0]).toMatchObject({ status: 'printed' });
  });
});
