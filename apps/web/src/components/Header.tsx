import { Link } from 'wouter';

import { FrontPanel } from '@/components/FrontPanel';
import { useStatus } from '@/hooks/queries';
import { describePrinter } from '@/lib/printerState';

const NAV = [
  { href: '/', label: 'Compose' },
  { href: '/jobs', label: 'Jobs' },
];

export function Header({ reachable }: { reachable: boolean }) {
  const { data: status, isError } = useStatus();

  const state = status ? describePrinter(status.printer, status.queue, reachable && !isError) : null;

  return (
    <header className="border-b border-base-300 bg-base-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-3">
        <span className="text-xl font-bold tracking-tight">p0s</span>

        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          {state ? <FrontPanel state={state} /> : <span className="text-sm text-secondary">Connecting…</span>}
        </div>

        <nav className="ml-auto flex gap-1" aria-label="Main">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={(active: boolean) => `btn btn-sm ${active ? 'btn-neutral' : 'btn-ghost'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
