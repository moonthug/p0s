import receiptline from 'receiptline';

export type ReceiptRendererOptions = { encoding: string; cpl?: number };

/** Per-document overrides. `gradient: true` dithers images (photos); false thresholds them (line art). */
export type RenderOverrides = { gradient?: boolean };

/** Characters ReceiptLine treats as markup in text. */
const SPECIAL = /[\\|{}\-=~_"`^]/g;

/** Emoji and other pictographs: the printer's device fonts can't draw them. */
const PICTOGRAPHS = /\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/gu;

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

  toEscPos(doc: string, overrides: RenderOverrides = {}): Uint8Array {
    return Buffer.from(receiptline.transform(doc, { ...this.base, ...overrides, command: 'escpos' }), 'binary');
  }

  toSvg(doc: string, overrides: RenderOverrides = {}): string {
    return receiptline.transform(doc, { ...this.base, ...overrides, command: 'svg' });
  }

  /** Escape text so ReceiptLine prints it literally, dropping characters the printer can't draw. */
  static escape(text: string): string {
    return text.replace(PICTOGRAPHS, '').replace(SPECIAL, (ch) => `\\${ch}`);
  }

  /** Plain text as a left-aligned ReceiptLine document (ReceiptLine centres single columns by default). */
  static textDocument(text: string): string {
    const lines = text.replace(/\r\n?/g, '\n').split('\n').map(ReceiptRenderer.escape);

    return ['{align:left}', ...lines].join('\n');
  }

  /** A single image as a ReceiptLine document. ReceiptLine adds the final cut itself. */
  static imageDocument(png: Buffer): string {
    return `{image:${png.toString('base64')}}`;
  }
}
