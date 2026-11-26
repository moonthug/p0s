import type { JobCounts, PrinterStatus } from '@p0s/shared';

export type Tone = 'ok' | 'warn' | 'fault';

export type PrinterState = {
  tone: Tone;
  title: string;
  detail: string;
  leds: { power: boolean; error: boolean; errorBlink: boolean; paper: boolean };
};

/** Turns raw status into what the front panel shows and what to tell the person. */
export function describePrinter(printer: PrinterStatus, queue: JobCounts, reachable: boolean): PrinterState {
  const leds = {
    power: printer.connected,
    error: printer.connected && (!printer.online || printer.error || printer.coverOpen || printer.paperOut),
    errorBlink: printer.error,
    paper: printer.connected && (printer.paperNearEnd || printer.paperOut),
  };

  const held = queue.queued > 0 ? ` ${plural(queue.queued, 'job is', 'jobs are')} held until then.` : '';

  if (!reachable) {
    return {
      tone: 'fault',
      title: "Can't reach p0s",
      detail: "The server isn't responding. Anything you print will wait until it's back.",
      leds: { power: false, error: false, errorBlink: false, paper: false },
    };
  }

  if (!printer.connected) {
    return {
      tone: 'fault',
      title: 'Printer not found',
      detail: `Check that it's switched on and the USB cable is plugged in.${held}`,
      leds,
    };
  }

  if (printer.paperOut) {
    return {
      tone: 'fault',
      title: 'Out of paper',
      detail: `Load a new 80 mm roll, with the paper coming off the bottom.${held}`,
      leds,
    };
  }

  if (printer.coverOpen) {
    return { tone: 'fault', title: 'Cover open', detail: `Close the cover until it clicks.${held}`, leds };
  }

  if (printer.error) {
    return {
      tone: 'fault',
      title: 'Printer error',
      detail: `Open the cover and clear any paper caught at the cutter.${held}`,
      leds,
    };
  }

  if (!printer.online) {
    return {
      tone: 'fault',
      title: "Printer isn't responding",
      detail: `Turn it off and on again.${held}`,
      leds,
    };
  }

  return {
    tone: printer.paperNearEnd ? 'warn' : 'ok',
    title: printer.paperNearEnd ? 'Ready, paper running low' : 'Ready',
    detail: describeQueue(queue),
    leds,
  };
}

function describeQueue(queue: JobCounts): string {
  if (queue.printing > 0 && queue.queued > 0) {
    return `Printing now, ${queue.queued} waiting.`;
  }

  if (queue.printing > 0) {
    return 'Printing now.';
  }

  if (queue.queued > 0) {
    return `${plural(queue.queued, 'job', 'jobs')} waiting.`;
  }

  return 'Nothing in the queue.';
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
