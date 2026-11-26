import type { EventEmitter } from 'node:events';

import type { PrinterStatus } from '@p0s/shared';

export type PrinterEvents = { status: [PrinterStatus] };

export interface Printer extends EventEmitter<PrinterEvents> {
  /** Start connecting / polling. Never throws if the device is absent. */
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Same as stop(); lets the DI container release the device on shutdown. */
  [Symbol.asyncDispose](): Promise<void>;
  /** Send bytes to the printer. Rejects on timeout or disconnect. */
  write(bytes: Uint8Array): Promise<void>;
  readonly status: PrinterStatus;
}

export const DISCONNECTED: PrinterStatus = {
  connected: false,
  online: false,
  coverOpen: false,
  paperNearEnd: false,
  paperOut: false,
  error: false,
};

export const sameStatus = (a: PrinterStatus, b: PrinterStatus) =>
  (Object.keys(a) as (keyof PrinterStatus)[]).every((k) => a[k] === b[k]);
