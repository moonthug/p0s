import type { Job, PrintRequest, StatusResponse } from '@p0s/shared';

import { ApiError } from '@/api/ApiError';

/** Typed client for the p0s API, reached through the same-origin `/api` proxy. */
export class ApiClient {
  constructor(private readonly baseUrl: string = '/api') {}

  status(): Promise<StatusResponse> {
    return this.json('/status');
  }

  jobs(limit: number = 100): Promise<Job[]> {
    return this.json(`/jobs?limit=${limit}`);
  }

  print(request: PrintRequest): Promise<Job> {
    return this.json('/print', { method: 'POST', body: JSON.stringify(request) });
  }

  reprint(id: string): Promise<Job> {
    return this.json(`/jobs/${id}/reprint`, { method: 'POST' });
  }

  async cancel(id: string): Promise<void> {
    await this.json(`/jobs/${id}/cancel`, { method: 'POST' });
  }

  /** Renders a ReceiptLine document to SVG markup. */
  async preview(request: PrintRequest, signal?: AbortSignal): Promise<string> {
    const res = await this.request('/preview', { method: 'POST', body: JSON.stringify(request), signal });

    return res.text();
  }

  eventsUrl(): string {
    return `${this.baseUrl}/events`;
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.request(path, init);

    return (await res.json()) as T;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;

      throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
    }

    return res;
  }
}

export const api = new ApiClient();
