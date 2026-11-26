/**
 * Manual hardware check (never run in CI): prints a calibration receipt
 * straight through UsbPrinter, bypassing Redis/the queue.
 */
import { isReady, notReadyReason } from '@p0s/shared';

import { UsbPrinter } from '@/printer/UsbPrinter';
import { ReceiptRenderer } from '@/ReceiptRenderer';

const doc = `
^^^p0s
Calibration · ${new Date().toLocaleString('en-GB')}
-
Normal "emphasis" _underline_ \`invert\`
^double-width ^^double-height
| Left | Centre | Right|
|Price | £1.50 | €1.75|
-
{code:p0s calibration; option:qrcode,6,m}
{code:2012345678903; option:ean,hri}
=
`;

const printer = new UsbPrinter({ vendorId: 0x04b8, productId: 0x0e15 });
await printer.start();
try {
  if (!isReady(printer.status)) {
    throw new Error(`printer not ready: ${notReadyReason(printer.status)}`);
  }
  await printer.write(new ReceiptRenderer({ encoding: 'cp858' }).toEscPos(doc));
  console.log('calibration receipt sent');
} finally {
  await printer.stop();
}
