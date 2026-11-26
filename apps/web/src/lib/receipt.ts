/** The TM-T20II prints 576 dots across 72 mm: 8 dots per millimetre. */
const DOTS_PER_MM = 8;

/** Paper length of a ReceiptLine SVG preview, in centimetres, or null if it can't be read. */
export function paperLengthCm(svg: string): number | null {
  const match = svg.match(/height="(\d+(?:\.\d+)?)px"/);

  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]) / DOTS_PER_MM / 10;
}

/** A readable one-line title for a job: its first line of text, without ReceiptLine markup. */
export function receiptTitle(source: string | null): string | null {
  if (!source) {
    return null;
  }

  for (const line of source.split('\n')) {
    const text = line
      .replace(/\{[^}]*\}/g, '')
      .replace(/[\^"_`~|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text && !/^[-=]+$/.test(text)) {
      return text;
    }
  }

  return null;
}

export const SAMPLE_RECEIPT = `^^^p0s
Printed from the browser
-
|Coffee | £2.80|
|Croissant | £2.10|
|"Total | "£4.90|
-
{code:https://github.com/receiptline/receiptline; option:qrcode,5,l}
ReceiptLine syntax reference
=`;
