export const MEM_SIZE = 0x10000;
export const CODE_BASE = 0x0000;
export const DATA_BASE = 0x4000;
export const IO_OUT_ADDR = 0x8000;
export const IO_IN_ADDR = 0x8001;

export const hex2 = (v: number) =>
  (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
export const hex4 = (v: number) =>
  (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');

export const REGS_MAP: Record<string, number> = {
  B: 0,
  C: 1,
  D: 2,
  E: 3,
  H: 4,
  L: 5,
  A: 7,
};
export const REGS_LIST = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];

export const S_FLAG = 0x80;
export const Z_FLAG = 0x40;
export const H_FLAG = 0x10;
export const PV_FLAG = 0x04;
export const N_FLAG = 0x02;
export const C_FLAG = 0x01;

export const SZP_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let f = i & 0x80;
  if (i === 0) f |= Z_FLAG;
  let cnt = 0;
  for (let j = 0; j < 8; j++) if ((i >> j) & 1) cnt++;
  if (cnt % 2 === 0) f |= PV_FLAG;
  SZP_TABLE[i] = f;
}

export const initialRegs = {
  A: 0,
  F: 0,
  B: 0,
  C: 0,
  D: 0,
  E: 0,
  H: 0,
  L: 0,
  IX: 0,
  IY: 0,
  PC: CODE_BASE,
  SP: 0xbfff,
  I: 0,
  R: 0,
  A2: 0,
  F2: 0,
  B2: 0,
  C2: 0,
  D2: 0,
  E2: 0,
  H2: 0,
  L2: 0,
};
