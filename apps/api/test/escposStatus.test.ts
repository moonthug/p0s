import { describe, expect, it } from 'vitest';

import { decodeStatus, isStatusByte } from '../src/printer/escposStatus';

/** Every reply byte has bit 1 and bit 4 set: 0x12 means "nothing to report". */
const CLEAR = 0x12;

const decode = (overrides: Partial<Record<'printer' | 'offline' | 'error' | 'paper', number>>) =>
  decodeStatus({ printer: CLEAR, offline: CLEAR, error: CLEAR, paper: CLEAR, ...overrides });

describe('isStatusByte', () => {
  it('accepts the bytes the TM-T20II actually sent', () => {
    expect(isStatusByte(0x12)).toBe(true);
    expect(isStatusByte(0x16)).toBe(true); // drawer kick pin high, seen on the real printer
  });

  it('rejects bytes that cannot be a status reply', () => {
    expect(isStatusByte(0x00)).toBe(false);
    expect(isStatusByte(0x80)).toBe(false);
  });
});

describe('decodeStatus', () => {
  it('reads all-clear replies as ready', () => {
    expect(decode({})).toEqual({
      online: true,
      coverOpen: false,
      paperOut: false,
      error: false,
      paperNearEnd: false,
    });
  });

  it('ignores the drawer pin', () => {
    expect(decode({ printer: 0x16 }).online).toBe(true);
  });

  it('detects offline', () => {
    expect(decode({ printer: CLEAR | 0x08 }).online).toBe(false);
  });

  it('detects an open cover', () => {
    expect(decode({ offline: CLEAR | 0x04 }).coverOpen).toBe(true);
  });

  it('detects paper out from either the offline cause or the paper sensor', () => {
    expect(decode({ offline: CLEAR | 0x20 }).paperOut).toBe(true);
    expect(decode({ paper: CLEAR | 0x60 }).paperOut).toBe(true);
  });

  it('detects paper running low', () => {
    expect(decode({ paper: CLEAR | 0x0c }).paperNearEnd).toBe(true);
  });

  it('detects cutter and other errors', () => {
    expect(decode({ error: CLEAR | 0x08 }).error).toBe(true); // auto-cutter
    expect(decode({ offline: CLEAR | 0x40 }).error).toBe(true);
  });
});
