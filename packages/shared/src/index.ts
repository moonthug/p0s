import { z } from 'zod';

export const PrinterStatus = z.object({
  /** USB device present and claimed */
  connected: z.boolean(),
  /** Printer reports itself online (not in an error/offline state) */
  online: z.boolean(),
  coverOpen: z.boolean(),
  paperNearEnd: z.boolean(),
  paperOut: z.boolean(),
  /** Cutter jam, head overheat, or other error condition */
  error: z.boolean(),
});
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

export const Job = z.object({
  id: z.string(),
  kind: JobKind,
  status: JobStatus,
  /** ReceiptLine source (or text); null for raw/image */
  source: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type Job = z.infer<typeof Job>;

export type ServerEvent =
  | { type: 'printer'; status: PrinterStatus; waiting: string | null }
  | { type: 'job'; job: Job };

export type JobCounts = Record<JobStatus, number>;

/** GET /status */
export type StatusResponse = {
  printer: PrinterStatus;
  /** Why the head job is waiting (e.g. 'paper-out'), or null when it isn't */
  waiting: string | null;
  queue: JobCounts;
};

/** POST /print, /print/raw, /jobs/:id/reprint */
export type PrintRequest = { doc: string };

/** How an image is turned into black and white: dithered (photos) or thresholded (logos, text, QR codes). */
export const ImageMode = z.enum(['auto', 'photo', 'line']);
export type ImageMode = z.infer<typeof ImageMode>;

/** POST /preview/image */
export type ImagePreview = {
  svg: string;
  /** The mode actually used (auto resolves to photo or line) */
  mode: Exclude<ImageMode, 'auto'>;
  lengthCm: number;
  /** Longer than the guard allows; printing needs `force` */
  tooLong: boolean;
};

/** A template name: lowercase letters, digits and dashes, used in URLs (`/templates/daily-briefing/print`). */
export const TemplateName = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

export type TemplateVars = Record<string, unknown>;

export type Template = {
  name: string;
  title: string;
  /** ReceiptLine with Mustache tags */
  body: string;
  /** Example values, used for the preview and as the form's starting values */
  sample: TemplateVars;
  createdAt: number;
  updatedAt: number;
};

/**
 * A variable found in a template body, so the UI can build a form for it.
 * - text: `{{name}}` or `{{{name}}}`
 * - list: a section that repeats over items, e.g. `{{#todos}}{{.}}{{/todos}}`
 * - flag: a section shown or hidden, e.g. `{{#urgent}}…{{/urgent}}`
 */
export type TemplateVariable = { name: string; kind: 'text' | 'list' | 'flag' };

export type TemplateDetail = Template & { variables: TemplateVariable[] };
export { templateVariables } from './templateVariables';
