import { describe, expect, it } from 'vitest';

import type { JobCounts, PrinterStatus } from '@p0s/shared';

import { describePrinter } from '../src/lib/printerState';

const READY: PrinterStatus = {
  connected: true,
  online: true,
  coverOpen: false,
  paperNearEnd: false,
  paperOut: false,
  error: false,
};

const EMPTY: JobCounts = { queued: 0, printing: 0, printed: 0, failed: 0, cancelled: 0 };

describe('describePrinter', () => {
  it('shows only the power light when ready', () => {
    const state = describePrinter(READY, EMPTY, true);

    expect(state).toMatchObject({ tone: 'ok', title: 'Ready', detail: 'Nothing in the queue.' });
    expect(state.leds).toEqual({ power: true, error: false, errorBlink: false, paper: false });
  });

  it('lights error and paper together when out of paper, as the real printer does', () => {
    const state = describePrinter({ ...READY, online: false, paperOut: true }, { ...EMPTY, queued: 2 }, true);

    expect(state.title).toBe('Out of paper');
    expect(state.detail).toContain('2 jobs are held until then.');
    expect(state.leds).toMatchObject({ power: true, error: true, paper: true });
  });

  it('warns when paper is running low but keeps printing', () => {
    const state = describePrinter({ ...READY, paperNearEnd: true }, EMPTY, true);

    expect(state).toMatchObject({ tone: 'warn', title: 'Ready, paper running low' });
    expect(state.leds.paper).toBe(true);
  });

  it('blinks the error light for a cutter or head error', () => {
    const state = describePrinter({ ...READY, online: false, error: true }, EMPTY, true);

    expect(state.title).toBe('Printer error');
    expect(state.leds).toMatchObject({ error: true, errorBlink: true });
  });

  it('turns every light off when the printer is unplugged', () => {
    const state = describePrinter({ ...READY, connected: false, online: false }, EMPTY, true);

    expect(state.title).toBe('Printer not found');
    expect(state.leds).toEqual({ power: false, error: false, errorBlink: false, paper: false });
  });

  it("says when the server itself can't be reached", () => {
    expect(describePrinter(READY, EMPTY, false).title).toBe("Can't reach p0s");
  });

  it('describes a busy queue', () => {
    expect(describePrinter(READY, { ...EMPTY, printing: 1, queued: 3 }, true).detail).toBe('Printing now, 3 waiting.');
  });
});
