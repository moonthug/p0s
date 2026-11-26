import type { Config } from '@/config';
import { FakePrinter } from '@/printer/FakePrinter';
import type { Printer } from '@/printer/types';
import { UsbPrinter } from '@/printer/UsbPrinter';

export { FakePrinter } from '@/printer/FakePrinter';
export type { Printer } from '@/printer/types';

export const createPrinter = (cfg: Config): Printer =>
  cfg.PRINTER === 'fake'
    ? new FakePrinter(cfg.FAKE_FAULT ?? null, 300)
    : new UsbPrinter({ vendorId: cfg.USB_VENDOR_ID, productId: cfg.USB_PRODUCT_ID });
