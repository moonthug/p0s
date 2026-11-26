import { describe, expect, it } from 'vitest';

import { paperLengthCm, receiptTitle } from '../src/lib/receipt';

describe('paperLengthCm', () => {
  it('converts the preview height at 8 dots per millimetre', () => {
    expect(paperLengthCm('<svg width="576px" height="800px">')).toBe(10);
  });

  it('returns null when the height is missing', () => {
    expect(paperLengthCm('<svg>')).toBeNull();
  });
});

describe('receiptTitle', () => {
  it('uses the first line of text without markup', () => {
    expect(receiptTitle('^^^"Hello"\nsecond line')).toBe('Hello');
  });

  it('skips rules, cuts and property lines', () => {
    expect(receiptTitle('{code:x; option:qrcode}\n-\n=\n|Coffee | £2.80|')).toBe('Coffee £2.80');
  });

  it('returns null when there is no text', () => {
    expect(receiptTitle(null)).toBeNull();
    expect(receiptTitle('-\n=')).toBeNull();
  });
});
