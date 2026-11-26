import { type ClientResponse, DetailedError, hc, parseResponse } from 'hono/client';

import type { AppType } from '@p0s/api';
import type { ImageMode, TemplateVars } from '@p0s/shared';

import { ApiError } from './ApiError';

type Client = ReturnType<typeof hc<AppType>>;

export type ImageUploadOptions = {
  mode: ImageMode;
  /** Printed width as a percentage of the paper width */
  width: number;
  rotate: 0 | 90 | 180 | 270;
  force?: boolean;
};

export type TemplateInput = { title: string; body: string; sample: TemplateVars };

/** Multipart fields are strings on the wire. */
function imageForm(image: File, options: ImageUploadOptions) {
  return {
    image,
    mode: options.mode,
    width: String(options.width),
    rotate: String(options.rotate),
    force: options.force ? 'true' : 'false',
  } as const;
}

/**
 * The p0s API, reached through the same-origin `/api` proxy. Requests and responses are
 * typed from the API's own routes via Hono RPC, so a route change breaks the build here.
 */
export class ApiClient {
  private readonly client: Client;

  constructor(private readonly baseUrl: string = `${window.location.origin}/api`) {
    this.client = hc<AppType>(baseUrl);
  }

  status() {
    return this.call(this.client.status.$get());
  }

  jobs(limit: number = 100) {
    return this.call(this.client.jobs.$get({ query: { limit: String(limit) } }));
  }

  print(doc: string) {
    return this.call(this.client.print.$post({ json: { doc } }));
  }

  reprint(id: string) {
    return this.call(this.client.jobs[':id'].reprint.$post({ param: { id } }));
  }

  async cancel(id: string): Promise<void> {
    await this.call(this.client.jobs[':id'].cancel.$post({ param: { id } }));
  }

  /** Renders a ReceiptLine document to SVG markup. */
  preview(doc: string, signal?: AbortSignal): Promise<string> {
    return this.call(this.client.preview.$post({ json: { doc } }, { init: { signal } }));
  }

  printText(text: string) {
    return this.call(this.client.print.text.$post({ json: { text } }));
  }

  previewText(text: string, signal?: AbortSignal): Promise<string> {
    return this.call(this.client.preview.text.$post({ json: { text } }, { init: { signal } }));
  }

  printImage(image: File, options: ImageUploadOptions) {
    return this.call(this.client.print.image.$post({ form: imageForm(image, options) }));
  }

  previewImage(image: File, options: ImageUploadOptions, signal?: AbortSignal) {
    return this.call(this.client.preview.image.$post({ form: imageForm(image, options) }, { init: { signal } }));
  }

  templates() {
    return this.call(this.client.templates.$get());
  }

  template(name: string) {
    return this.call(this.client.templates[':name'].$get({ param: { name } }));
  }

  createTemplate(name: string, input: TemplateInput) {
    return this.call(this.client.templates.$post({ json: { name, ...input } }));
  }

  updateTemplate(name: string, input: TemplateInput) {
    return this.call(this.client.templates[':name'].$put({ param: { name }, json: input }));
  }

  async deleteTemplate(name: string): Promise<void> {
    await this.call(this.client.templates[':name'].$delete({ param: { name } }));
  }

  printTemplate(name: string, vars?: TemplateVars) {
    return this.call(this.client.templates[':name'].print.$post({ param: { name }, json: { vars } }));
  }

  /** Renders an unsaved template body with the given values, for the editor's live preview. */
  previewTemplateDraft(body: string, vars: TemplateVars, signal?: AbortSignal): Promise<string> {
    return this.call(this.client.templates.preview.$post({ json: { body, vars } }, { init: { signal } }));
  }

  /** Absolute URL of the API, for "use from scripts" snippets. */
  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  eventsUrl(): string {
    return `${this.baseUrl}/events`;
  }

  /** Parses the success body (typed by the route), or throws an ApiError carrying the API's `{ error }` message. */
  private async call<R extends ClientResponse<unknown>>(request: Promise<R>): ReturnType<typeof parseResponse<R>> {
    try {
      return await parseResponse(request);
    } catch (err) {
      if (err instanceof DetailedError) {
        const body = err.detail?.data as { error?: string } | undefined;

        throw new ApiError(Number(err.statusCode), body?.error ?? err.message);
      }

      throw err;
    }
  }
}

export const api = new ApiClient();
