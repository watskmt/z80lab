import React, { useState, useEffect, useRef } from 'react';

const injectTailwind = () => {
  if (!document.getElementById('tailwind-cdn')) {
    const script = document.createElement('script');
    script.id = 'tailwind-cdn';
    script.src = 'https://cdn.tailwindcss.com';
    document.head.appendChild(script);
  }
};

const MEM_SIZE = 0x10000;
const CODE_BASE = 0x0000;
const DATA_BASE = 0x4000;
const IO_OUT_ADDR = 0x8000;
const IO_IN_ADDR = 0x8001;

const hex2 = (v: number) =>
  (v & 0xff).toString(16).toUpperCase().padStart(2, '0');
const hex4 = (v: number) =>
  (v & 0xffff).toString(16).toUpperCase().padStart(4, '0');

const REGS_MAP: Record<string, number> = {
  B: 0,
  C: 1,
  D: 2,
  E: 3,
  H: 4,
  L: 5,
  A: 7,
};
const REGS_LIST = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];

const S_FLAG = 0x80;
const Z_FLAG = 0x40;
const H_FLAG = 0x10;
const PV_FLAG = 0x04;
const N_FLAG = 0x02;
const C_FLAG = 0x01;

const SZP_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
  let f = i & 0x80;
  if (i === 0) f |= Z_FLAG;
  let cnt = 0;
  for (let j = 0; j < 8; j++) if ((i >> j) & 1) cnt++;
  if (cnt % 2 === 0) f |= PV_FLAG;
  SZP_TABLE[i] = f;
}

// ===== アセンブラ =====
const assembleInstruction = (text: string, currentAddr: number): number[] => {
  const s = text.toUpperCase().trim();
  if (!s || s === '-' || s.startsWith('DB')) return [];

  const compact = s.replace(/\s+/g, '');

  // 1-byte opcodes (Simplified/Greedy)
  if (compact === 'NOP') return [0x00];
  if (compact === 'HALT') return [0x76];
  if (compact === 'RET') return [0xc9];
  if (compact === 'EXDE,HL') return [0xeb];
  if (compact === 'DI') return [0xf3];
  if (compact === 'EI') return [0xfb];
  if (compact === 'RLCA') return [0x07];
  if (compact === 'RRCA') return [0x0f];
  if (compact === 'RLA') return [0x17];
  if (compact === 'RRA') return [0x1f];
  if (compact === 'DAA') return [0x27];
  if (compact === 'CPL') return [0x2f];
  if (compact === 'SCF') return [0x37];
  if (compact === 'CCF') return [0x3f];

  // LD r, r'
  const ldRegMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),([A-EHL]|B|C|D|E|H|L|A)$/);
  if (ldRegMatch) {
    const d = REGS_MAP[ldRegMatch[1]];
    const s = REGS_MAP[ldRegMatch[2]];
    return [0x40 | (d << 3) | s];
  }

  // LD r, n
  const ldRnMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),([0-9A-F]+)H?$/);
  if (ldRnMatch) {
    const r = REGS_MAP[ldRnMatch[1]];
    const n = parseInt(ldRnMatch[2], 16);
    return [0x06 | (r << 3), n & 0xff];
  }

  // INC/DEC r
  const incDecMatch = compact.match(/^(INC|DEC)([A-EHL]|B|C|D|E|H|L|A)$/);
  if (incDecMatch) {
    const isInc = incDecMatch[1] === 'INC';
    const r = REGS_MAP[incDecMatch[2]];
    return [isInc ? 0x04 | (r << 3) : 0x05 | (r << 3)];
  }

  // ADD A, r / SUB r / etc
  const aluMatch = compact.match(/^(ADD|ADC|SUB|SBC|AND|XOR|OR|CP)(?:A,)?([A-EHL]|B|C|D|E|H|L|A)$/);
  if (aluMatch) {
    const ops = ['ADD', 'ADC', 'SUB', 'SBC', 'AND', 'XOR', 'OR', 'CP'];
    const opIdx = ops.indexOf(aluMatch[1]);
    const r = REGS_MAP[aluMatch[2]];
    return [0x80 | (opIdx << 3) | r];
  }

  // LD HL, nn / LD BC, nn / LD DE, nn / LD SP, nn
  const ldRRnnMatch = compact.match(/^LD(HL|BC|DE|SP),([0-9A-F]+)H?$/);
  if (ldRRnnMatch) {
    const rr = ldRRnnMatch[1];
    const nn = parseInt(ldRRnnMatch[2], 16);
    const op = rr === 'BC' ? 0x01 : rr === 'DE' ? 0x11 : rr === 'HL' ? 0x21 : 0x31;
    return [op, nn & 0xff, (nn >> 8) & 0xff];
  }

  // JP nn / CALL nn
  const jpCallMatch = compact.match(/^(JP|CALL)([0-9A-F]+)H?$/);
  if (jpCallMatch) {
    const isCall = jpCallMatch[1] === 'CALL';
    const nn = parseInt(jpCallMatch[2], 16);
    return [isCall ? 0xcd : 0xc3, nn & 0xff, (nn >> 8) & 0xff];
  }

  // JR e / DJNZ e
  const jrMatch = compact.match(/^(JR|DJNZ)([0-9A-F]+)H?$/);
  if (jrMatch) {
    const isDJNZ = jrMatch[1] === 'DJNZ';
    const targetAddr = parseInt(jrMatch[2], 16);
    const offset = (targetAddr - (currentAddr + 2)) & 0xff;
    return [isDJNZ ? 0x10 : 0x18, offset];
  }

  // Conditional Jumps
  const jpCondMatch = compact.match(/^JP(NZ|Z|NC|C),([0-9A-F]+)H?$/);
  if (jpCondMatch) {
    const conds = ['NZ', 'Z', 'NC', 'C'];
    const idx = conds.indexOf(jpCondMatch[1]);
    const nn = parseInt(jpCondMatch[2], 16);
    return [0xc2 | (idx << 3), nn & 0xff, (nn >> 8) & 0xff];
  }

  // LD (HL), A / LD A, (HL)
  if (compact === 'LD(HL),A') return [0x77];
  if (compact === 'LDA,(HL)') return [0x7e];

  // LD (nn), A / LD A, (nn)
  const ldMemAMatch = compact.match(/^LD\(([0-9A-F]+)H?\),A$/);
  if (ldMemAMatch) {
    const nn = parseInt(ldMemAMatch[1], 16);
    return [0x32, nn & 0xff, (nn >> 8) & 0xff];
  }
  const ldAMemMatch = compact.match(/^LDA,\(([0-9A-F]+)H?\)$/);
  if (ldAMemMatch) {
    const nn = parseInt(ldAMemMatch[1], 16);
    return [0x3a, nn & 0xff, (nn >> 8) & 0xff];
  }

  // LD (HL), n
  const ldHLnMatch = compact.match(/^LD\(HL\),([0-9A-F]+)H?$/);
  if (ldHLnMatch) {
    return [0x36, parseInt(ldHLnMatch[1], 16) & 0xff];
  }

  // PUSH/POP
  const pushPopMatch = compact.match(/^(PUSH|POP)(BC|DE|HL|AF)$/);
  if (pushPopMatch) {
    const isPush = pushPopMatch[1] === 'PUSH';
    const rrs = ['BC', 'DE', 'HL', 'AF'];
    const idx = rrs.indexOf(pushPopMatch[2]);
    return [(isPush ? 0xc5 : 0xc1) | (idx << 4)];
  }

  // BIT b, r
  const bitMatch = compact.match(/^BIT([0-7]),([A-EHL]|B|C|D|E|H|L|A)$/);
  if (bitMatch) {
    const bit = parseInt(bitMatch[1]);
    const r = REGS_MAP[bitMatch[2]];
    return [0xcb, 0x40 | (bit << 3) | r];
  }

  return [];
};

