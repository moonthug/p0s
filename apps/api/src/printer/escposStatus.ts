import type { PrinterStatus } from '@p0s/shared';

/**
 * ESC/POS real-time status: `DLE EOT n`.
 * Each reply is one byte matching 0xx1xx10 (bit 1 and bit 4 set, bits 0 and 7 clear).
 */
export const DLE_EOT = (n: 1 | 2 | 3 | 4) => Uint8Array.of(0x10, 0x04, n);

export const isStatusByte = (b: number) => (b & 0x93) === 0x12;

export type RawStatus = { printer: number; offline: number; error: number; paper: number };

export function decodeStatus(raw: RawStatus): Omit<PrinterStatus, 'connected'> {
  return {
    online: (raw.printer & 0x08) === 0, // n=1 bit 3: offline
    coverOpen: (raw.offline & 0x04) !== 0, // n=2 bit 2
    paperOut: (raw.offline & 0x20) !== 0 || (raw.paper & 0x60) !== 0, // n=2 bit 5 / n=4 bits 5,6
    error: (raw.offline & 0x40) !== 0 || (raw.error & 0x68) !== 0, // n=2 bit 6 / n=3 cutter, unrecoverable, auto-recoverable
    paperNearEnd: (raw.paper & 0x0c) !== 0, // n=4 bits 2,3
  };
}
