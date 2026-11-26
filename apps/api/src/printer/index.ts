import type { Config } from '../config';
import { FakePrinter } from './FakePrinter';
import type { Printer } from './types';
import { UsbPrinter } from './UsbPrinter';

export { FakePrinter } from './FakePrinter';
export type { Printer } from './types';

export const createPrinter = (cfg: Config): Printer =>
  cfg.PRINTER === 'fake'
    ? new FakePrinter(cfg.FAKE_FAULT ?? null, 300)
    : new UsbPrinter({ vendorId: cfg.USB_VENDOR_ID, productId: cfg.USB_PRODUCT_ID });
