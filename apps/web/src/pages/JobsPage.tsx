import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

import type { Job } from '@p0s/shared';

import { JobStatus } from '@/components/JobStatus';
import { Paper } from '@/components/Paper';
import { useCancel, useJobs, usePreview, useReprint } from '@/hooks/queries';
import { receiptTitle } from '@/lib/receipt';

const KIND_LABELS: Record<Job['kind'], string> = {
  receiptline: 'Receipt',
  text: 'Text',
  image: 'Image',
  raw: 'Raw bytes',
  template: 'Template',
};

const relative = new Intl.RelativeTimeFormat('en-GB', { numeric: 'auto' });

function timeAgo(ms: number): string {
  const seconds = Math.round((ms - Date.now()) / 1000);

  if (Math.abs(seconds) < 60) {
    return relative.format(seconds, 'second');
  }

  if (Math.abs(seconds) < 3600) {
    return relative.format(Math.round(seconds / 60), 'minute');
  }

  if (Math.abs(seconds) < 86_400) {
    return relative.format(Math.round(seconds / 3600), 'hour');
  }

  return new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function JobPreview({ source }: { source: string }) {
  const preview = usePreview(source);

  return <Paper svg={preview.data} loading={preview.isFetching} slot={false} />;
}

function JobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState<boolean>(false);
  const reprint = useReprint();
  const cancel = useCancel();

  const title = receiptTitle(job.source) ?? KIND_LABELS[job.kind];
  const canPreview = job.source !== null && (job.kind === 'receiptline' || job.kind === 'template');

  return (
    <li className="border-b border-base-300 last:border-b-0">
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
          onClick={() => setOpen((o) => !o)}
          disabled={!canPreview}
          aria-expanded={canPreview ? open : undefined}
        >
          <ChevronRight
            className={`size-4 shrink-0 text-secondary transition-transform ${open ? 'rotate-90' : ''} ${canPreview ? '' : 'invisible'}`}
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block truncate font-medium">{title}</span>
            <span className="flex flex-wrap items-center gap-x-2 text-sm text-secondary">
              {KIND_LABELS[job.kind]}, {timeAgo(job.createdAt)}
              <span className="sm:hidden">
                <JobStatus status={job.status} />
              </span>
            </span>
          </span>
        </button>

        <span className="hidden sm:inline-flex">
          <JobStatus status={job.status} />
        </span>

        <div className="flex shrink-0 justify-end gap-1 sm:w-36">
          {job.status === 'queued' && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => cancel.mutate(job.id)}
              disabled={cancel.isPending}
            >
              Cancel
            </button>
          )}
          {(job.status === 'printed' || job.status === 'failed' || job.status === 'cancelled') && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => reprint.mutate(job.id)}
              disabled={reprint.isPending}
            >
              Print again
            </button>
          )}
        </div>
      </div>

      {job.status === 'failed' && job.error && <p className="px-11 pb-3 text-sm text-error">{job.error}</p>}

      {open && job.source && (
        <div className="bg-base-200/60 px-4 py-6">
          <JobPreview source={job.source} />
        </div>
      )}
    </li>
  );
}

export function JobsPage() {
  const { data: jobs, isPending, error } = useJobs();

  if (isPending) {
    return <p className="text-secondary">Loading jobs…</p>;
  }

  if (error) {
    return <p className="text-error">Couldn't load jobs: {error.message}</p>;
  }

  if (jobs.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg font-semibold">Nothing printed yet</p>
        <p className="mt-1 text-secondary">
          <Link href="/" className="link">
            Compose a receipt
          </Link>{' '}
          and it will show up here.
        </p>
      </div>
    );
  }

  return (
    <ul className="mx-auto max-w-3xl rounded-box border border-base-300 bg-base-100">
      {jobs.map((job) => (
        <JobRow key={job.id} job={job} />
      ))}
    </ul>
  );
}
