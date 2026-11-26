import { z } from 'zod';

// Schemas with an `id` become named components in the API's OpenAPI document.

export const PrinterStatus = z
  .object({
    /** USB device present and claimed */
    connected: z.boolean(),
    /** Printer reports itself online (not in an error/offline state) */
    online: z.boolean(),
    coverOpen: z.boolean(),
    paperNearEnd: z.boolean(),
    paperOut: z.boolean(),
    /** Cutter jam, head overheat, or other error condition */
    error: z.boolean(),
  })
  .meta({ id: 'PrinterStatus', description: 'Live status read from the printer over USB' });
export type PrinterStatus = z.infer<typeof PrinterStatus>;

/** Printer can accept a job right now. */
export const isReady = (s: PrinterStatus) => s.connected && s.online && !s.coverOpen && !s.paperOut && !s.error;

/** Human-readable reason the printer isn't ready, or null if it is. */
export const notReadyReason = (s: PrinterStatus): string | null => {
  if (!s.connected) {
    return 'disconnected';
  }

  if (s.paperOut) {
    return 'paper-out';
  }

  if (s.coverOpen) {
    return 'cover-open';
  }

  if (s.error) {
    return 'error';
  }

  if (!s.online) {
    return 'offline';
  }

  return null;
};

export const JobKind = z.enum(['receiptline', 'text', 'image', 'raw', 'template']);
export type JobKind = z.infer<typeof JobKind>;

export const JobStatus = z.enum(['queued', 'printing', 'printed', 'failed', 'cancelled']);
export type JobStatus = z.infer<typeof JobStatus>;

export const Job = z
  .object({
    id: z.string(),
    kind: JobKind,
    status: JobStatus,
    /** ReceiptLine source (or text); null for raw/image */
    source: z.string().nullable(),
    error: z.string().nullable(),
    createdAt: z.number().describe('Unix time in milliseconds'),
    updatedAt: z.number().describe('Unix time in milliseconds'),
  })
  .meta({ id: 'Job', description: 'A print job and where it is in the queue' });
export type Job = z.infer<typeof Job>;

export type ServerEvent =
  | { type: 'printer'; status: PrinterStatus; waiting: string | null }
  | { type: 'job'; job: Job };

export const JobCounts = z.record(JobStatus, z.number()).meta({ id: 'JobCounts' });
export type JobCounts = z.infer<typeof JobCounts>;

/** GET /status */
export const StatusResponse = z
  .object({
    printer: PrinterStatus,
    waiting: z.string().nullable().describe("Why the head job is waiting (e.g. 'paper-out'), or null when it isn't"),
    queue: JobCounts,
  })
  .meta({ id: 'StatusResponse' });
export type StatusResponse = z.infer<typeof StatusResponse>;

export const ApiErrorBody = z.object({ error: z.string() }).meta({ id: 'Error' });

/** POST /print */
export type PrintRequest = { doc: string };

/** How an image is turned into black and white: dithered (photos) or thresholded (logos, text, QR codes). */
export const ImageMode = z.enum(['auto', 'photo', 'line']);
export type ImageMode = z.infer<typeof ImageMode>;

/** POST /preview/image */
export const ImagePreview = z
  .object({
    svg: z.string(),
    mode: z.enum(['photo', 'line']).describe('The mode actually used (auto resolves to photo or line)'),
    lengthCm: z.number(),
    tooLong: z.boolean().describe('Longer than the guard allows; printing needs `force`'),
  })
  .meta({ id: 'ImagePreview' });
export type ImagePreview = z.infer<typeof ImagePreview>;

/** A template name: lowercase letters, digits and dashes, used in URLs (`/templates/daily-briefing/print`). */
export const TemplateName = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

export const TemplateVars = z.record(z.string(), z.unknown());
export type TemplateVars = z.infer<typeof TemplateVars>;

export const Template = z
  .object({
    name: z.string(),
    title: z.string(),
    body: z.string().describe('ReceiptLine with Mustache tags'),
    sample: TemplateVars.describe('Example values, used for the preview and as the form defaults'),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .meta({ id: 'Template' });
export type Template = z.infer<typeof Template>;

/**
 * A variable found in a template body, so the UI can build a form for it.
 * - text: `{{name}}` or `{{{name}}}`
 * - list: a section that repeats over items, e.g. `{{#todos}}{{.}}{{/todos}}`
 * - flag: a section shown or hidden, e.g. `{{#urgent}}…{{/urgent}}`
 */
export const TemplateVariable = z.object({ name: z.string(), kind: z.enum(['text', 'list', 'flag']) });
export type TemplateVariable = z.infer<typeof TemplateVariable>;

export const TemplateDetail = Template.extend({ variables: z.array(TemplateVariable) }).meta({ id: 'TemplateDetail' });
export type TemplateDetail = z.infer<typeof TemplateDetail>;

export { templateVariables } from './templateVariables';