// ===== Disassembler (テキスト書き出し用) =====
function disasm(code: Uint8Array, start: number, count = 128) {
  const out = [];
  let pc = start;
  for (let i = 0; i < count && pc < MEM_SIZE; i++) {
    const currentPc = pc;
    const op = code[pc];
    let text = '';
    if (op >= 0x40 && op <= 0x7f && op !== 0x76) {
      text = `LD ${REGS_LIST[(op >> 3) & 7]},${REGS_LIST[op & 7]}`;
      pc += 1;
    } else if (op >= 0x80 && op <= 0xbf) {
      const ops = ['ADD A,', 'ADC A,', 'SUB ', 'SBC A,', 'AND ', 'XOR ', 'OR ', 'CP '];
      text = `${ops[(op >> 3) & 7]}${REGS_LIST[op & 7]}`;
      pc += 1;
    } else {
      switch (op) {
        case 0x00: text = 'NOP'; pc += 1; break;
        case 0x01: text = `LD BC,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x06: text = `LD B,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x0e: text = `LD C,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x11: text = `LD DE,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x16: text = `LD D,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x1e: text = `LD E,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x21: text = `LD HL,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x26: text = `LD H,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x2e: text = `LD L,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x31: text = `LD SP,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x3e: text = `LD A,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x32: text = `LD (${hex4(code[pc + 1] | (code[pc + 2] << 8))}),A`; pc += 3; break;
        case 0x3a: text = `LD A,(${hex4(code[pc + 1] | (code[pc + 2] << 8))})`; pc += 3; break;
        case 0x36: text = `LD (HL),${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x76: text = 'HALT'; pc += 1; break;
        case 0xc3: text = `JP ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xcd: text = `CALL ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xc9: text = 'RET'; pc += 1; break;
        case 0x18: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR ${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0x10: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `DJNZ ${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0xcb: {
          let cbOp = code[pc + 1];
          let r = REGS_LIST[cbOp & 7];
          if ((cbOp >> 6) === 1) text = `BIT ${(cbOp >> 3) & 7},${r}`;
          else if ((cbOp >> 6) === 2) text = `RES ${(cbOp >> 3) & 7},${r}`;
          else if ((cbOp >> 6) === 3) text = `SET ${(cbOp >> 3) & 7},${r}`;
          else {
            const fns = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SLL', 'SRL'];
            text = `${fns[(cbOp >> 3) & 7]} ${r}`;
          }
          pc += 2; break;
        }
        case 0xed: {
          let edOp = code[pc + 1];
          if (edOp === 0xb0) text = 'LDIR';
          else text = `ED ${hex2(edOp)}`;
          pc += 2; break;
        }
        default:
          if ((op & 0xc7) === 0x04) text = `INC ${REGS_LIST[(op >> 3) & 7]}`;
          else if ((op & 0xc7) === 0x05) text = `DEC ${REGS_LIST[(op >> 3) & 7]}`;
          else if ((op & 0xcf) === 0xc1) text = `POP ${['BC', 'DE', 'HL', 'AF'][(op >> 4) & 3]}`;
          else if ((op & 0xcf) === 0xc5) text = `PUSH ${['BC', 'DE', 'HL', 'AF'][(op >> 4) & 3]}`;
          else text = op !== 0 ? `DB ${hex2(op)}` : '-';
          pc += 1;
      }
    }
    out.push({ addr: currentPc, text });
  }
  return out;
}

const samplePrograms: Record<string, () => Uint8Array> = {
  '1. 基本ロード': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x3e, 0xaa, 0x06, 0xbb, 0x21, 0x00, 0x40, 0x77], CODE_BASE);
    return m;
  },
  '2. DJNZループ (10回)': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x06, 0x0a, 0x3e, 0x00, 0x3c, 0x10, 0xfd], CODE_BASE);
    return m;
  },
  '3. スタック操作': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x21, 0x12, 0x34, 0xe5, 0x01, 0x00, 0x00, 0xd1], CODE_BASE);
    return m;
  },
  '4. LDIR転送': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([
      0x21, 0x00, 0x00, // LD HL, 0000
      0x11, 0x00, 0x40, // LD DE, 4000
      0x01, 0x04, 0x00, // LD BC, 0004
      0xed, 0xb0        // LDIR
    ], CODE_BASE);
    return m;
  },
  '5. メモリ転送': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x3e, 0x7f, 0x32, 0x00, 0x40], CODE_BASE);
    return m;
  },
  '6. HLペア操作': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([0x26, 0x12, 0x2e, 0x34], CODE_BASE);
    return m;
  },
  '7. I/O連携 (スイッチ→ランプ)': () => {
    const m = new Uint8Array(MEM_SIZE);
    m.set([
      0x3a, 0x01, 0x80, // LD A, (8001H) ; 入力スイッチ
      0x32, 0x00, 0x80, // LD (8000H), A ; 出力ランプ
      0xc3, 0x00, 0x00  // JP 0000H
    ], CODE_BASE);
    return m;
  },
};

const initialRegs = {
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

export default function App() {
  useEffect(() => {
    injectTailwind();
  }, []);
  const [codeMemory, setCodeMemory] = useState(
    samplePrograms['1. 基本ロード']()
  );
  const [dataMemory, setDataMemory] = useState(new Uint8Array(MEM_SIZE));
  const [ioOut, setIoOut] = useState(0);
  const [ioIn, setIoIn] = useState(0);
  const [prevRegs, setPrevRegs] = useState(initialRegs);
  const [regs, setRegs] = useState(initialRegs);
  const [stackBaseAddr, setStackBaseAddr] = useState(initialRegs.SP);
  const [writes, setWrites] = useState<number[]>([]);
  const [editingAddr, setEditingAddr] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setDataMemory(new Uint8Array(MEM_SIZE));
    setIoOut(0);
    setIoIn(0);
    setRegs(initialRegs);
    setPrevRegs(initialRegs);
    setStackBaseAddr(initialRegs.SP);
    setWrites([]);
  };

  const handleUpdateCode = (addr: number, text: string) => {
    const bytes = assembleInstruction(text, addr);
    if (bytes.length > 0) {
      const newMem = new Uint8Array(codeMemory);
      bytes.forEach((b, i) => {
        if (addr + i < MEM_SIZE) newMem[addr + i] = b;
      });
      setCodeMemory(newMem);
    }
    setEditingAddr(null);
  };

  // ===== SAVE: ASMテキストとして保存 =====
  const saveAsm = () => {
    const lines = disasm(codeMemory, CODE_BASE)
      .filter((l) => l.text !== '-' && !l.text.startsWith('DB 00'))
      .map((l) => l.text);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'program.asm';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== LOAD: ASMテキストを読み込んでアセンブル =====
  const loadAsm = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n');
      const newMem = new Uint8Array(MEM_SIZE);
      let currentAddr = CODE_BASE;
      lines.forEach((line) => {
        const bytes = assembleInstruction(line, currentAddr);
        if (bytes.length > 0) {
          bytes.forEach((b) => {
            if (currentAddr < MEM_SIZE) newMem[currentAddr++] = b;
          });
        }
      });
      setCodeMemory(newMem);
      resetState();
    };
    reader.readAsText(file);
  };

  const step = () => {
    setPrevRegs(regs);
    const newData = new Uint8Array(dataMemory);
    const m = codeMemory;
    const dm = dataMemory;
    const r = { ...regs };
    const memWrite: number[] = [];

    const get8 = (addr: number) => {
      addr &= 0xffff;
      if (addr === IO_IN_ADDR) return ioIn;
      return dm[addr];
    };
    const set8 = (addr: number, val: number) => {
      addr &= 0xffff;
      val &= 0xff;
      if (addr === IO_OUT_ADDR) {
        setIoOut(val);
      }
      newData[addr] = val;
      memWrite.push(addr);
    };
    const get16 = (addr: number) => get8(addr) | (get8(addr + 1) << 8);
    const set16 = (addr: number, val: number) => {
      set8(addr, val & 0xff);
      set8(addr + 1, (val >> 8) & 0xff);
    };

    const push = (val: number) => {
      r.SP = (r.SP - 2) & 0xffff;
      set16(r.SP, val);
    };
    const pop = () => {
      const val = get16(r.SP);
      r.SP = (r.SP + 2) & 0xffff;
      return val;
    };

    const getReg = (idx: number) => {
      if (idx === 0) return r.B;
      if (idx === 1) return r.C;
      if (idx === 2) return r.D;
      if (idx === 3) return r.E;
      if (idx === 4) return r.H;
      if (idx === 5) return r.L;
      if (idx === 6) return get8((r.H << 8) | r.L);
      return r.A;
    };
    const setReg = (idx: number, val: number) => {
      val &= 0xff;
      if (idx === 0) r.B = val;
      else if (idx === 1) r.C = val;
      else if (idx === 2) r.D = val;
      else if (idx === 3) r.E = val;
      else if (idx === 4) r.H = val;
      else if (idx === 5) r.L = val;
      else if (idx === 6) set8((r.H << 8) | r.L, val);
      else r.A = val;
    };

    const add8 = (a: number, b: number, cy = 0) => {
      const res = a + b + cy;
      const h = (a & 0xf) + (b & 0xf) + cy;
      r.F = SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
      if (res > 0xff) r.F |= C_FLAG;
      if (h > 0xf) r.F |= H_FLAG;
      if (((a ^ ~b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
      return res & 0xff;
    };
    const sub8 = (a: number, b: number, cy = 0) => {
      const res = a - b - cy;
      const h = (a & 0xf) - (b & 0xf) - cy;
      r.F =
        SZP_TABLE[res & 0xff] & ~(PV_FLAG | N_FLAG | C_FLAG | H_FLAG);
      r.F |= N_FLAG;
      if (res < 0) r.F |= C_FLAG;
      if (h < 0) r.F |= H_FLAG;
      if (((a ^ b) & (a ^ res) & 0x80) !== 0) r.F |= PV_FLAG;
      return res & 0xff;
    };
    const cp8 = (a: number, b: number) => {
      sub8(a, b);
    };
    const and8 = (val: number) => {
      r.A &= val;
      r.F = SZP_TABLE[r.A] | H_FLAG;
    };
    const or8 = (val: number) => {
      r.A |= val;
      r.F = SZP_TABLE[r.A];
    };
    const xor8 = (val: number) => {
      r.A ^= val;
      r.F = SZP_TABLE[r.A];
    };

    let op = m[r.PC++];
    r.R = (r.R + 1) & 0x7f;

    // Main Opcode Map
    if (op >= 0x40 && op <= 0x7f) {
      // LD r, r'
      if (op === 0x76) {
        /* HALT */ r.PC--;
      } else {
        setReg((op >> 3) & 7, getReg(op & 7));
      }
    } else if (op >= 0x80 && op <= 0xbf) {
      // ALU r
      const val = getReg(op & 7);
      switch ((op >> 3) & 7) {
        case 0: r.A = add8(r.A, val); break;
        case 1: r.A = add8(r.A, val, (r.F & C_FLAG)); break;
        case 2: r.A = sub8(r.A, val); break;
        case 3: r.A = sub8(r.A, val, (r.F & C_FLAG)); break;
        case 4: and8(val); break;
        case 5: xor8(val); break;
        case 6: or8(val); break;
        case 7: cp8(r.A, val); break;
      }
    } else {
      switch (op) {
        case 0x00: break; // NOP
        case 0x01: r.C = m[r.PC++]; r.B = m[r.PC++]; break; // LD BC, nn
        case 0x02: set8((r.B << 8) | r.C, r.A); break; // LD (BC), A
        case 0x03: { let v = ((r.B << 8) | r.C + 1) & 0xffff; r.B = v >> 8; r.C = v & 0xff; break; } // INC BC
        case 0x04: r.B = add8(r.B, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG); break; // INC B (H-flag logic simplified)
        case 0x05: r.B = sub8(r.B, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.B] & ~C_FLAG) | N_FLAG; break; // DEC B
        case 0x06: r.B = m[r.PC++]; break; // LD B, n
        case 0x09: {
          const hl = (r.H << 8) | r.L; const bc = (r.B << 8) | r.C; const res = hl + bc;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        } // ADD HL, BC
        case 0x0a: r.A = get8((r.B << 8) | r.C); break; // LD A, (BC)
        case 0x0b: { let v = ((r.B << 8) | r.C - 1) & 0xffff; r.B = v >> 8; r.C = v & 0xff; break; } // DEC BC
        case 0x0c: r.C = add8(r.C, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG); break;
        case 0x0d: r.C = sub8(r.C, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.C] & ~C_FLAG) | N_FLAG; break;
        case 0x0e: r.C = m[r.PC++]; break;
        case 0x10: { let off = m[r.PC++]; if (off > 127) off -= 256; r.B = (r.B - 1) & 0xff; if (r.B !== 0) r.PC += off; break; } // DJNZ
        case 0x11: r.E = m[r.PC++]; r.D = m[r.PC++]; break; // LD DE, nn
        case 0x12: set8((r.D << 8) | r.E, r.A); break; // LD (DE), A
        case 0x13: { let v = ((r.D << 8) | r.E + 1) & 0xffff; r.D = v >> 8; r.E = v & 0xff; break; }
        case 0x14: r.D = add8(r.D, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG); break;
        case 0x15: r.D = sub8(r.D, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.D] & ~C_FLAG) | N_FLAG; break;
        case 0x16: r.D = m[r.PC++]; break;
        case 0x18: { let off = m[r.PC++]; if (off > 127) off -= 256; r.PC += off; break; } // JR
        case 0x19: {
          const hl = (r.H << 8) | r.L; const de = (r.D << 8) | r.E; const res = hl + de;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        } // ADD HL, DE
        case 0x1a: r.A = get8((r.D << 8) | r.E); break;
        case 0x1b: { let v = ((r.D << 8) | r.E - 1) & 0xffff; r.D = v >> 8; r.E = v & 0xff; break; }
        case 0x1c: r.E = add8(r.E, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG); break;
        case 0x1d: r.E = sub8(r.E, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.E] & ~C_FLAG) | N_FLAG; break;
        case 0x1e: r.E = m[r.PC++]; break;
        case 0x20: { let off = m[r.PC++]; if (off > 127) off -= 256; if (!(r.F & Z_FLAG)) r.PC += off; break; } // JR NZ, e
        case 0x21: r.L = m[r.PC++]; r.H = m[r.PC++]; break; // LD HL, nn
        case 0x22: { let adr = m[r.PC++] | (m[r.PC++] << 8); set16(adr, (r.H << 8) | r.L); break; } // LD (nn), HL
        case 0x23: { let v = ((r.H << 8) | r.L + 1) & 0xffff; r.H = v >> 8; r.L = v & 0xff; break; }
        case 0x24: r.H = add8(r.H, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG); break;
        case 0x25: r.H = sub8(r.H, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.H] & ~C_FLAG) | N_FLAG; break;
        case 0x26: r.H = m[r.PC++]; break;
        case 0x28: { let off = m[r.PC++]; if (off > 127) off -= 256; if (r.F & Z_FLAG) r.PC += off; break; } // JR Z, e
        case 0x29: {
          const hl = (r.H << 8) | r.L; const res = hl + hl;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        } // ADD HL, HL
        case 0x2a: { let adr = m[r.PC++] | (m[r.PC++] << 8); let v = get16(adr); r.H = v >> 8; r.L = v & 0xff; break; } // LD HL, (nn)
        case 0x2b: { let v = ((r.H << 8) | r.L - 1) & 0xffff; r.H = v >> 8; r.L = v & 0xff; break; }
        case 0x2c: r.L = add8(r.L, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG); break;
        case 0x2d: r.L = sub8(r.L, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.L] & ~C_FLAG) | N_FLAG; break;
        case 0x2e: r.L = m[r.PC++]; break;
        case 0x30: { let off = m[r.PC++]; if (off > 127) off -= 256; if (!(r.F & C_FLAG)) r.PC += off; break; } // JR NC, e
        case 0x31: r.SP = m[r.PC++] | (m[r.PC++] << 8); break; // LD SP, nn
        case 0x32: { let adr = m[r.PC++] | (m[r.PC++] << 8); set8(adr, r.A); break; } // LD (nn), A
        case 0x33: r.SP = (r.SP + 1) & 0xffff; break;
        case 0x34: { let adr = (r.H << 8) | r.L; let v = add8(get8(adr), 1); set8(adr, v); r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG); break; } // INC (HL)
        case 0x35: { let adr = (r.H << 8) | r.L; let v = sub8(get8(adr), 1); set8(adr, v); r.F = (r.F & C_FLAG) | (SZP_TABLE[v] & ~C_FLAG) | N_FLAG; break; } // DEC (HL)
        case 0x36: set8((r.H << 8) | r.L, m[r.PC++]); break; // LD (HL), n
        case 0x38: { let off = m[r.PC++]; if (off > 127) off -= 256; if (r.F & C_FLAG) r.PC += off; break; } // JR C, e
        case 0x39: {
          const hl = (r.H << 8) | r.L; const res = hl + r.SP;
          r.F = (r.F & ~(N_FLAG | C_FLAG | H_FLAG)) | (res > 0xffff ? C_FLAG : 0);
          r.H = (res >> 8) & 0xff; r.L = res & 0xff; break;
        } // ADD HL, SP
        case 0x3a: { let adr = m[r.PC++] | (m[r.PC++] << 8); r.A = get8(adr); break; } // LD A, (nn)
        case 0x3b: r.SP = (r.SP - 1) & 0xffff; break;
        case 0x3c: r.A = add8(r.A, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG); break;
        case 0x3d: r.A = sub8(r.A, 1); r.F = (r.F & C_FLAG) | (SZP_TABLE[r.A] & ~C_FLAG) | N_FLAG; break;
        case 0x3e: r.A = m[r.PC++]; break;
        case 0xc0: if (!(r.F & Z_FLAG)) r.PC = pop(); break; // RET NZ
        case 0xc1: { let v = pop(); r.C = v & 0xff; r.B = v >> 8; break; } // POP BC
        case 0xc2: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & Z_FLAG)) r.PC = adr; break; } // JP NZ, nn
        case 0xc3: r.PC = m[r.PC++] | (m[r.PC++] << 8); break; // JP nn
        case 0xc4: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & Z_FLAG)) { push(r.PC); r.PC = adr; } break; } // CALL NZ, nn
        case 0xc5: push((r.B << 8) | r.C); break; // PUSH BC
        case 0xc6: r.A = add8(r.A, m[r.PC++]); break; // ADD A, n
        case 0xc7: push(r.PC); r.PC = 0x00; break; // RST 00H
        case 0xc8: if (r.F & Z_FLAG) r.PC = pop(); break; // RET Z
        case 0xc9: r.PC = pop(); break; // RET
        case 0xca: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & Z_FLAG) r.PC = adr; break; } // JP Z, nn
        case 0xcc: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & Z_FLAG) { push(r.PC); r.PC = adr; } break; } // CALL Z, nn
        case 0xcd: { let adr = m[r.PC++] | (m[r.PC++] << 8); push(r.PC); r.PC = adr; break; } // CALL nn
        case 0xce: r.A = add8(r.A, m[r.PC++], (r.F & C_FLAG)); break; // ADC A, n
        case 0xcf: push(r.PC); r.PC = 0x08; break; // RST 08H
        case 0xd0: if (!(r.F & C_FLAG)) r.PC = pop(); break; // RET NC
        case 0xd1: { let v = pop(); r.E = v & 0xff; r.D = v >> 8; break; } // POP DE
        case 0xd2: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & C_FLAG)) r.PC = adr; break; } // JP NC, nn
        case 0xd4: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & C_FLAG)) { push(r.PC); r.PC = adr; } break; } // CALL NC, nn
        case 0xd5: push((r.D << 8) | r.E); break; // PUSH DE
        case 0xd6: r.A = sub8(r.A, m[r.PC++]); break; // SUB n
        case 0xd7: push(r.PC); r.PC = 0x10; break; // RST 10H
        case 0xd8: if (r.F & C_FLAG) r.PC = pop(); break; // RET C
        case 0xda: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & C_FLAG) r.PC = adr; break; } // JP C, nn
        case 0xdc: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & C_FLAG) { push(r.PC); r.PC = adr; } break; } // CALL C, nn
        case 0xde: r.A = sub8(r.A, m[r.PC++], (r.F & C_FLAG)); break; // SBC A, n
        case 0xdf: push(r.PC); r.PC = 0x18; break; // RST 18H
        case 0xe0: if (!(r.F & PV_FLAG)) r.PC = pop(); break; // RET PO
        case 0xe1: { let v = pop(); r.L = v & 0xff; r.H = v >> 8; break; } // POP HL
        case 0xe2: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & PV_FLAG)) r.PC = adr; break; } // JP PO, nn
        case 0xe3: { let v = get16(r.SP); set16(r.SP, (r.H << 8) | r.L); r.H = v >> 8; r.L = v & 0xff; break; } // EX (SP), HL
        case 0xe4: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & PV_FLAG)) { push(r.PC); r.PC = adr; } break; } // CALL PO, nn
        case 0xe5: push((r.H << 8) | r.L); break; // PUSH HL
        case 0xe6: and8(m[r.PC++]); break; // AND n
        case 0xe7: push(r.PC); r.PC = 0x20; break; // RST 20H
        case 0xe8: if (r.F & PV_FLAG) r.PC = pop(); break; // RET PE
        case 0xe9: r.PC = (r.H << 8) | r.L; break; // JP (HL)
        case 0xea: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & PV_FLAG) r.PC = adr; break; } // JP PE, nn
        case 0xeb: { let t = r.H; r.H = r.D; r.D = t; t = r.L; r.L = r.E; r.E = t; break; } // EX DE, HL
        case 0xec: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & PV_FLAG) { push(r.PC); r.PC = adr; } break; } // CALL PE, nn
        case 0xee: xor8(m[r.PC++]); break; // XOR n
        case 0xef: push(r.PC); r.PC = 0x28; break; // RST 28H
        case 0xf0: if (!(r.F & S_FLAG)) r.PC = pop(); break; // RET P
        case 0xf1: { let v = pop(); r.F = v & 0xff; r.A = v >> 8; break; } // POP AF
        case 0xf2: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & S_FLAG)) r.PC = adr; break; } // JP P, nn
        case 0xf3: /* DI */ break;
        case 0xf4: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (!(r.F & S_FLAG)) { push(r.PC); r.PC = adr; } break; } // CALL P, nn
        case 0xf5: push((r.A << 8) | r.F); break; // PUSH AF
        case 0xf6: or8(m[r.PC++]); break; // OR n
        case 0xf7: push(r.PC); r.PC = 0x30; break; // RST 30H
        case 0xf8: if (r.F & S_FLAG) r.PC = pop(); break; // RET M
        case 0xf9: r.SP = (r.H << 8) | r.L; break; // LD SP, HL
        case 0xfa: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & S_FLAG) r.PC = adr; break; } // JP M, nn
        case 0xfb: /* EI */ break;
        case 0xfc: { let adr = m[r.PC++] | (m[r.PC++] << 8); if (r.F & S_FLAG) { push(r.PC); r.PC = adr; } break; } // CALL M, nn
        case 0xfe: cp8(r.A, m[r.PC++]); break; // CP n
        case 0xff: push(r.PC); r.PC = 0x38; break; // RST 38H

        case 0xcb: {
          let cbOp = m[r.PC++];
          let val = getReg(cbOp & 7);
          let res = val;
          switch (cbOp >> 3) {
            case 0: // RLC
              r.F = (val >> 7) & C_FLAG; res = ((val << 1) | r.F) & 0xff; r.F |= SZP_TABLE[res]; break;
            case 1: // RRC
              r.F = val & C_FLAG; res = (val >> 1) | (r.F << 7); r.F |= SZP_TABLE[res]; break;
            case 2: // RL
              let c = r.F & C_FLAG; r.F = (val >> 7) & C_FLAG; res = ((val << 1) | c) & 0xff; r.F |= SZP_TABLE[res]; break;
            case 3: // RR
              let c2 = r.F & C_FLAG; r.F = val & C_FLAG; res = (val >> 1) | (c2 << 7); r.F |= SZP_TABLE[res]; break;
            case 4: // SLA
              r.F = (val >> 7) & C_FLAG; res = (val << 1) & 0xff; r.F |= SZP_TABLE[res]; break;
            case 5: // SRA
              r.F = val & C_FLAG; res = (val >> 1) | (val & 0x80); r.F |= SZP_TABLE[res]; break;
            case 7: // SRL
              r.F = val & C_FLAG; res = (val >> 1); r.F |= SZP_TABLE[res]; break;
            default:
              if ((cbOp >> 6) === 1) { // BIT
                let bit = (cbOp >> 3) & 7; r.F = (r.F & C_FLAG) | H_FLAG | (SZP_TABLE[val & (1 << bit)] & ~PV_FLAG);
                if (bit === 7 && (val & 0x80)) r.F |= S_FLAG;
                return; // res not used
              } else if ((cbOp >> 6) === 2) { // RES
                res = val & ~(1 << ((cbOp >> 3) & 7));
              } else if ((cbOp >> 6) === 3) { // SET
                res = val | (1 << ((cbOp >> 3) & 7));
              }
          }
          setReg(cbOp & 7, res);
          break;
        }

        case 0xed: {
          let edOp = m[r.PC++];
          switch (edOp) {
            case 0x44: r.A = 0; r.F = SZP_TABLE[r.A]; break; // NEG (placeholder)
            case 0x47: r.I = r.A; break; // LD I, A
            case 0x4f: r.R = r.A; break; // LD R, A
            case 0x56: /* IM 1 */ break;
            case 0x5e: /* IM 2 */ break;
            case 0x67: { // RRD
              let hlVal = get8((r.H << 8) | r.L); let lowA = r.A & 0x0f;
              r.A = (r.A & 0xf0) | (hlVal & 0x0f);
              set8((r.H << 8) | r.L, (hlVal >> 4) | (lowA << 4));
              r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            }
            case 0x6f: { // RLD
              let hlVal = get8((r.H << 8) | r.L); let lowA = r.A & 0x0f;
              r.A = (r.A & 0xf0) | (hlVal >> 4);
              set8((r.H << 8) | r.L, (hlVal << 4) | lowA);
              r.F = (r.F & C_FLAG) | SZP_TABLE[r.A]; break;
            }
            case 0xb0: { // LDIR
              let src = (r.H << 8) | r.L; let dst = (r.D << 8) | r.E; let len = (r.B << 8) | r.C;
              if (len > 0) {
                set8(dst, get8(src));
                src = (src + 1) & 0xffff; dst = (dst + 1) & 0xffff; len = (len - 1) & 0xffff;
                r.H = src >> 8; r.L = src & 0xff; r.D = dst >> 8; r.E = dst & 0xff; r.B = len >> 8; r.C = len & 0xff;
                if (len > 0) r.PC -= 2;
                r.F &= ~(N_FLAG | H_FLAG | PV_FLAG);
              }
              break;
            }
            default: break;
          }
          break;
        }
        // DD/FD (IX/IY) simplified for brevity but added basic support
        case 0xdd: case 0xfd: {
          let isIY = (op === 0xfd);
          let subOp = m[r.PC++];
          if (subOp === 0x21) { r[isIY ? 'IY' : 'IX'] = m[r.PC++] | (m[r.PC++] << 8); }
          else if (subOp === 0x36) { let d = m[r.PC++]; if (d > 127) d -= 256; set8((r[isIY ? 'IY' : 'IX'] + d), m[r.PC++]); }
          break;
        }

        default: break;
      }
    }

    setDataMemory(newData);
    setRegs(r);
    setWrites(memWrite);
  };

  const FlagLamp = ({ label, bit, val, desc }: any) => {
    const isOn = (val & (1 << bit)) !== 0;
    return (
      <div
        className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-lg border-2 transition-all duration-300 ${
          isOn
            ? 'bg-red-500/20 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
            : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <span
          className={`text-2xl font-black ${
            isOn ? 'text-red-500' : 'text-white'
          }`}
        >
          {label}
        </span>
        <span
          className={`text-[9px] font-bold mt-1 uppercase text-center ${
            isOn ? 'text-red-400' : 'text-zinc-600'
          }`}
        >
          {desc}
        </span>
      </div>
    );
  };

  const BoldReg = ({ label, val, prevVal, size = 2 }: any) => {
    const isChanged = val !== prevVal;
    return (
      <div
        className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl border transition-all h-full ${
          isChanged
            ? 'bg-green-900 border-green-400'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
        }`}
      >
        <span
          className={`font-black uppercase tracking-tight text-sm mb-1 ${
            isChanged ? 'text-green-300' : 'text-white'
          }`}
        >
          {label}
        </span>
        <span
          className={`font-mono font-bold text-xl lg:text-2xl ${
            isChanged ? 'text-white' : 'text-zinc-100'
          }`}
        >
          {size === 2 ? hex2(val) : hex4(val)}
        </span>
      </div>
    );
  };

  const IOPanel = () => {
    const toggleBit = (bit: number) => {
      setIoIn(ioIn ^ (1 << bit));
    };

    return (
      <div className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-4 shadow-2xl">
        <h2 className="text-purple-400 font-black text-[10px] tracking-[0.3em] border-b border-zinc-800 pb-1 uppercase text-center italic">
          Memory Mapped I/O
        </h2>

        <div className="flex flex-col gap-2">
          {/* OUTPUT LAMPS (0x8000) */}
          <div className="bg-black/40 p-2 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Output Lamps (0x8000)</span>
              <span className="text-xs font-mono text-zinc-400">{hex2(ioOut)}</span>
            </div>
            <div className="flex gap-1">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const isOn = (ioOut & (1 << bit)) !== 0;
                return (
                  <div key={bit} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className={`w-full aspect-square rounded-full border-2 transition-all duration-300 ${
                        isOn
                          ? 'bg-yellow-400 border-yellow-200 shadow-[0_0_10px_rgba(250,204,21,0.6)]'
                          : 'bg-zinc-900 border-zinc-800'
                      }`}
                    />
                    <span className="text-[9px] font-bold text-white">B{bit}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INPUT SWITCHES (0x8001) */}
          <div className="bg-black/40 p-2 rounded-xl border border-zinc-800">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Input Switches (0x8001)</span>
              <span className="text-xs font-mono text-zinc-400">{hex2(ioIn)}</span>
            </div>
            <div className="flex gap-1">
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const isOn = (ioIn & (1 << bit)) !== 0;
                return (
                  <div key={bit} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      onClick={() => toggleBit(bit)}
                      className="w-full bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 h-16 flex flex-col items-center justify-between relative shadow-inner cursor-pointer hover:bg-zinc-700/50 transition-colors"
                    >
                      {/* 上の状態(1)を示すガイドラベル */}
                      <span className={`text-[7px] font-black ${isOn ? 'text-white' : 'text-zinc-600'}`}>1</span>
                      
                      {/* レバースイッチ本体 */}
                      <div
                        className={`w-full h-8 rounded-md transition-all duration-200 relative flex items-center justify-center ${
                          isOn
                            ? 'bg-zinc-300 border-t-2 border-white shadow-[0_-2px_6px_rgba(255,255,255,0.3)] -translate-y-2'
                            : 'bg-zinc-600 border-b-2 border-zinc-800 shadow-[0_2px_4px_rgba(0,0,0,0.4)] translate-y-2'
                        }`}
                      >
                        {/* スイッチの表面テクスチャ */}
                        <div className={`w-1/2 h-full ${isOn ? 'bg-gradient-to-b from-white to-zinc-400' : 'bg-gradient-to-b from-zinc-500 to-zinc-800'} rounded-sm opacity-50`} />
                        
                        {/* 状態インジケーター（白く光るドット） */}
                        <div className={`absolute top-1 w-1.5 h-1.5 rounded-full transition-all ${isOn ? 'bg-white shadow-[0_0_5px_white]' : 'bg-zinc-900'}`} />
                      </div>

                      {/* 下の状態(0)を示すガイドラベル */}
                      <span className={`text-[7px] font-black ${!isOn ? 'text-white' : 'text-zinc-600'}`}>0</span>
                    </div>
                    <span className="text-[9px] font-bold text-white">B{bit}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-zinc-950 text-zinc-200 p-2 font-sans flex flex-col items-center overflow-x-auto overflow-y-hidden">
      <div className="w-full min-w-[1400px] max-w-[2400px] h-full flex flex-col space-y-2">
        <header className="flex justify-between items-center bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 shadow-xl shrink-0 h-14">
          <h1 className="text-2xl font-black text-white italic tracking-tighter shrink-0 flex items-center gap-2">
            Z 8 0<span className="text-blue-500">LAB</span>
            <div className="flex items-center gap-2 ml-4 border-l border-zinc-800 pl-4">
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-white transition-colors"
                title="X (Twitter)"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </h1>
          <div className="flex items-center gap-3 h-full">
            <button
              onClick={saveAsm}
              className="px-3 py-1.5 h-8 bg-zinc-800 text-[10px] font-black text-blue-400 rounded border border-zinc-700 hover:bg-zinc-700 uppercase"
            >
              Save ASM
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 h-8 bg-zinc-800 text-[10px] font-black text-green-400 rounded border border-zinc-700 hover:bg-zinc-700 uppercase"
            >
              Load ASM
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={loadAsm}
              className="hidden"
              accept=".asm,.txt"
            />
            <select
              className="bg-zinc-800 text-zinc-200 text-xs font-bold h-8 px-4 rounded border border-zinc-700 outline-none hover:bg-zinc-700 cursor-pointer shadow-lg w-52 appearance-none"
              onChange={(e) => {
                const prog = samplePrograms[e.target.value];
                if (prog) {
                  const newMem = prog();
                  setCodeMemory(newMem);
                  resetState();
                }
              }}
              defaultValue=""
            >
              <option value="" disabled>
                SELECT PROGRAM...
              </option>
              {Object.keys(samplePrograms).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              onClick={resetState}
              className="bg-red-900/30 text-red-400 text-[10px] font-black h-8 px-4 rounded border border-red-900/50 hover:bg-red-900/50 uppercase"
            >
              RESET
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[400px_1fr] gap-2 flex-grow min-h-0 overflow-hidden">
          {/* ARCHITECTURE PANEL */}
          <div className="bg-zinc-900/60 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-4 overflow-y-auto custom-scrollbar shadow-2xl h-full">
            <h2 className="text-blue-400 font-black text-[10px] tracking-[0.3em] border-b border-zinc-800 pb-1 uppercase text-center italic">
              Core Architecture
            </h2>
            <div className="grid grid-cols-4 gap-2">
              <BoldReg label="A" val={regs.A} prevVal={prevRegs.A} />
              <BoldReg label="F" val={regs.F} prevVal={prevRegs.F} />
              <BoldReg label="B" val={regs.B} prevVal={prevRegs.B} />
              <BoldReg label="C" val={regs.C} prevVal={prevRegs.C} />
              <BoldReg label="D" val={regs.D} prevVal={prevRegs.D} />
              <BoldReg label="E" val={regs.E} prevVal={prevRegs.E} />
              <BoldReg label="H" val={regs.H} prevVal={prevRegs.H} />
              <BoldReg label="L" val={regs.L} prevVal={prevRegs.L} />
              <BoldReg label="IX" val={regs.IX} prevVal={prevRegs.IX} size={4} />
              <BoldReg label="IY" val={regs.IY} prevVal={prevRegs.IY} size={4} />
              <div className="grid grid-cols-2 col-span-2 gap-2">
                <BoldReg label="SP" val={regs.SP} prevVal={prevRegs.SP} size={4} />
                <BoldReg label="PC" val={regs.PC} prevVal={prevRegs.PC} size={4} />
              </div>
            </div>
            <div className="bg-black/60 p-3 rounded-xl border border-zinc-800">
              <div className="flex gap-1">
                <FlagLamp label="S" bit={7} val={regs.F} desc="Sign" />
                <FlagLamp label="Z" bit={6} val={regs.F} desc="Zero" />
                <div className="w-px bg-zinc-800 mx-0.5"></div>
                <FlagLamp label="H" bit={4} val={regs.F} desc="H-C" />
                <FlagLamp label="P" bit={2} val={regs.F} desc="P/V" />
                <FlagLamp label="N" bit={1} val={regs.F} desc="N/S" />
                <FlagLamp label="C" bit={0} val={regs.F} desc="Carry" />
              </div>
            </div>
            <IOPanel />
          </div>

          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_300px_300px] gap-2 flex-grow min-h-0 overflow-hidden">
              {/* PROGRAM PANEL */}
              <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 flex flex-col overflow-hidden shadow-2xl min-w-[400px]">
                <h2 className="text-yellow-500 font-black text-xl border-b border-yellow-500/30 pb-1 mb-2 text-center italic">
                  PROGRAM
                </h2>
                <div className="overflow-y-auto flex-grow font-mono bg-black/60 rounded-xl p-2 custom-scrollbar">
                  {disasm(codeMemory, CODE_BASE).map((l, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 px-2 py-1 rounded-lg mb-1 border ${
                        l.addr === regs.PC
                          ? 'bg-yellow-500 text-black font-black'
                          : 'text-zinc-500 border-transparent'
                      }`}
                    >
                      <span
                        className={`text-base shrink-0 font-bold ${
                          l.addr === regs.PC ? 'text-black' : 'text-yellow-600/60'
                        }`}
                      >
                        {hex4(l.addr)}
                      </span>
                      {editingAddr === l.addr ? (
                        <input
                          autoFocus
                          className="bg-white text-black w-full px-1 rounded uppercase font-bold"
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => handleUpdateCode(l.addr, editVal)}
                          onKeyDown={(e) =>
                            e.key === 'Enter' && handleUpdateCode(l.addr, editVal)
                          }
                        />
                      ) : (
                        <span
                          className="text-lg tracking-tighter cursor-pointer hover:text-white"
                          onClick={() => {
                            setEditingAddr(l.addr);
                            setEditVal(l.text);
                          }}
                        >
                          {l.text}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RAM PANEL */}
              <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 flex flex-col overflow-hidden shadow-2xl">
                <h2 className="text-red-500 font-black text-xl border-b border-red-500/30 pb-1 mb-2 text-center italic">
                  RAM
                </h2>
                <div className="overflow-y-auto flex-grow font-mono bg-black/60 rounded-xl custom-scrollbar">
                  <table className="w-full border-separate border-spacing-0">
                    <tbody>
                      {Array.from({ length: 128 }).map((_, i) => {
                        const addr = DATA_BASE + i;
                        const isTouched = writes.includes(addr);
                        return (
                          <tr key={i} className={isTouched ? 'bg-red-900/40' : ''}>
                            <td
                              className={`px-3 py-1 text-sm font-bold ${
                                isTouched ? 'text-red-300' : 'text-zinc-600'
                              }`}
                            >
                              {hex4(addr)}
                            </td>
                            <td
                              className={`px-3 py-1 text-right text-lg font-black ${
                                isTouched ? 'text-white' : 'text-zinc-300'
                              }`}
                            >
                              {hex2(dataMemory[addr])}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* STACK PANEL */}
              <div className="bg-zinc-900/60 rounded-2xl p-3 border border-zinc-800 flex flex-col overflow-hidden shadow-2xl">
                <h2 className="text-blue-500 font-black text-xl border-b border-blue-500/30 pb-1 mb-2 text-center italic">
                  STACK
                </h2>
                <div className="overflow-y-auto flex-grow font-mono bg-black/60 rounded-xl custom-scrollbar">
                  <table className="w-full border-separate border-spacing-0">
                    <tbody>
                      {Array.from({ length: 64 }).map((_, i) => {
                        // stackBaseAddr周辺を表示 (base-4 ～ base+59)
                        const addr = (stackBaseAddr - 4 + i) & 0xffff;
                        const isSP = addr === regs.SP;
                        const isTouched = writes.includes(addr);
                        return (
                          <tr key={i} className={`${isSP ? 'bg-blue-600/40' : ''} ${isTouched ? 'border-l-2 border-red-500' : ''}`}>
                            <td
                              className={`px-3 py-1 text-sm font-bold ${
                                isSP ? 'text-blue-300' : isTouched ? 'text-red-300' : 'text-zinc-600'
                              }`}
                            >
                              {hex4(addr)}
                            </td>
                            <td
                              className={`px-3 py-1 text-right text-lg font-black ${
                                isSP ? 'text-white' : isTouched ? 'text-white' : 'text-zinc-300'
                              }`}
                            >
                              {hex2(dataMemory[addr])}
                            </td>
                            <td className="px-1 text-[10px] text-blue-400 font-black">
                              {isSP ? '←SP' : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 px-5 py-3 rounded-xl border border-zinc-800 flex justify-center shrink-0">
              <button
                onClick={step}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black px-12 py-3 rounded-xl text-2xl border-b-4 border-blue-800 active:translate-y-1 transition-all w-full max-w-xl"
              >
                STEP EXECUTE
              </button>
            </div>
          </div>
        </div>

      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }`}</style>
    </div>
  );
}
