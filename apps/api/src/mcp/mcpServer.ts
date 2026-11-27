import { setTimeout as sleep } from 'node:timers/promises';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Job, type P0sClient, P0sError } from '@moonthug/p0s-client';
import sharp from 'sharp';
import { z } from 'zod';

import { INSTRUCTIONS } from './instructions';

/** How long a print tool waits for its job to finish before reporting it as still queued. */
const SETTLE_MS = 20_000;

const TemplateVarsInput = z
  .record(z.string(), z.unknown())
  .optional()
  .describe("Values for the template's blanks. Leave out to use its saved example values.");

const text = (value: string): CallToolResult => ({ content: [{ type: 'text', text: value }] });

const json = (value: unknown): CallToolResult => text(JSON.stringify(value, null, 2));

/** Turns API errors (bad markup, unknown template…) into a tool error the model can read and correct. */
async function attempt(run: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof P0sError) {
      return { isError: true, content: [{ type: 'text', text: `p0s said (${err.status}): ${err.message}` }] };
    }

    throw err;
  }
}

/** The preview SVG as a PNG: MCP clients show PNGs, few render SVG. */
async function svgImage(svg: string): Promise<CallToolResult> {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] };
}

async function loadImage(source: { url?: string; base64?: string; mimeType?: string }): Promise<Blob> {
  if (source.base64) {
    return new Blob([Buffer.from(source.base64, 'base64')], { type: source.mimeType ?? 'application/octet-stream' });
  }

  if (!source.url) {
    throw new P0sError(400, 'give either url or base64');
  }

  const res = await fetch(source.url, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) {
    throw new P0sError(400, `couldn't download the image: ${res.status} ${res.statusText}`);
  }

  return res.blob();
}

/**
 * Builds the MCP server: one tool per thing worth doing with the printer. Tools call the API through `p0s`, so
 * validation, templates and the queue behave exactly as they do for the web app and scripts.
 */
