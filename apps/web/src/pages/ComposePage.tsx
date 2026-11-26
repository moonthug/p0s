import { Printer } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDebounceValue, useLocalStorage } from 'usehooks-ts';

import type { Job } from '@p0s/shared';

import { ApiError } from '@/api/ApiError';
import { Paper } from '@/components/Paper';
import { ReceiptEditor } from '@/components/ReceiptEditor';
import { useJobs, usePreview, usePrint, useStatus } from '@/hooks/queries';
import { SAMPLE_RECEIPT } from '@/lib/receipt';

const WAITING_REASONS: Record<string, string> = {
  'paper-out': 'out of paper',
  'cover-open': 'cover open',
  disconnected: 'printer not found',
  offline: "printer isn't responding",
  error: 'printer error',
};

/** What happened to the job this page last sent, in plain words. */
function describeJob(job: Job | undefined, waiting: string | null): string | null {
  if (!job) {
    return null;
  }

  switch (job.status) {
    case 'queued':
      return waiting ? `Waiting: ${WAITING_REASONS[waiting] ?? waiting}` : 'Sent to the printer';
    case 'printing':
      return 'Printing…';
    case 'printed':
      return 'Printed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return `Didn't print: ${job.error ?? 'unknown error'}`;
  }
}

export function ComposePage() {
  const [draft, setDraft] = useLocalStorage<string>('p0s:draft', SAMPLE_RECEIPT);
  const [doc] = useDebounceValue<string>(draft, 300);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const preview = usePreview(doc);
  const print = usePrint();
  const { data: jobs } = useJobs();
  const { data: status } = useStatus();

  const lastJob = jobs?.find((j) => j.id === lastJobId) ?? print.data;
  const jobMessage = describeJob(lastJob, status?.waiting ?? null);
  const previewError =
    preview.error instanceof ApiError ? preview.error.message : preview.error ? 'Preview failed' : null;

  const send = useCallback(() => {
    if (draft.trim() && !print.isPending) {
      print.mutate(draft, { onSuccess: (job) => setLastJobId(job.id) });
    }
  }, [draft, print]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="rounded-box border border-base-300 bg-base-100 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <ReceiptEditor value={draft} onChange={setDraft} onSubmit={send} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary" onClick={send} disabled={!draft.trim() || print.isPending}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </button>

          <span className="text-sm text-secondary" aria-live="polite">
            {print.error ? `Couldn't send: ${print.error.message}` : jobMessage}
          </span>

          <span className="ml-auto hidden text-sm text-secondary sm:inline">
            <kbd className="kbd kbd-sm">⌘</kbd> <kbd className="kbd kbd-sm">Enter</kbd> to print
          </span>
        </div>

        <p className="max-w-prose text-sm text-secondary">
          Columns are split with <code className="font-mono">|</code>, a line of <code className="font-mono">-</code>{' '}
          draws a rule and <code className="font-mono">=</code> cuts the paper. See the{' '}
          <a
            className="link"
            href="https://github.com/receiptline/receiptline#grammar"
            target="_blank"
            rel="noreferrer"
          >
            ReceiptLine reference
          </a>{' '}
          for sizes, barcodes and QR codes.
        </p>
      </section>

      <section aria-label="Preview" className="lg:pt-2">
        <Paper svg={preview.data} loading={preview.isFetching} error={previewError} />
      </section>
    </div>
  );
}
