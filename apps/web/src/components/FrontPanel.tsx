import type { CSSProperties } from 'react';

import type { PrinterState } from '@/lib/printerState';

type LedProps = { label: string; colour: string; on: boolean; blink?: boolean };

function Led({ label, colour, on, blink = false }: LedProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="led"
        data-on={on}
        data-blink={on && blink}
        style={{ '--led': `var(--led-${colour})` } as CSSProperties}
        aria-hidden="true"
      />
      <span className="text-[0.6875rem] leading-none text-secondary">{label}</span>
    </div>
  );
}

const TONE_TEXT: Record<PrinterState['tone'], string> = {
  ok: 'text-base-content',
  warn: 'text-base-content',
  fault: 'text-error',
};

/** The printer's three front-panel LEDs, lit as the real ones would be, with a plain-language status. */
export function FrontPanel({ state }: { state: PrinterState }) {
  const { leds } = state;

  return (
    <section className="flex items-center gap-5" aria-live="polite" aria-label="Printer status">
      <div className="flex gap-4 rounded-full bg-base-300/70 px-4 py-2 shadow-inner">
        <Led label="Power" colour="power" on={leds.power} />
        <Led label="Error" colour="error" on={leds.error} blink={leds.errorBlink} />
        <Led label="Paper" colour="paper" on={leds.paper} />
      </div>

      <div className="min-w-0">
        <p className={`font-semibold leading-tight ${TONE_TEXT[state.tone]}`}>{state.title}</p>
        <p className="truncate text-sm text-secondary">{state.detail}</p>
      </div>
    </section>
  );
}
