import { EventEmitter } from 'node:events';

import type { PrinterStatus } from '@p0s/shared';
import { isReady } from '@p0s/shared';

import { DISCONNECTED, type Printer, type PrinterEvents, sameStatus } from './types';

export type FakeFault = 'paper-out' | 'cover-open' | 'offline' | 'disconnected' | null;

const READY: PrinterStatus = { ...DISCONNECTED, connected: true, online: true };

/** In-memory printer for tests and UI development. */
export class FakePrinter extends EventEmitter<PrinterEvents> implements Printer {
  readonly printed: Uint8Array[] = [];
  private current: PrinterStatus = READY;

  constructor(
    fault: FakeFault = null,
    private readonly latencyMs = 0,
  ) {
    super();
    this.setFault(fault);
  }

  get status() {
    return this.current;
  }

  async start() {}
  async stop() {}

  async [Symbol.asyncDispose]() {
    await this.stop();
  }

  async write(bytes: Uint8Array) {
    if (!isReady(this.current)) {
      throw new Error('printer not ready');
    }

    if (this.latencyMs) {
      await new Promise((r) => setTimeout(r, this.latencyMs));
    }

    this.printed.push(bytes);
  }

  setFault(fault: FakeFault) {
    const next: PrinterStatus =
      fault === 'paper-out'
        ? { ...READY, online: false, paperOut: true }
        : fault === 'cover-open'
          ? { ...READY, online: false, coverOpen: true }
          : fault === 'offline'
            ? { ...READY, online: false }
            : fault === 'disconnected'
              ? DISCONNECTED
              : READY;

    if (sameStatus(next, this.current)) {
      return;
    }

    this.current = next;
    this.emit('status', next);
  }
}
