import type { JobStatus as Status } from '@p0s/shared';

const STYLES: Record<Status, { label: string; className: string }> = {
  queued: { label: 'Waiting', className: 'badge-ghost' },
  printing: { label: 'Printing', className: 'badge-info' },
  printed: { label: 'Printed', className: 'badge-success badge-soft' },
  failed: { label: 'Failed', className: 'badge-error' },
  cancelled: { label: 'Cancelled', className: 'badge-ghost opacity-60' },
};

export function JobStatus({ status }: { status: Status }) {
  const { label, className } = STYLES[status];

  return <span className={`badge badge-sm ${className}`}>{label}</span>;
}
