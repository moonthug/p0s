import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { desc, eq } from 'drizzle-orm';
import { Sidequest } from 'sidequest';

import { isReady, type Job, type JobCounts, type JobKind, type JobStatus, notReadyReason } from '@p0s/shared';

import type { Database } from './db/Database';
import { type JobRow, jobs } from './db/schema';
import type { EventBus } from './EventBus';
import { PrintJob } from './PrintJob';
import type { Printer } from './printer';

export type EnqueueInput = {
  kind: JobKind;
  payload: Uint8Array;
  source?: string | null;
  image?: Buffer | null;
  template?: string | null;
  vars?: Record<string, unknown> | null;
};

export type PrintQueueOptions = {
  /** SQLite file Sidequest stores its own tables in (the app's database) */
  dbPath: string;
  maxWaitMs: number;
  /** Port for Sidequest's dashboard; null disables it */
  dashboardPort: number | null;
};

const QUEUE = 'print';
/** Headroom beyond the max wait for the USB write itself. */
const WRITE_HEADROOM_MS = 120_000;

const toJob = (r: JobRow): Job => ({
  id: r.id,
  kind: r.kind,
  status: r.status,
  source: r.source,
  error: r.error,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

/**
 * Sidequest-backed print queue. It runs inline in this process, using the app's SQLite file,
 * with one queue at concurrency 1.
 *
 * - Our `jobs` table is the source of truth for history and status. Sidequest drives execution,
 *   and the processor skips anything that isn't `queued`, so a duplicate delivery is harmless.
 * - Hold & resume: the head job waits (still running, so order is kept) until the printer is
 *   ready, its deadline passes, or it's cancelled. Cancels reach it via `abortSignal`.
 */
export class PrintQueue {
  private waiting: string | null = null;

  constructor(
    private readonly db: Database,
    private readonly printer: Printer,
    private readonly bus: EventBus,
    private readonly options: PrintQueueOptions,
  ) {}

  async start() {
    const { dbPath, maxWaitMs, dashboardPort } = this.options;
    const window = maxWaitMs + WRITE_HEADROOM_MS;

    this.failInterrupted();
    PrintJob.processor = (id, signal) => this.process(id, signal);
    this.printer.on('status', () => this.publishPrinter());

    await Sidequest.start({
      backend: { driver: '@sidequest/sqlite-backend', config: dbPath },
      fork: false,
      runner: 'inline',
      maxConcurrentJobs: 1,
      queues: [{ name: QUEUE, concurrency: 1 }],
      jobDefaults: { queue: QUEUE, maxAttempts: 1, timeout: window },
      // The head job may legitimately run for the whole wait window; don't treat it as stale.
      releaseStaleJobsMaxStaleMs: window + 60_000,
      jobPollingInterval: 250,
      gracefulShutdown: false,
      logger: { level: 'warn' },
      dashboard: dashboardPort ? { enabled: true, port: dashboardPort } : { enabled: false },
    });
  }

  async stop() {
    await Sidequest.stop();
    PrintJob.processor = null;
  }

  /** Lets the DI container stop the queue on shutdown. */
  async [Symbol.asyncDispose]() {
    await this.stop();
  }

  printerEvent() {
    return { type: 'printer' as const, status: this.printer.status, waiting: this.waiting };
  }

  async enqueue(input: EnqueueInput): Promise<Job> {
    const now = Date.now();
    const row: JobRow = {
      id: randomUUID(),
      kind: input.kind,
      status: 'queued',
      source: input.source ?? null,
      image: input.image ?? null,
      template: input.template ?? null,
      vars: input.vars ?? null,
      payload: Buffer.from(input.payload),
      queueJobId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };

    this.orm.insert(jobs).values(row).run();

    const queued = await Sidequest.build(PrintJob).enqueue(row.id);
    this.orm.update(jobs).set({ queueJobId: queued.id }).where(eq(jobs.id, row.id)).run();

    const job = toJob(row);
    this.bus.publish({ type: 'job', job });

    return job;
  }

  async reprint(id: string): Promise<Job | null> {
    const row = this.row(id);

    return row ? this.enqueue(row) : null;
  }

  /** Cancel a job that hasn't started printing. Returns false if it's too late. */
  async cancel(id: string): Promise<boolean> {
    const row = this.row(id);
    if (row?.status !== 'queued') {
      return false;
    }

    this.setStatus(id, 'cancelled');
    if (row.queueJobId !== null) {
      await Sidequest.job.cancel(row.queueJobId);
    }

    return true;
  }

  get(id: string): Job | null {
    const row = this.row(id);

    return row ? toJob(row) : null;
  }

  list(limit = 50): Job[] {
    return this.orm.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit).all().map(toJob);
  }

  /** Counts by status from our own table (the source of truth). */
  counts(): JobCounts {
    const counts: JobCounts = { queued: 0, printing: 0, printed: 0, failed: 0, cancelled: 0 };

    for (const { status } of this.orm.select({ status: jobs.status }).from(jobs).all()) {
      counts[status]++;
    }

    return counts;
  }

  private get orm() {
    return this.db.orm;
  }

  private async process(id: string, signal: AbortSignal): Promise<string | null> {
    const row = this.row(id);

    if (row?.status !== 'queued') {
      return null; // cancelled, or a duplicate delivery
    }

    // Our row is the source of truth for cancellation: Sidequest's abort doesn't reliably reach a running inline job.
    const cancelled = () => signal.aborted || this.row(id)?.status !== 'queued';

    try {
      await this.waitUntilReady(row.createdAt + this.options.maxWaitMs, cancelled);
    } catch (err) {
      const message = (err as Error).message;
      if (this.row(id)?.status === 'queued') {
        this.setStatus(id, 'failed', message);
      }

      return message;
    } finally {
      this.setWaiting(null);
    }

    // Last check before any bytes go out: once they're sent, the job can't be taken back.
    if (cancelled()) {
      return null;
    }

    this.setStatus(id, 'printing');

    try {
      await this.printer.write(row.payload);
      this.setStatus(id, 'printed');

      return null;
    } catch (err) {
      const message = (err as Error).message;
      this.setStatus(id, 'failed', message);

      return message;
    }
  }

  private async waitUntilReady(deadline: number, cancelled: () => boolean) {
    const { printer } = this;

    while (!isReady(printer.status)) {
      if (cancelled()) {
        throw new Error('cancelled');
      }

      if (Date.now() >= deadline) {
        throw new Error(`expired: printer ${notReadyReason(printer.status)}`);
      }

      this.setWaiting(notReadyReason(printer.status));
      await sleep(250);
    }
  }

  /** Jobs left `printing` by a crash may be partly on paper; never re-send them. */
  private failInterrupted() {
    this.orm
      .update(jobs)
      .set({ status: 'failed', error: 'interrupted while printing', updatedAt: Date.now() })
      .where(eq(jobs.status, 'printing'))
      .run();
  }

  private row(id: string) {
    return this.orm.select().from(jobs).where(eq(jobs.id, id)).get();
  }

  private setStatus(id: string, status: JobStatus, error: string | null = null) {
    const row = this.orm
      .update(jobs)
      .set({ status, error, updatedAt: Date.now() })
      .where(eq(jobs.id, id))
      .returning()
      .get();
    if (row) {
      this.bus.publish({ type: 'job', job: toJob(row) });
    }
  }

  private setWaiting(reason: string | null) {
    if (reason === this.waiting) {
      return;
    }

    this.waiting = reason;
    this.publishPrinter();
  }

  private publishPrinter() {
    this.bus.publish(this.printerEvent());
  }
}
