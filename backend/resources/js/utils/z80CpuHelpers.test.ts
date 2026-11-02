import { describe, it, expect } from 'vitest';
import { C_FLAG, H_FLAG, N_FLAG, S_FLAG, Z_FLAG } from '../constants';
import { flagsAfterBitTest, incDec16Pair } from './z80CpuHelpers';

describe('incDec16Pair', () => {
  it('DEC BC from 0100H yields 00FFH', () => {
    const p = incDec16Pair(0x01, 0x00, -1);
    expect(p.high).toBe(0x00);
    expect(p.low).toBe(0xff);
  });

  it('INC BC from FFFFH wraps to 0000H', () => {
    const p = incDec16Pair(0xff, 0xff, 1);
    expect(p.high).toBe(0x00);
    expect(p.low).toBe(0x00);
  });

  it('INC HL from 00FFH yields 0100H', () => {
    const p = incDec16Pair(0x00, 0xff, 1);
    expect(p.high).toBe(0x01);
    expect(p.low).toBe(0x00);
  });
});

describe('flagsAfterBitTest', () => {
  it('BIT 0 on 80H sets S from operand bit 7', () => {
    const f = flagsAfterBitTest(0x80, 0, C_FLAG);
    expect(f & S_FLAG).toBe(S_FLAG);
    expect(f & Z_FLAG).toBe(Z_FLAG);
    expect(f & H_FLAG).toBe(H_FLAG);
    expect(f & C_FLAG).toBe(C_FLAG);
  });

  it('BIT 7 on 7FH clears S while Z reflects tested bit', () => {
    const f = flagsAfterBitTest(0x7f, 7, 0);
    expect(f & S_FLAG).toBe(0);
    expect(f & Z_FLAG).toBe(Z_FLAG);
  });

  it('BIT 3 on FFH clears Z and sets S', () => {
    const f = flagsAfterBitTest(0xff, 3, N_FLAG);
    expect(f & S_FLAG).toBe(S_FLAG);
    expect(f & Z_FLAG).toBe(0);
    expect(f & N_FLAG).toBe(0);
  });
});
