import { EventEmitter } from 'node:events';

import { Mutex } from 'async-mutex';
import { type Device, findByIds, type InEndpoint, type Interface, type OutEndpoint, usb } from 'usb';

import type { PrinterStatus } from '@p0s/shared';

import { DLE_EOT, decodeStatus, isStatusByte } from './escposStatus';
import { DISCONNECTED, type Printer, type PrinterEvents, sameStatus } from './types';

export type UsbPrinterOptions = {
  vendorId: number;
  productId: number;
  /** How often to poll status / retry connecting while idle */
  pollMs?: number;
  /** Per-chunk write timeout */
  writeTimeoutMs?: number;
};

const CHUNK = 4096;
const READ_TIMEOUT_MS = 300;

type Conn = { device: Device; iface: Interface; out: OutEndpoint; inp: InEndpoint };

export class UsbPrinter extends EventEmitter<PrinterEvents> implements Printer {
  private conn: Conn | null = null;
  private current: PrinterStatus = DISCONNECTED;
  private timer: NodeJS.Timeout | null = null;
  private lock = new Mutex();
  private opts: Required<UsbPrinterOptions>;

  constructor(opts: UsbPrinterOptions) {
    super();
    this.opts = { pollMs: 2000, writeTimeoutMs: 10_000, ...opts };
  }

  get status() {
    return this.current;
  }

  async start() {
    usb.on('attach', this.onAttach);
    usb.on('detach', this.onDetach);
    usb.unrefHotplugEvents();

    await this.tick();
    this.timer = setInterval(() => void this.tick(), this.opts.pollMs);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    usb.off('attach', this.onAttach);
    usb.off('detach', this.onDetach);

    await this.lock.runExclusive(() => this.close());
  }

  async [Symbol.asyncDispose]() {
    await this.stop();
  }

  async write(bytes: Uint8Array) {
    await this.lock.runExclusive(async () => {
      const conn = this.conn ?? this.open();
      if (!conn) {
        throw new Error('printer not connected');
      }

      try {
        for (let i = 0; i < bytes.length; i += CHUNK) {
          await conn.out.transferAsync(Buffer.from(bytes.subarray(i, i + CHUNK)));
        }
      } catch (err) {
        // A failed write leaves the device in an unknown state; reconnect on next tick.
        await this.close();
        throw err;
      }
    });
  }

  private onAttach = (d: Device) => {
    if (this.matches(d)) {
      void this.tick();
    }
  };

  private onDetach = (d: Device) => {
    if (this.conn && this.matches(d)) {
      void this.lock.runExclusive(() => this.close());
    }
  };

  private matches(d: Device) {
    const { idVendor, idProduct } = d.deviceDescriptor;

    return idVendor === this.opts.vendorId && idProduct === this.opts.productId;
  }

  /** Poll status (or reconnect). Skipped while a write holds the lock. */
  private async tick() {
    if (this.lock.isLocked()) {
      return;
    }

    await this.lock.runExclusive(async () => {
      const conn = this.conn ?? this.open();
      if (!conn) {
        return this.setStatus(DISCONNECTED);
      }

      try {
        const raw = {
          printer: await this.query(conn, 1),
          offline: await this.query(conn, 2),
          error: await this.query(conn, 3),
          paper: await this.query(conn, 4),
        };
        this.setStatus({ connected: true, ...decodeStatus(raw) });
      } catch {
        // No reply: the printer is attached but not answering (wedged / powered off).
        this.setStatus({ ...DISCONNECTED, connected: true });
      }
    });
  }

  private async query(conn: Conn, n: 1 | 2 | 3 | 4): Promise<number> {
    await this.drain(conn);
    await conn.out.transferAsync(Buffer.from(DLE_EOT(n)));

    const deadline = Date.now() + 1000;

    while (Date.now() < deadline) {
      const buf = await this.read(conn);
      const byte = buf && [...buf].reverse().find(isStatusByte);
      if (byte !== undefined) {
        return byte;
      }
    }

    throw new Error(`no reply to DLE EOT ${n}`);
  }

  /** Discard stale replies so they can't be mistaken for the next query's answer. */
  private async drain(conn: Conn) {
    for (let i = 0; i < 8; i++) {
      const buf = await this.read(conn);
      if (!buf || buf.length === 0) {
        return;
      }
    }
  }

  private async read(conn: Conn): Promise<Buffer | undefined> {
    try {
      return await conn.inp.transferAsync(64);
    } catch (err) {
      if ((err as { errno?: number }).errno === usb.LIBUSB_ERROR_TIMEOUT) {
        return undefined;
      }

      throw err;
    }
  }

  private open(): Conn | null {
    const device = findByIds(this.opts.vendorId, this.opts.productId);
    if (!device) {
      return null;
    }

    try {
      device.open();

      try {
        device.setAutoDetachKernelDriver(true); // Linux usblp; unsupported on macOS
      } catch {}

      const iface = device.interfaces?.[0];
      if (!iface) {
        throw new Error('no USB interface');
      }

      iface.claim();

      const out = iface.endpoints.find((e) => e.direction === 'out') as OutEndpoint | undefined;
      const inp = iface.endpoints.find((e) => e.direction === 'in') as InEndpoint | undefined;
      if (!out || !inp) {
        throw new Error('missing bulk endpoints');
      }

      out.timeout = this.opts.writeTimeoutMs;
      inp.timeout = READ_TIMEOUT_MS;
      this.conn = { device, iface, out, inp };

      return this.conn;
    } catch (err) {
      console.warn('[printer] open failed:', (err as Error).message);

      try {
        device.close();
      } catch {}

      return null;
    }
  }

  private async close() {
    const conn = this.conn;
    this.conn = null;

    if (conn) {
      try {
        await conn.iface.releaseAsync();
      } catch {}

      try {
        conn.device.close();
      } catch {}
    }

    this.setStatus(DISCONNECTED);
  }

  private setStatus(next: PrinterStatus) {
    if (sameStatus(next, this.current)) {
      return;
    }

    this.current = next;
    this.emit('status', next);
  }
}
