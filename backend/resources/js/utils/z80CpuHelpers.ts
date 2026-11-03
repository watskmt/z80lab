import { C_FLAG, H_FLAG, N_FLAG, PV_FLAG, S_FLAG, SZP_TABLE } from '../constants';

/** 16-bit register pair INC/DEC (BC, DE, HL, SP). */
export function incDec16Pair(high: number, low: number, delta: 1 | -1): { high: number; low: number } {
  const v = ((((high & 0xff) << 8) | (low & 0xff)) + delta) & 0xffff;
  return { high: v >> 8, low: v & 0xff };
}

/** F register after BIT b, r (CB prefix); C is preserved, operand is unchanged.
 *  S is set only when testing bit 7 and that bit is 1 (Z80 undocumented flags). */
export function flagsAfterBitTest(val: number, bit: number, prevF: number): number {
  const tested = val & (1 << bit);
  let f = (prevF & C_FLAG) | H_FLAG | (SZP_TABLE[tested] & ~(PV_FLAG | S_FLAG));
  if (bit === 7 && (val & 0x80)) f |= S_FLAG;
  return f;
}

/** DAA adjustment for accumulator after decimal-mode ADD/SUB. */
export function daaAdjust(a: number, f: number): { a: number; f: number } {
  let acc = a & 0xff;
  let flags = f;
  let adjust = 0;
  if (flags & H_FLAG || (acc & 0x0f) > 9) adjust = 0x06;
  if (flags & C_FLAG || acc > 0x99 || (acc > 0x90 && (acc & 0x0f) > 9)) {
    adjust += 0x60;
    flags |= C_FLAG;
  } else {
    flags &= ~C_FLAG;
  }
  if (flags & N_FLAG) acc = (acc - adjust) & 0xff;
  else acc = (acc + adjust) & 0xff;
  flags = (flags & (C_FLAG | N_FLAG)) | (SZP_TABLE[acc] & ~(C_FLAG | N_FLAG));
  return { a: acc, f: flags };
}
