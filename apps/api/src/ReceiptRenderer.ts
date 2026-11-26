import receiptline from 'receiptline';

export type ReceiptRendererOptions = { encoding: string; cpl?: number };

/** Turns ReceiptLine documents into ESC/POS bytes (TM-T20II) or SVG previews. */
export class ReceiptRenderer {
  private readonly base;

  constructor(opts: ReceiptRendererOptions) {
    this.base = {
      cpl: opts.cpl ?? 48,
      encoding: opts.encoding as 'cp858',
      spacing: true,
      cutting: true,
    };
  }

  toEscPos(doc: string): Uint8Array {
    return Buffer.from(receiptline.transform(doc, { ...this.base, command: 'escpos' }), 'binary');
  }

  toSvg(doc: string): string {
    return receiptline.transform(doc, { ...this.base, command: 'svg' });
  }
}
