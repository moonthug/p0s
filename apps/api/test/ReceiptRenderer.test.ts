import { describe, expect, it } from 'vitest';

import { ReceiptRenderer } from '../src/ReceiptRenderer';

const renderer = new ReceiptRenderer({ encoding: 'cp858' });
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

describe('ReceiptRenderer.escape', () => {
  it('escapes every ReceiptLine markup character', () => {
    expect(ReceiptRenderer.escape('a|b{c}d-e=f~g_h"i`j^k\\l')).toBe('a\\|b\\{c\\}d\\-e\\=f\\~g\\_h\\"i\\`j\\^k\\\\l');
  });

  it('drops emoji, including joined and variant forms', () => {
    expect(ReceiptRenderer.escape('Party 🎉 time 👩‍💻 ❤️!')).toBe('Party  time  !');
  });
});

describe('ReceiptRenderer.textDocument', () => {
  it('left-aligns and escapes each line', () => {
    expect(ReceiptRenderer.textDocument('one | two\r\n-\nthree')).toBe('{align:left}\none \\| two\n\\-\nthree');
  });
});

describe('ReceiptRenderer output', () => {
  it('renders text as a literal line, not columns or a rule', () => {
    const svg = renderer.toSvg(ReceiptRenderer.textDocument('Fish | chips\n-'));

    expect(svg).toContain('>|<');
    expect(svg).not.toContain('<line');
  });

  it('ends every receipt with exactly one cut (GS V)', () => {
    const cuts = (doc: string) => hex(renderer.toEscPos(doc)).match(/1d56/g)?.length ?? 0;

    expect(cuts('hello')).toBe(1);
  });

  // Guards ReceiptLine upgrades: if this changes, check a real print before updating the snapshot.
  it('produces stable ESC/POS bytes', () => {
    const doc = '^^p0s\n|Coffee | £2.80|\n-\n{code:p0s; option:qrcode,4,l}\n"Bold" _under_ `inv`';

    expect(hex(renderer.toEscPos(doc))).toMatchSnapshot();
  });
});
