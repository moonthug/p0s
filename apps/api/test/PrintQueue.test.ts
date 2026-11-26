import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { Job, JobStatus } from '@p0s/shared';

import { Database } from '../src/db/Database';
import { jobs } from '../src/db/schema';
import { EventBus } from '../src/EventBus';
import { PrintQueue } from '../src/PrintQueue';
import { FakePrinter } from '../src/printer/FakePrinter';

/** How long a job may wait for the printer in these tests (production uses 10 minutes). */
const MAX_WAIT_MS = 1500;

const dir = mkdtempSync(join(tmpdir(), 'p0s-queue-'));
const dbPath = join(dir, 'test.db');

let db: Database;
let printer: FakePrinter;
let bus: EventBus;
let queue: PrintQueue;

const bytes = (label: string) => new TextEncoder().encode(label);
const printedLabels = () => printer.printed.map((b) => new TextDecoder().decode(b));

const enqueue = (label: string) => queue.enqueue({ kind: 'raw', payload: bytes(label) });

async function waitFor(check: () => boolean, timeoutMs: number = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!check()) {
    if (Date.now() > deadline) {
      throw new Error('timed out waiting for condition');
    }

    await sleep(25);
  }
}

const statusOf = (job: Job): JobStatus | undefined => queue.get(job.id)?.status;

beforeAll(async () => {
  db = new Database(dbPath);

  // A job left mid-print by a crash, from before this "restart".
  const now = Date.now();

  db.orm
    .insert(jobs)
    .values({
      id: 'interrupted',
      kind: 'raw',
      status: 'printing',
      payload: Buffer.from('half printed'),
      createdAt: now,
      updatedAt: now,
    })
    .run();

  printer = new FakePrinter(null, 20);
  bus = new EventBus();
  queue = new PrintQueue(db, printer, bus, { dbPath, maxWaitMs: MAX_WAIT_MS, dashboardPort: null });

  await queue.start();
});

afterAll(async () => {
  await queue.stop();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  printer.setFault(null);
  printer.printed.length = 0;
});

describe('PrintQueue', () => {
  it('fails a job that was mid-print when the process stopped, without re-sending it', () => {
    expect(queue.get('interrupted')).toMatchObject({ status: 'failed', error: 'interrupted while printing' });
    expect(printedLabels()).not.toContain('half printed');
  });

  it('prints jobs in the order they were sent', async () => {
    const sent = [await enqueue('one'), await enqueue('two'), await enqueue('three')];

    await waitFor(() => sent.every((job) => statusOf(job) === 'printed'));

    expect(printedLabels()).toEqual(['one', 'two', 'three']);
  });

  it('publishes each status change as it happens', async () => {
    const seen: JobStatus[] = [];
    const job = await enqueue('watched');

    bus.on('event', ({ event }) => {
      if (event.type === 'job' && event.job.id === job.id) {
        seen.push(event.job.status);
      }
    });

    await waitFor(() => statusOf(job) === 'printed');

    expect(seen).toEqual(['printing', 'printed']);
  });

  it('holds jobs while the printer is out of paper, then prints them in order', async () => {
    printer.setFault('paper-out');

    const first = await enqueue('held 1');
    const second = await enqueue('held 2');

    await sleep(600);

    expect([statusOf(first), statusOf(second)]).toEqual(['queued', 'queued']);
    expect(printedLabels()).toEqual([]);
    expect(queue.printerEvent().waiting).toBe('paper-out');

    printer.setFault(null);

    await waitFor(() => statusOf(second) === 'printed');

    expect(printedLabels()).toEqual(['held 1', 'held 2']);
    expect(queue.printerEvent().waiting).toBeNull();
  });

  it('gives up on a job that waits longer than the cutoff', async () => {
    printer.setFault('cover-open');

    const job = await enqueue('too late');

    await waitFor(() => statusOf(job) === 'failed', MAX_WAIT_MS + 3000);

    expect(queue.get(job.id)?.error).toBe('expired: printer cover-open');

    printer.setFault(null);
    await sleep(500);

    expect(printedLabels()).toEqual([]);
  });

  it('cancels jobs before they print, including the one waiting at the head of the queue', async () => {
    printer.setFault('paper-out');

    const head = await enqueue('cancel head');
    const behind = await enqueue('cancel behind');

    await sleep(400); // let the head job start waiting on the printer

    expect(await queue.cancel(behind.id)).toBe(true);
    expect(await queue.cancel(head.id)).toBe(true);

    printer.setFault(null);
    await sleep(800);

    expect([statusOf(head), statusOf(behind)]).toEqual(['cancelled', 'cancelled']);
    expect(printedLabels()).toEqual([]);
  });

  it("won't cancel a job that has already printed", async () => {
    const job = await enqueue('done');

    await waitFor(() => statusOf(job) === 'printed');

    expect(await queue.cancel(job.id)).toBe(false);
  });

  it('reprints a job as a new job with the same bytes', async () => {
    const original = await enqueue('again');

    await waitFor(() => statusOf(original) === 'printed');

    const copy = await queue.reprint(original.id);

    expect(copy?.id).not.toBe(original.id);

    await waitFor(() => copy !== null && statusOf(copy) === 'printed');

    expect(printedLabels()).toEqual(['again', 'again']);
  });

  it('counts jobs by status', async () => {
    const counts = queue.counts();

    expect(counts.printed).toBeGreaterThan(0);
    expect(counts.cancelled).toBe(2);
    expect(counts.failed).toBe(2); // the interrupted job and the expired one
  });
});
