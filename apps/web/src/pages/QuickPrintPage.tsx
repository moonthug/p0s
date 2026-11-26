import { RotateCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDebounceValue, useLocalStorage } from 'usehooks-ts';

import type { ImageMode } from '@p0s/shared';

import type { ImageUploadOptions } from '../api/ApiClient';
import { ImageDrop } from '../components/ImageDrop';
import { Paper } from '../components/Paper';
import { PrintBar } from '../components/PrintBar';
import { useImagePreview, usePrintImage, usePrintText, useTextPreview } from '../hooks/queries';
import { useJobProgress } from '../hooks/useJobProgress';
import { errorMessage } from '../lib/errors';

type Tab = 'text' | 'image';

const MODES: { value: ImageMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'photo', label: 'Photo' },
  { value: 'line', label: 'Line art' },
];

const MODE_RESULT: Record<Exclude<ImageMode, 'auto'>, string> = {
  photo: 'Printed as a photo: shades become fine dots.',
  line: 'Printed as line art: pure black and white, sharp edges.',
};

function TextPanel() {
  const [text, setText] = useLocalStorage<string>('p0s:quick-text', '');
  const [debounced] = useDebounceValue<string>(text, 300);

  const preview = useTextPreview(debounced);
  const print = usePrintText();
  const progress = useJobProgress();

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="flex min-w-0 flex-col gap-4">
        <textarea
          className="textarea min-h-80 w-full font-mono text-[0.9375rem]"
          placeholder="Type or paste anything. It prints exactly as written."
          aria-label="Text to print"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <PrintBar
          onPrint={() => print.mutate(text, { onSuccess: progress.track })}
          disabled={!text.trim()}
          pending={print.isPending}
          error={print.error}
          message={progress.message}
        />

        <p className="max-w-prose text-sm text-secondary">
          Lines wrap at 48 characters. Emoji are left out: the printer has no way to draw them.
        </p>
      </section>

      <section aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start lg:pt-2">
        <Paper svg={preview.data} loading={preview.isFetching} error={errorMessage(preview.error, 'Preview failed')} />
      </section>
    </div>
  );
}

function ImagePanel() {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<ImageUploadOptions>({ mode: 'auto', width: 100, rotate: 0 });
  const [debouncedOptions] = useDebounceValue<ImageUploadOptions>(options, 250);

  const preview = useImagePreview(file, debouncedOptions);
  const print = usePrintImage();
  const progress = useJobProgress();

  const set = useCallback((patch: Partial<ImageUploadOptions>) => setOptions((o) => ({ ...o, ...patch })), []);
  const send = (force: boolean) =>
    file && print.mutate({ file, options: { ...options, force } }, { onSuccess: progress.track });

  const result = preview.data;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_480px]">
      <section className="flex min-w-0 flex-col gap-6">
        <ImageDrop file={file} onFile={setFile} />

        <fieldset className="flex flex-wrap items-end gap-x-8 gap-y-5" disabled={!file}>
          <div className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Style</legend>
            <div className="join">
              {MODES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`btn join-item btn-sm ${options.mode === value ? 'btn-neutral' : ''}`}
                  aria-pressed={options.mode === value}
                  onClick={() => set({ mode: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex min-w-48 flex-1 flex-col gap-2">
            <span className="text-sm font-medium">Width: {options.width}% of the paper</span>
            <input
              type="range"
              className="range range-sm"
              min={25}
              max={100}
              step={5}
              value={options.width}
              onChange={(e) => set({ width: Number(e.target.value) })}
            />
          </label>

          <button
            type="button"
            className="btn btn-sm"
            onClick={() => set({ rotate: ((options.rotate + 90) % 360) as ImageUploadOptions['rotate'] })}
          >
            <RotateCw className="size-4" aria-hidden="true" />
            Rotate
          </button>
        </fieldset>

        {result?.tooLong && (
          <div role="alert" className="alert alert-warning alert-soft">
            <span>
              This would use about {result.lengthCm.toFixed(0)} cm of paper. Make it narrower, rotate it, or print it
              anyway.
            </span>
          </div>
        )}

        <PrintBar
          onPrint={() => send(result?.tooLong ?? false)}
          label={result?.tooLong ? 'Print anyway' : 'Print'}
          disabled={!file || preview.isPending}
          pending={print.isPending}
          error={print.error}
          message={progress.message}
        />

        {result && options.mode === 'auto' && <p className="text-sm text-secondary">{MODE_RESULT[result.mode]}</p>}
      </section>

      <section aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start lg:pt-2">
        <Paper
          svg={result?.svg}
          loading={preview.isFetching}
          error={errorMessage(preview.error, "That file couldn't be read as an image")}
          empty="Choose an image to see how it will print."
        />
      </section>
    </div>
  );
}

export function QuickPrintPage() {
  const [tab, setTab] = useState<Tab>('text');

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="tabs tabs-box w-fit">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'text' ? 'tab-active' : ''}`}
          aria-selected={tab === 'text'}
          onClick={() => setTab('text')}
        >
          Text
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'image' ? 'tab-active' : ''}`}
          aria-selected={tab === 'image'}
          onClick={() => setTab('image')}
        >
          Image
        </button>
      </div>

      {tab === 'text' ? <TextPanel /> : <ImagePanel />}
    </div>
  );
}
