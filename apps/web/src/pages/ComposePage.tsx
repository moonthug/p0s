import { useCallback } from 'react';
import { useDebounceValue, useLocalStorage } from 'usehooks-ts';

import { Paper } from '../components/Paper';
import { PrintBar } from '../components/PrintBar';
import { ReceiptEditor } from '../components/ReceiptEditor';
import { usePreview, usePrint } from '../hooks/queries';
import { useJobProgress } from '../hooks/useJobProgress';
import { errorMessage } from '../lib/errors';
import { SAMPLE_RECEIPT } from '../lib/receipt';

export function ComposePage() {
  const [draft, setDraft] = useLocalStorage<string>('p0s:draft', SAMPLE_RECEIPT);
  const [doc] = useDebounceValue<string>(draft, 300);
  const preview = usePreview(doc);
  const print = usePrint();
  const progress = useJobProgress();

  const send = useCallback(() => {
    if (draft.trim() && !print.isPending) {
      print.mutate(draft, { onSuccess: progress.track });
    }
  }, [draft, print, progress.track]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="flex min-w-0 flex-col gap-4">
        <div className="rounded-box border border-base-300 bg-base-100 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <ReceiptEditor value={draft} onChange={setDraft} onSubmit={send} />
        </div>

        <PrintBar
          onPrint={send}
          disabled={!draft.trim()}
          pending={print.isPending}
          error={print.error}
          message={progress.message}
        >
          <span className="ml-auto hidden text-sm text-secondary sm:inline">
            <kbd className="kbd kbd-sm">⌘</kbd> <kbd className="kbd kbd-sm">Enter</kbd> to print
          </span>
        </PrintBar>

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

      <section aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start lg:pt-2">
        <Paper svg={preview.data} loading={preview.isFetching} error={errorMessage(preview.error, 'Preview failed')} />
      </section>
    </div>
  );
}
