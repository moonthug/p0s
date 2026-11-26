import type { QueryClient } from '@tanstack/react-query';

import type { Job, ServerEvent, StatusResponse } from '@p0s/shared';

import { queryKeys } from './queryKeys';

/**
 * Bridges the API's SSE stream into the TanStack Query cache, so every screen
 * reading `status` or `jobs` updates live without polling.
 */
export class ServerEvents {
  private source: EventSource | null = null;

  constructor(
    private readonly url: string,
    private readonly queryClient: QueryClient,
  ) {}

  connect(onConnectionChange?: (connected: boolean) => void): () => void {
    const source = new EventSource(this.url);
    this.source = source;

    source.addEventListener('open', () => onConnectionChange?.(true));
    source.addEventListener('error', () => onConnectionChange?.(false));
    source.addEventListener('printer', (e) => this.onPrinter(this.parse(e)));
    source.addEventListener('job', (e) => this.onJob(this.parse(e)));

    return () => this.close();
  }

  close(): void {
    this.source?.close();
    this.source = null;
  }

  private parse(e: MessageEvent<string>): ServerEvent {
    return JSON.parse(e.data) as ServerEvent;
  }

  private onPrinter(event: ServerEvent): void {
    if (event.type !== 'printer') {
      return;
    }

    this.queryClient.setQueryData<StatusResponse>(queryKeys.status, (old) =>
      old ? { ...old, printer: event.status, waiting: event.waiting } : old,
    );
  }

  private onJob(event: ServerEvent): void {
    if (event.type !== 'job') {
      return;
    }

    this.queryClient.setQueryData<Job[]>(queryKeys.jobs, (old) => upsert(old ?? [], event.job));

    // Queue counts are derived server-side; refetch rather than recompute here.
    void this.queryClient.invalidateQueries({ queryKey: queryKeys.status });
  }
}

/** Replace the job in place, or add it to the top (newest first). */
function upsert(jobs: Job[], job: Job): Job[] {
  const index = jobs.findIndex((j) => j.id === job.id);

  if (index === -1) {
    return [job, ...jobs];
  }

  return jobs.with(index, job);
}
