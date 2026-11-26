import { Printer } from 'lucide-react';
import type { ReactNode } from 'react';

type PrintBarProps = {
  onPrint: () => void;
  disabled?: boolean;
  pending?: boolean;
  /** Why the last send failed, if it did */
  error?: Error | null;
  /** Progress of the last job sent */
  message?: string | null;
  label?: string;
  /** Extra controls after the progress message (e.g. a keyboard hint) */
  children?: ReactNode;
};

/** The primary Print button, with the last job's progress beside it. */
export function PrintBar({ onPrint, disabled, pending, error, message, label = 'Print', children }: PrintBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <button type="button" className="btn btn-primary" onClick={onPrint} disabled={disabled || pending}>
        <Printer className="size-4" aria-hidden="true" />
        {label}
      </button>

      <span className="text-sm text-secondary" aria-live="polite">
        {error ? `Couldn't send: ${error.message}` : message}
      </span>

      {children}
    </div>
  );
}