export function createMcpServer(p0s: P0sClient): McpServer {
  const server = new McpServer({ name: 'p0s', version: '0.1.0' }, { instructions: INSTRUCTIONS });

  /** Waits for a new job to print, so the tool can say whether it did or what's holding it up. */
  const settle = async (queued: Job): Promise<CallToolResult> => {
    const deadline = Date.now() + SETTLE_MS;
    let job = queued;

    while ((job.status === 'queued' || job.status === 'printing') && Date.now() < deadline) {
      await sleep(250);
      job = await p0s.job(job.id);
    }

    if (job.status === 'printed') {
      return text(`Printed (job ${job.id}).`);
    }

    if (job.status === 'failed' || job.status === 'cancelled') {
      return { isError: true, content: [{ type: 'text', text: `Job ${job.id} ${job.status}: ${job.error ?? ''}` }] };
    }

    const { waiting } = await p0s.status();

    return text(
      `Job ${job.id} is still ${job.status}${waiting ? `: ${waiting}` : ''}. It prints once the printer is ready, ` +
        'unless it waits too long. Check it with list_jobs.',
    );
  };

  const printing = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
  const reading = { readOnlyHint: true, openWorldHint: false };

  server.registerTool(
    'printer_status',
    {
      title: 'Printer status',
      description: 'Whether the printer is connected and ready (paper, cover, errors), and how many jobs are queued.',
      annotations: reading,
    },
    () => attempt(async () => json(await p0s.status())),
  );

  server.registerTool(
    'print_receipt',
    {
      title: 'Print a receipt',
      description: 'Print a ReceiptLine document (markup described in the server instructions). Waits for it to print.',
      inputSchema: { doc: z.string().min(1).describe('The ReceiptLine document') },
      annotations: printing,
    },
    ({ doc }) => attempt(async () => settle(await p0s.print(doc))),
  );

  server.registerTool(
    'print_text',
    {
      title: 'Print plain text',
      description: 'Print text exactly as written, left aligned, with no markup. Waits for it to print.',
      inputSchema: { text: z.string().min(1) },
      annotations: printing,
    },
    (args) => attempt(async () => settle(await p0s.printText(args.text))),
  );

  server.registerTool(
    'print_image',
    {
      title: 'Print an image',
      description:
        'Print an image (PNG, JPEG, WebP, GIF…) from a URL the printer server can reach, or from base64 data. ' +
        'It is converted to black and white and scaled to the paper. Waits for it to print.',
      inputSchema: {
        url: z.string().url().optional().describe('Where to download the image from'),
        base64: z.string().optional().describe('The image file, base64 encoded (instead of url)'),
        mimeType: z.string().optional().describe('With base64, e.g. image/png'),
        mode: z
          .enum(['auto', 'photo', 'line'])
          .optional()
          .describe('photo dithers (pictures); line is sharp black and white (logos, text, QR codes)'),
        width: z.number().int().min(10).max(100).optional().describe('Printed width, % of the paper (default 100)'),
        rotate: z
          .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
          .optional()
          .describe('Rotate clockwise; 90 prints a landscape image larger'),
        force: z.boolean().optional().describe('Print even if it would use more than about 25 cm of paper'),
      },
      annotations: printing,
    },
    ({ url, base64, mimeType, ...options }) =>
      attempt(async () => settle(await p0s.printImage(await loadImage({ url, base64, mimeType }), options))),
  );

  server.registerTool(
    'preview_receipt',
    {
      title: 'Preview a receipt',
      description: 'Render a ReceiptLine document as an image of the printout, without printing it.',
      inputSchema: { doc: z.string().min(1).describe('The ReceiptLine document') },
      annotations: reading,
    },
    ({ doc }) => attempt(async () => svgImage(await p0s.preview(doc))),
  );

  server.registerTool(
    'list_templates',
    {
      title: 'List templates',
      description: 'The saved templates: name, title and the blanks each one has.',
      annotations: reading,
    },
    () => attempt(async () => json(await p0s.templates())),
  );

  server.registerTool(
    'get_template',
    {
      title: 'Get a template',
      description: "A template's body (Mustache over ReceiptLine), its blanks and its saved example values.",
      inputSchema: { name: z.string() },
      annotations: reading,
    },
    ({ name }) => attempt(async () => json(await p0s.template(name))),
  );

  server.registerTool(
    'preview_template',
    {
      title: 'Preview a template',
      description: 'Render a saved template, filled in, as an image of the printout, without printing it.',
      inputSchema: { name: z.string(), vars: TemplateVarsInput },
      annotations: reading,
    },
    ({ name, vars }) =>
      attempt(async () => {
        const res = await p0s.rpc.templates[':name'].preview.$post({ param: { name }, json: { vars } });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };

          throw new P0sError(res.status, body.error ?? res.statusText);
        }

        return svgImage(await res.text());
      }),
  );

  server.registerTool(
    'print_template',
    {
      title: 'Print a template',
      description: 'Print a saved template, filled in with the given values. Waits for it to print.',
      inputSchema: { name: z.string(), vars: TemplateVarsInput },
      annotations: printing,
    },
    ({ name, vars }) => attempt(async () => settle(await p0s.printTemplate(name, vars))),
  );

  server.registerTool(
    'save_template',
    {
      title: 'Save a template',
      description:
        'Create a template, or replace the one with this name. The body is Mustache over ReceiptLine; ' +
        'sample holds example values, used when it is printed without any.',
      inputSchema: {
        name: z.string().describe('Lowercase letters, digits and dashes, e.g. shopping-list'),
        title: z.string().min(1),
        body: z.string().min(1),
        sample: z.record(z.string(), z.unknown()).default({}),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ name, ...input }) =>
      attempt(async () => {
        const exists = (await p0s.templates()).some((t) => t.name === name);
        const saved = exists ? await p0s.updateTemplate(name, input) : await p0s.createTemplate(name, input);

        return json(saved);
      }),
  );

  server.registerTool(
    'list_jobs',
    {
      title: 'List print jobs',
      description: 'Recent print jobs, newest first, with their status and any error.',
      inputSchema: { limit: z.number().int().min(1).max(100).default(10) },
      annotations: reading,
    },
    ({ limit }) => attempt(async () => json((await p0s.jobs(limit)).map(({ source: _, ...job }) => job))),
  );

  server.registerTool(
    'reprint_job',
    {
      title: 'Reprint a job',
      description: 'Print an earlier job again. Waits for it to print.',
      inputSchema: { id: z.string() },
      annotations: printing,
    },
    ({ id }) => attempt(async () => settle(await p0s.reprint(id))),
  );

  server.registerTool(
    'cancel_job',
    {
      title: 'Cancel a job',
      description: "Cancel a job that hasn't printed yet.",
      inputSchema: { id: z.string() },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    ({ id }) =>
      attempt(async () => {
        await p0s.cancel(id);

        return text(`Cancelled job ${id}.`);
      }),
  );

  return server;
}
