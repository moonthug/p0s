import { useState } from 'react';

import type { Job } from '@p0s/shared';

import { useJobs, useStatus } from './queries';

const WAITING_REASONS: Record<string, string> = {
  'paper-out': 'out of paper',
  'cover-open': 'cover open',
  disconnected: 'printer not found',
  offline: "printer isn't responding",
  error: 'printer error',
};

/** What happened to a job, in plain words. */
function describeJob(job: Job | null, waiting: string | null): string | null {
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

/** Follows the last job a page sent, using the live job list kept up to date over SSE. */
export function useJobProgress() {
  const [tracked, setTracked] = useState<Job | null>(null);
  const { data: jobs } = useJobs();
  const { data: status } = useStatus();

  const job = jobs?.find((j) => j.id === tracked?.id) ?? tracked;

  return {
    track: setTracked,
    message: describeJob(job, status?.waiting ?? null),
  };
}
