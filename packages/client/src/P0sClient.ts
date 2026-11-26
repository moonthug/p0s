import {
  type ClientRequestOptions,
  type ClientResponse,
  DetailedError,
  hc,
  type InferRequestType,
  parseResponse,
} from 'hono/client';

import type { AppType } from './generated/routes.js';
import { P0sError } from './P0sError.js';
import type { ImageUploadOptions, P0sRpc, TemplateInput, TemplateVars } from './types.js';

/** The multipart body the image routes accept, read from the route itself. */
type ImageForm = InferRequestType<P0sRpc['print']['image']['$post']>['form'];

/** Multipart fields are strings on the wire; unset options are left to the API's defaults. */
function imageForm(image: Blob, options: ImageUploadOptions): ImageForm {
  return {
    image: image as File,
    ...(options.mode && { mode: options.mode }),
    ...(options.width !== undefined && { width: String(options.width) }),
    ...(options.rotate !== undefined && { rotate: String(options.rotate) }),
    ...(options.force && { force: 'true' as const }),
  };
}

/**
 * Client for the p0s API. Requests and responses are typed from the API's own routes (Hono RPC), so the types
 * here are exactly what the server accepts and returns. Failures throw `P0sError` with the API's message.
 *
 * @example
 * const p0s = new P0sClient('http://berry.local:8080/api');
 * await p0s.printTemplate('shopping-list', { items: ['Milk', 'Eggs'] });
 */
export class P0sClient {
  /** The underlying typed RPC client, for anything without a method here. */
  readonly rpc: P0sRpc;

  private readonly baseUrl: string;

  /**
   * @param baseUrl Where the API is, e.g. `http://berry.local:8080/api` (through the web app) or `http://host:3000`.
   * @param options Passed to Hono's client: a custom `fetch`, default `headers`, and so on.
   */
  constructor(baseUrl: string, options?: ClientRequestOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.rpc = hc<AppType>(this.baseUrl, options);
  }

  status() {
    return this.call(this.rpc.status.$get());
  }

  /** Print a ReceiptLine document. */
  print(doc: string) {
    return this.call(this.rpc.print.$post({ json: { doc } }));
  }

  /** Print plain text exactly as written (no ReceiptLine markup). */
  printText(text: string) {
    return this.call(this.rpc.print.text.$post({ json: { text } }));
  }

  /** Print an image (a `File` or `Blob`: PNG, JPEG, WebP…). */
  printImage(image: Blob, options: ImageUploadOptions = {}) {
    return this.call(this.rpc.print.image.$post({ form: imageForm(image, options) }));
  }

  /** Print a saved template. Leave out `vars` to use its saved example values. */
  printTemplate(name: string, vars?: TemplateVars) {
    return this.call(this.rpc.templates[':name'].print.$post({ param: { name }, json: { vars } }));
  }

  jobs(limit: number = 100) {
    return this.call(this.rpc.jobs.$get({ query: { limit: String(limit) } }));
  }

  job(id: string) {
    return this.call(this.rpc.jobs[':id'].$get({ param: { id } }));
  }

  reprint(id: string) {
    return this.call(this.rpc.jobs[':id'].reprint.$post({ param: { id } }));
  }

  async cancel(id: string): Promise<void> {
    await this.call(this.rpc.jobs[':id'].cancel.$post({ param: { id } }));
  }

  /** Render a ReceiptLine document to SVG without printing it. */
  preview(doc: string, signal?: AbortSignal): Promise<string> {
    return this.call(this.rpc.preview.$post({ json: { doc } }, { init: { signal } }));
  }

  previewText(text: string, signal?: AbortSignal): Promise<string> {
    return this.call(this.rpc.preview.text.$post({ json: { text } }, { init: { signal } }));
  }

  previewImage(image: Blob, options: ImageUploadOptions = {}, signal?: AbortSignal) {
    return this.call(this.rpc.preview.image.$post({ form: imageForm(image, options) }, { init: { signal } }));
  }

  templates() {
    return this.call(this.rpc.templates.$get());
  }

  template(name: string) {
    return this.call(this.rpc.templates[':name'].$get({ param: { name } }));
  }

  createTemplate(name: string, input: TemplateInput) {
    return this.call(this.rpc.templates.$post({ json: { name, ...input } }));
  }

  updateTemplate(name: string, input: TemplateInput) {
    return this.call(this.rpc.templates[':name'].$put({ param: { name }, json: input }));
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.call(this.rpc.templates[':name'].$delete({ param: { name } }));
  }

  /** Render an unsaved template with the given values, as SVG. */
  previewTemplateDraft(body: string, vars: TemplateVars, signal?: AbortSignal): Promise<string> {
    return this.call(this.rpc.templates.preview.$post({ json: { body, vars } }, { init: { signal } }));
  }

  /** Absolute URL of an API path, e.g. for links or curl snippets. */
  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /** The server-sent events stream of printer and job updates, for `new EventSource(...)`. */
  eventsUrl(): string {
    return this.url('/events');
  }

  /** Parses the success body (typed by the route), or throws a P0sError carrying the API's `{ error }` message. */
  private async call<R extends ClientResponse<unknown>>(request: Promise<R>): ReturnType<typeof parseResponse<R>> {
    try {
      return await parseResponse(request);
    } catch (err) {
      if (err instanceof DetailedError) {
        const body = err.detail?.data as { error?: string } | undefined;

        throw new P0sError(Number(err.statusCode), body?.error ?? err.message);
      }

      throw err;
    }
  }
}
