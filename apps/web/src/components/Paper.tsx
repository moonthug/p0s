import { useMemo } from 'react';

import { paperLengthCm } from '@/lib/receipt';

type PaperProps = {
  svg: string | undefined;
  loading?: boolean;
  error?: string | null;
  /** Show the printer slot above the strip (the Compose view) or just the strip (inline previews). */
  slot?: boolean;
};

/** A ReceiptLine SVG preview drawn as a strip of thermal paper, optionally feeding out of the printer slot. */
export function Paper({ svg, loading = false, error = null, slot = true }: PaperProps) {
  const src = useMemo(() => (svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null), [svg]);
  const length = svg ? paperLengthCm(svg) : null;

  return (
    <figure className="mx-auto w-full max-w-[480px]">
      {slot && <div className="relative z-10 h-4 rounded-full bg-slot shadow-[inset_0_-3px_0_rgb(255_255_255/0.08)]" />}

      <div className={slot ? '-mt-2 px-3' : ''}>
        {error ? (
          <div className="rounded-b-sm bg-paper px-6 py-10 text-sm text-error shadow-md" role="alert">
            {error}
          </div>
        ) : src ? (
          <img
            key={slot ? 'slot' : src}
            src={src}
            alt="Receipt preview"
            className={`paper-feed block w-full rounded-b-sm bg-paper px-[4%] pb-6 pt-5 shadow-md transition-opacity ${loading ? 'opacity-60' : ''}`}
          />
        ) : (
          <div className="rounded-b-sm bg-paper px-6 py-10 text-center text-sm text-secondary shadow-md">
            Start typing to see the receipt.
          </div>
        )}
      </div>

      {length !== null && (
        <figcaption className="mt-3 text-center text-sm text-secondary">
          About {length.toFixed(1)} cm of paper
        </figcaption>
      )}
    </figure>
  );
}
