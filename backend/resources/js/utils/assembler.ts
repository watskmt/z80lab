import { REGS_MAP, REGS_LIST, hex4, hex2, MEM_SIZE } from '../constants';

// ===== アセンブラ =====
export const assembleInstruction = (text: string, currentAddr: number): number[] => {
  const lineWithoutComment = text.split(';')[0];
  const s = lineWithoutComment.toUpperCase().trim();
  if (!s || s === '-' || s.startsWith('DB') || s.startsWith('DW') || s.startsWith('ORG') || s.startsWith('END')) return [];

  // Normalize 0x-prefixed hex to decimal
  const normalized = s.replace(/0X([0-9A-F]+)/g, (_m, h) => parseInt(h, 16).toString());
  const compact = normalized.replace(/\s+/g, '');

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
  const ldRnMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),([0-9A-F]+H?|[0-9]+)$/);
  if (ldRnMatch) {
    const r = REGS_MAP[ldRnMatch[1]];
    const valStr = ldRnMatch[2];
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(n)) {
      return [0x06 | (r << 3), n & 0xff];
    }
  }

  // INC/DEC r
  const incDecMatch = compact.match(/^(INC|DEC)([A-EHL]|B|C|D|E|H|L|A)$/);
  if (incDecMatch) {
    const isInc = incDecMatch[1] === 'INC';
    const r = REGS_MAP[incDecMatch[2]];
    return [isInc ? 0x04 | (r << 3) : 0x05 | (r << 3)];
  }

  // INC/DEC rr (16-bit)
  const incDecRRMatch = compact.match(/^(INC|DEC)(BC|DE|HL|SP)$/);
  if (incDecRRMatch) {
    const isInc = incDecRRMatch[1] === 'INC';
    const rr = incDecRRMatch[2];
    const opBase = isInc ? 0x03 : 0x0b;
    const offset = rr === 'BC' ? 0x00 : rr === 'DE' ? 0x10 : rr === 'HL' ? 0x20 : 0x30;
    return [opBase | offset];
  }

  // INC/DEC (HL)
  if (compact === 'INC(HL)') return [0x34];
  if (compact === 'DEC(HL)') return [0x35];

  // ADD A, r / SUB r / etc
  const aluMatch = compact.match(/^(ADD|ADC|SUB|SBC|AND|XOR|OR|CP)(?:A,)?([A-EHL]|B|C|D|E|H|L|A)$/);
  if (aluMatch) {
    const ops = ['ADD', 'ADC', 'SUB', 'SBC', 'AND', 'XOR', 'OR', 'CP'];
    const opIdx = ops.indexOf(aluMatch[1]);
    const r = REGS_MAP[aluMatch[2]];
    return [0x80 | (opIdx << 3) | r];
  }

  // ADD HL, rr
  const addHLRRMatch = compact.match(/^ADDHL,(BC|DE|HL|SP)$/);
  if (addHLRRMatch) {
    const rrs = ['BC', 'DE', 'HL', 'SP'];
    const idx = rrs.indexOf(addHLRRMatch[1]);
    return [0x09 | (idx << 4)];
  }

  // ADD A, n / SUB n / etc (Immediate)
  const aluNMatch = compact.match(/^(ADD|ADC|SUB|SBC|AND|XOR|OR|CP)(?:A,)?([0-9A-F]+H?|[0-9]+)$/);
  if (aluNMatch) {
    const ops = ['ADD', 'ADC', 'SUB', 'SBC', 'AND', 'XOR', 'OR', 'CP'];
    const opIdx = ops.indexOf(aluNMatch[1]);
    const valStr = aluNMatch[2];
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(n)) {
      return [0xc6 | (opIdx << 3), n & 0xff];
    }
  }

  // LD HL, nn / LD BC, nn / LD DE, nn / LD SP, nn
  const ldRRnnMatch = compact.match(/^LD(HL|BC|DE|SP),([0-9A-F]+H?|[0-9]+)$/);
  if (ldRRnnMatch) {
    const rr = ldRRnnMatch[1];
    const valStr = ldRRnnMatch[2];
    const nn = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(nn)) {
      const op = rr === 'BC' ? 0x01 : rr === 'DE' ? 0x11 : rr === 'HL' ? 0x21 : 0x31;
      return [op, nn & 0xff, (nn >> 8) & 0xff];
    }
  }

  // JP nn / CALL nn
  const jpCallMatch = compact.match(/^(JP|CALL)([0-9A-F]+H?|[0-9]+)$/);
  if (jpCallMatch) {
    const isCall = jpCallMatch[1] === 'CALL';
    const valStr = jpCallMatch[2];
    const nn = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(nn)) {
      return [isCall ? 0xcd : 0xc3, nn & 0xff, (nn >> 8) & 0xff];
    }
  }

  // JR e / DJNZ e
  const jrMatch = compact.match(/^(JR|DJNZ)([0-9A-F]+H?|[0-9]+)$/);
  if (jrMatch) {
    const isDJNZ = jrMatch[1] === 'DJNZ';
    const valStr = jrMatch[2];
    const targetAddr = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(targetAddr)) {
      const offset = (targetAddr - (currentAddr + 2)) & 0xff;
      return [isDJNZ ? 0x10 : 0x18, offset];
    }
  }

  // Conditional Relative Jumps (JR NZ,e / JR Z,e / JR NC,e / JR C,e)
  const jrCondMatch = compact.match(/^JR(NZ|Z|NC|C),([0-9A-F]+H?|[0-9]+)$/);
  if (jrCondMatch) {
    const conds = ['NZ', 'Z', 'NC', 'C'];
    const idx = conds.indexOf(jrCondMatch[1]);
    const valStr = jrCondMatch[2];
    const targetAddr = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(targetAddr)) {
      const offset = (targetAddr - (currentAddr + 2)) & 0xff;
      return [0x20 | (idx << 3), offset];
    }
  }

  // Conditional Jumps
  const jpCondMatch = compact.match(/^JP(NZ|Z|NC|C),([0-9A-F]+H?|[0-9]+)$/);
  if (jpCondMatch) {
    const conds = ['NZ', 'Z', 'NC', 'C'];
    const idx = conds.indexOf(jpCondMatch[1]);
    const valStr = jpCondMatch[2];
    const nn = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(nn)) {
      return [0xc2 | (idx << 3), nn & 0xff, (nn >> 8) & 0xff];
    }
  }

  // LD (HL), r / LD r, (HL)
  const ldHLRegMatch = compact.match(/^LD\(HL\),([A-EHL]|B|C|D|E|H|L|A)$/);
  if (ldHLRegMatch) {
    const s = REGS_MAP[ldHLRegMatch[1]];
    if (s !== 6) return [0x70 | s];
  }
  const ldRegHLMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),\(HL\)$/);
  if (ldRegHLMatch) {
    const d = REGS_MAP[ldRegHLMatch[1]];
    if (d !== 6) return [0x46 | (d << 3)];
  }

  // LD (HL), A / LD A, (HL)
  if (compact === 'LD(HL),A') return [0x77];
  if (compact === 'LDA,(HL)') return [0x7e];
  if (compact === 'LD(BC),A') return [0x02];
  if (compact === 'LD(DE),A') return [0x12];
  if (compact === 'LDA,(BC)') return [0x0a];
  if (compact === 'LDA,(DE)') return [0x1a];

  // LD (nn), A / LD A, (nn)
  const ldMemAMatch = compact.match(/^LD\(([0-9A-F]+H?|[0-9]+)\),A$/);
  if (ldMemAMatch) {
    const valStr = ldMemAMatch[1];
    if (valStr !== 'BC' && valStr !== 'DE' && valStr !== 'HL') {
      const val = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
      if (!isNaN(val)) {
        return [0x32, val & 0xff, (val >> 8) & 0xff];
      }
    }
  }
  const ldAMemMatch = compact.match(/^LDA,\(([0-9A-F]+H?|[0-9]+)\)$/);
  if (ldAMemMatch) {
    const valStr = ldAMemMatch[1];
    if (valStr !== 'BC' && valStr !== 'DE' && valStr !== 'HL') {
      const val = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
      if (!isNaN(val)) {
        return [0x3a, val & 0xff, (val >> 8) & 0xff];
      }
    }
  }

  // LD (HL), n
  const ldHLnMatch = compact.match(/^LD\(HL\),([0-9A-F]+H?|[0-9]+)$/);
  if (ldHLnMatch) {
    const valStr = ldHLnMatch[1];
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(n)) {
      return [0x36, n & 0xff];
    }
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

  // OUT (n), A / IN A, (n)
  const outNMMatch = compact.match(/^OUT\(([0-9A-F]+H?|[0-9]+)\),A$/);
  if (outNMMatch) {
    const valStr = outNMMatch[1];
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(n)) {
      return [0xd3, n & 0xff];
    }
  }
  const inNAMatch = compact.match(/^INA,\(([0-9A-F]+H?|[0-9]+)\)$/);
  if (inNAMatch) {
    const valStr = inNAMatch[1];
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(n)) {
      return [0xdb, n & 0xff];
    }
  }

  // OUT (C), r / IN r, (C)
  const outCRMatch = compact.match(/^OUT\(C\),([A-EHL]|B|C|D|E|H|L|A)$/);
  if (outCRMatch) {
    const r = REGS_MAP[outCRMatch[1]];
    return [0xed, 0x41 | (r << 3)];
  }
  const inRCMatch = compact.match(/^IN([A-EHL]|B|C|D|E|H|L|A),\(C\)$/);
  if (inRCMatch) {
    const r = REGS_MAP[inRCMatch[1]];
    return [0xed, 0x40 | (r << 3)];
  }

  // LD IX, nn / LD IY, nn
  const ldIXIYnnMatch = compact.match(/^LD(IX|IY),([-+]?[0-9A-F]+H?|[0-9]+)$/);
  if (ldIXIYnnMatch) {
    const isIY = ldIXIYnnMatch[1] === 'IY';
    const valStr = ldIXIYnnMatch[2];
    const nn = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(nn)) {
      return [isIY ? 0xfd : 0xdd, 0x21, nn & 0xff, (nn >> 8) & 0xff];
    }
  }

  // LD r, (IX+d) / LD r, (IY+d)
  const ldRIXYdMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),\((IX|IY)([-+][0-9A-F]+H?|[-+][0-9]+)?\)$/);
  if (ldRIXYdMatch) {
    const r = REGS_MAP[ldRIXYdMatch[1]];
    const isIY = ldRIXYdMatch[2] === 'IY';
    const dStr = ldRIXYdMatch[3] || '0';
    const d = dStr.endsWith('H') ? parseInt(dStr.slice(0, -1), 16) : parseInt(dStr, 10);
    if (!isNaN(d)) {
      if (r === 6) { // (HL) is not allowed here
        return [];
      }
      return [isIY ? 0xfd : 0xdd, 0x40 | (r << 3) | 6, d & 0xff];
    }
  }

  // LD (IX+d), r / LD (IY+d), r
  const ldIXYdRMatch = compact.match(/^LD\((IX|IY)([-+][0-9A-F]+H?|[-+][0-9]+)?\),([A-EHL]|B|C|D|E|H|L|A)$/);
  if (ldIXYdRMatch) {
    const isIY = ldIXYdRMatch[1] === 'IY';
    const dStr = ldIXYdRMatch[2] || '0';
    const r = REGS_MAP[ldIXYdRMatch[3]];
    const d = dStr.endsWith('H') ? parseInt(dStr.slice(0, -1), 16) : parseInt(dStr, 10);
    if (!isNaN(d)) {
      if (r === 6) { // (HL) is not allowed here
        return [];
      }
      return [isIY ? 0xfd : 0xdd, 0x70 | r, d & 0xff];
    }
  }

  // LD (IX+d), n / LD (IY+d), n
  const ldIXYdNMatch = compact.match(/^LD\((IX|IY)([-+][0-9A-F]+H?|[-+][0-9]+)?\),([0-9A-F]+H?|[0-9]+)$/);
  if (ldIXYdNMatch) {
    const isIY = ldIXYdNMatch[1] === 'IY';
    const dStr = ldIXYdNMatch[2] || '0';
    const valStr = ldIXYdNMatch[3];
    const d = dStr.endsWith('H') ? parseInt(dStr.slice(0, -1), 16) : parseInt(dStr, 10);
    const n = valStr.endsWith('H') ? parseInt(valStr.slice(0, -1), 16) : parseInt(valStr, 10);
    if (!isNaN(d) && !isNaN(n)) {
      return [isIY ? 0xfd : 0xdd, 0x36, d & 0xff, n & 0xff];
    }
  }

  // INC/DEC IX / INC IY / DEC IX / DEC IY
  const incDecIXYMatch = compact.match(/^(INC|DEC)(IX|IY)$/);
  if (incDecIXYMatch) {
    const isInc = incDecIXYMatch[1] === 'INC';
    const isIY = incDecIXYMatch[2] === 'IY';
    return [isIY ? 0xfd : 0xdd, isInc ? 0x23 : 0x2b];
  }

  // INC/DEC (IX+d) / (IY+d)
  const incDecIXYdMatch = compact.match(/^(INC|DEC)\((IX|IY)([-+][0-9A-F]+H?|[-+][0-9]+)?\)$/);
  if (incDecIXYdMatch) {
    const isInc = incDecIXYdMatch[1] === 'INC';
    const isIY = incDecIXYdMatch[2] === 'IY';
    const dStr = incDecIXYdMatch[3] || '0';
    const d = dStr.endsWith('H') ? parseInt(dStr.slice(0, -1), 16) : parseInt(dStr, 10);
    if (!isNaN(d)) {
      return [isIY ? 0xfd : 0xdd, isInc ? 0x34 : 0x35, d & 0xff];
    }
  }

  // PUSH IX / PUSH IY / POP IX / POP IY
  const pushPopIXYMatch = compact.match(/^(PUSH|POP)(IX|IY)$/);
  if (pushPopIXYMatch) {
    const isPush = pushPopIXYMatch[1] === 'PUSH';
    const isIY = pushPopIXYMatch[2] === 'IY';
    return [isIY ? 0xfd : 0xdd, isPush ? 0xe5 : 0xe1];
  }

  // EX AF,AF' / EXX
  if (compact === 'EXAF,AF\'') return [0x08];
  if (compact === 'EXX') return [0xd9];

  // ED prefix instructions
  if (compact === 'NEG') return [0xed, 0x44];
  if (compact === 'RETN') return [0xed, 0x45];
  if (compact === 'RETI') return [0xed, 0x4d];
  if (compact === 'RRD') return [0xed, 0x67];
  if (compact === 'RLD') return [0xed, 0x6f];
  if (compact === 'LDI,A') return [0xed, 0x47];
  if (compact === 'LDR,A') return [0xed, 0x4f];
  if (compact === 'LDA,I') return [0xed, 0x57];
  if (compact === 'LDA,R') return [0xed, 0x5f];
  if (compact === 'LDIR') return [0xed, 0xb0];
  if (compact === 'LDDR') return [0xed, 0xb8];
  if (compact === 'CPIR') return [0xed, 0xb1];
  if (compact === 'CPDR') return [0xed, 0xb9];
  if (compact === 'INIR') return [0xed, 0xa2];
  if (compact === 'INDR') return [0xed, 0xaa];
  if (compact === 'OTIR') return [0xed, 0xa3];
  if (compact === 'OTDR') return [0xed, 0xab];

  // Interrupt modes
  const imMatch = compact.match(/^IM([0-2])$/);
  if (imMatch) {
    const mode = parseInt(imMatch[1]);
    const opcodes = [0x46, 0x56, 0x5e];
    return [0xed, opcodes[mode]];
  }

  // ADD HL, rr
  const addHLMatch = compact.match(/^ADDHL,(BC|DE|HL|SP)$/);
  if (addHLMatch) {
    const opcodes: Record<string, number> = { BC: 0x09, DE: 0x19, HL: 0x29, SP: 0x39 };
    return [opcodes[addHLMatch[1]]];
  }

  // ADD IX/IY, rr
  const addIXYMatch = compact.match(/^ADD(IX|IY),([-+]?[0-9A-F]+H?|[0-9]+|BC|DE|IX|IY|SP)$/);
  if (addIXYMatch) {
    const prefix = addIXYMatch[1] === 'IY' ? 0xfd : 0xdd;
    const arg = addIXYMatch[2];
    const rrMap: Record<string, number> = { BC: 0x09, DE: 0x19, IX: 0x29, IY: 0x29, SP: 0x39 };
    if (arg in rrMap) {
      return [prefix, rrMap[arg]];
    }
    // Note: Z80 doesn't have "ADD IX, nn", but the compiler might generate it.
    // If it's a number, we'll ignore it for now or return [] to avoid wrong machine code.
  }

  // LD SP, HL
  if (compact === 'LDSP,HL') return [0xf9];

  // 16-bit ADC HL,ss
  const adcHLMatch = compact.match(/^ADCHL,(BC|DE|HL|SP)$/);
  if (adcHLMatch) {
    const regs = ['BC', 'DE', 'HL', 'SP'];
    const idx = regs.indexOf(adcHLMatch[1]);
    const opcodes = [0x4a, 0x5a, 0x6a, 0x7a];
    return [0xed, opcodes[idx]];
  }

  // 16-bit SBC HL,ss
  const sbcHLMatch = compact.match(/^SBCHL,(BC|DE|HL|SP)$/);
  if (sbcHLMatch) {
    const regs = ['BC', 'DE', 'HL', 'SP'];
    const idx = regs.indexOf(sbcHLMatch[1]);
    const opcodes = [0x42, 0x52, 0x62, 0x72];
    return [0xed, opcodes[idx]];
  }

  return [];
};

// ===== Disassembler (テキスト書き出し用) =====
export function disasm(code: Uint8Array, start: number, count = 128) {
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
        case 0x03: text = 'INC BC'; pc += 1; break;
        case 0x04: text = 'INC B'; pc += 1; break;
        case 0x05: text = 'DEC B'; pc += 1; break;
        case 0x06: text = `LD B,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x08: text = 'EX AF,AF\''; pc += 1; break;
        case 0x09: text = 'ADD HL,BC'; pc += 1; break;
        case 0x0b: text = 'DEC BC'; pc += 1; break;
        case 0x0c: text = 'INC C'; pc += 1; break;
        case 0x0d: text = 'DEC C'; pc += 1; break;
        case 0x0e: text = `LD C,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x11: text = `LD DE,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x13: text = 'INC DE'; pc += 1; break;
        case 0x14: text = 'INC D'; pc += 1; break;
        case 0x15: text = 'DEC D'; pc += 1; break;
        case 0x16: text = `LD D,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x19: text = 'ADD HL,DE'; pc += 1; break;
        case 0x1b: text = 'DEC DE'; pc += 1; break;
        case 0x1c: text = 'INC E'; pc += 1; break;
        case 0x1d: text = 'DEC E'; pc += 1; break;
        case 0x1e: text = `LD E,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x21: text = `LD HL,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x22: text = `LD (${hex4(code[pc + 1] | (code[pc + 2] << 8))}),HL`; pc += 3; break;
        case 0x23: text = 'INC HL'; pc += 1; break;
        case 0x24: text = 'INC H'; pc += 1; break;
        case 0x25: text = 'DEC H'; pc += 1; break;
        case 0x26: text = `LD H,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x29: text = 'ADD HL,HL'; pc += 1; break;
        case 0x2a: text = `LD HL,(${hex4(code[pc + 1] | (code[pc + 2] << 8))})`; pc += 3; break;
        case 0x2b: text = 'DEC HL'; pc += 1; break;
        case 0x2c: text = 'INC L'; pc += 1; break;
        case 0x2d: text = 'DEC L'; pc += 1; break;
        case 0x2e: text = `LD L,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x31: text = `LD SP,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x33: text = 'INC SP'; pc += 1; break;
        case 0x34: text = 'INC (HL)'; pc += 1; break;
        case 0x35: text = 'DEC (HL)'; pc += 1; break;
        case 0x39: text = 'ADD HL,SP'; pc += 1; break;
        case 0x3b: text = 'DEC SP'; pc += 1; break;
        case 0x3c: text = 'INC A'; pc += 1; break;
        case 0x3d: text = 'DEC A'; pc += 1; break;
        case 0x3e: text = `LD A,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x02: text = 'LD (BC),A'; pc += 1; break;
        case 0x12: text = 'LD (DE),A'; pc += 1; break;
        case 0x0a: text = 'LD A,(BC)'; pc += 1; break;
        case 0x1a: text = 'LD A,(DE)'; pc += 1; break;
        case 0x32: text = `LD (${hex4(code[pc + 1] | (code[pc + 2] << 8))}),A`; pc += 3; break;
        case 0x3a: text = `LD A,(${hex4(code[pc + 1] | (code[pc + 2] << 8))})`; pc += 3; break;
        case 0x36: text = `LD (HL),${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x07: text = 'RLCA'; pc += 1; break;
        case 0x0f: text = 'RRCA'; pc += 1; break;
        case 0x17: text = 'RLA'; pc += 1; break;
        case 0x1f: text = 'RRA'; pc += 1; break;
        case 0x27: text = 'DAA'; pc += 1; break;
        case 0x2f: text = 'CPL'; pc += 1; break;
        case 0x37: text = 'SCF'; pc += 1; break;
        case 0x3f: text = 'CCF'; pc += 1; break;
        case 0x76: text = 'HALT'; pc += 1; break;
        case 0xeb: text = 'EX DE,HL'; pc += 1; break;
        case 0xf3: text = 'DI'; pc += 1; break;
        case 0xf9: text = 'LD SP,HL'; pc += 1; break;
        case 0xfb: text = 'EI'; pc += 1; break;
        case 0xc2: text = `JP NZ,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xca: text = `JP Z,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xd2: text = `JP NC,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xda: text = `JP C,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xe2: text = `JP PO,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xea: text = `JP PE,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xf2: text = `JP P,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xfa: text = `JP M,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x20: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR NZ,${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0x28: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR Z,${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0x30: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR NC,${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0x38: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR C,${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0xc3: text = `JP ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xcd: text = `CALL ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xc0: text = 'RET NZ'; pc += 1; break;
        case 0xc8: text = 'RET Z'; pc += 1; break;
        case 0xd0: text = 'RET NC'; pc += 1; break;
        case 0xd8: text = 'RET C'; pc += 1; break;
        case 0xe0: text = 'RET PO'; pc += 1; break;
        case 0xe8: text = 'RET PE'; pc += 1; break;
        case 0xf0: text = 'RET P'; pc += 1; break;
        case 0xf8: text = 'RET M'; pc += 1; break;
        case 0xc9: text = 'RET'; pc += 1; break;
        case 0xd3: text = `OUT (${hex2(code[pc + 1])}),A`; pc += 2; break;
        case 0xdb: text = `IN A,(${hex2(code[pc + 1])})`; pc += 2; break;
        case 0xd9: text = 'EXX'; pc += 1; break;
        case 0xc6: case 0xce: case 0xd6: case 0xde: case 0xe6: case 0xee: case 0xf6: case 0xfe: {
          const ops = ['ADD A,', 'ADC A,', 'SUB ', 'SBC A,', 'AND ', 'XOR ', 'OR ', 'CP '];
          text = `${ops[(op >> 3) & 7]}${hex2(code[pc + 1])}`;
          pc += 2; break;
        }
        case 0x18: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `JR ${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0x10: { let off = code[pc + 1]; if (off > 127) off -= 256; text = `DJNZ ${hex4(pc + 2 + off)}`; pc += 2; break; }
        case 0xcb: {
          const cbOp = code[pc + 1];
          const r = REGS_LIST[cbOp & 7];
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
          const edOp = code[pc + 1];
          switch (edOp) {
            case 0x44: text = 'NEG'; break;
            case 0x45: text = 'RETN'; break;
            case 0x46: text = 'IM 0'; break;
            case 0x47: text = 'LD I,A'; break;
            case 0x4a: text = 'ADC HL,BC'; break;
            case 0x4d: text = 'RETI'; break;
            case 0x4f: text = 'LD R,A'; break;
            case 0x42: text = 'SBC HL,BC'; break;
            case 0x40: case 0x48: case 0x50: case 0x58: case 0x60: case 0x68: case 0x78:
              text = `IN ${REGS_LIST[(edOp >> 3) & 7]},(C)`; break;
            case 0x41: case 0x49: case 0x51: case 0x59: case 0x61: case 0x69: case 0x79:
              text = `OUT (C),${REGS_LIST[(edOp >> 3) & 7]}`; break;
            case 0x52: text = 'SBC HL,DE'; break;
            case 0x56: text = 'IM 1'; break;
            case 0x57: text = 'LD A,I'; break;
            case 0x5a: text = 'ADC HL,DE'; break;
            case 0x5e: text = 'IM 2'; break;
            case 0x5f: text = 'LD A,R'; break;
            case 0x62: text = 'SBC HL,HL'; break;
            case 0x67: text = 'RRD'; break;
            case 0x6a: text = 'ADC HL,HL'; break;
            case 0x6f: text = 'RLD'; break;
            case 0x72: text = 'SBC HL,SP'; break;
            case 0x7a: text = 'ADC HL,SP'; break;
            case 0xa2: text = 'INIR'; break;
            case 0xa3: text = 'OTIR'; break;
            case 0xaa: text = 'INDR'; break;
            case 0xab: text = 'OTDR'; break;
            case 0xb0: text = 'LDIR'; break;
            case 0xb1: text = 'CPIR'; break;
            case 0xb8: text = 'LDDR'; break;
            case 0xb9: text = 'CPDR'; break;
            default: text = `ED ${hex2(edOp)}`; break;
          }
          pc += 2; break;
        }
        case 0xdd: case 0xfd: {
          const isIY = op === 0xfd;
          const reg = isIY ? 'IY' : 'IX';
          const subOp = code[pc + 1];
          if (subOp === 0x21) {
            text = `LD ${reg},${hex4(code[pc + 2] | (code[pc + 3] << 8))}`;
            pc += 4;
          } else if (subOp === 0x36) {
            let d = code[pc + 2];
            if (d > 127) d -= 256;
            text = `LD (${reg}${d >= 0 ? '+' : ''}${d}),${hex2(code[pc + 3])}`;
            pc += 4;
          } else if (subOp >= 0x40 && subOp <= 0x7f && subOp !== 0x76) {
            let d = code[pc + 2];
            if (d > 127) d -= 256;
            const rIdx = subOp & 7;
            const dIdx = (subOp >> 3) & 7;
            if (rIdx === 6) {
              text = `LD ${REGS_LIST[dIdx]},(${reg}${d >= 0 ? '+' : ''}${d})`;
              pc += 3;
            } else if (dIdx === 6) {
              text = `LD (${reg}${d >= 0 ? '+' : ''}${d}),${REGS_LIST[rIdx]}`;
              pc += 3;
            } else {
              text = `${reg === 'IX' ? 'DD' : 'FD'} ${hex2(subOp)}`;
              pc += 2;
            }
          } else if (subOp === 0x09) {
            text = `ADD ${reg},BC`;
            pc += 2;
          } else if (subOp === 0x19) {
            text = `ADD ${reg},DE`;
            pc += 2;
          } else if (subOp === 0x29) {
            text = `ADD ${reg},${reg}`;
            pc += 2;
          } else if (subOp === 0x39) {
            text = `ADD ${reg},SP`;
            pc += 2;
          } else if (subOp === 0x23) {
            text = `INC ${reg}`;
            pc += 2;
          } else if (subOp === 0x2b) {
            text = `DEC ${reg}`;
            pc += 2;
          } else if (subOp === 0xe5) {
            text = `PUSH ${reg}`;
            pc += 2;
          } else if (subOp === 0xe1) {
            text = `POP ${reg}`;
            pc += 2;
          } else if (subOp === 0xf9) {
            text = `LD SP,${reg}`;
            pc += 2;
          } else {
            text = `${reg === 'IX' ? 'DD' : 'FD'} ${hex2(subOp)}`;
            pc += 2;
          }
          break;
        }
        default:
          if ((op & 0xc7) === 0x04) text = `INC ${REGS_LIST[(op >> 3) & 7]}`;
          else if ((op & 0xc7) === 0x05) text = `DEC ${REGS_LIST[(op >> 3) & 7]}`;
          else if ((op & 0xcf) === 0xc1) text = `POP ${['BC', 'DE', 'HL', 'AF'][(op >> 4) & 3]}`;
          else if ((op & 0xcf) === 0xc5) text = `PUSH ${['BC', 'DE', 'HL', 'AF'][(op >> 4) & 3]}`;
          else text = op !== 0 ? `?? ${hex2(op)}` : '-';
          pc += 1;
      }
    }
    out.push({ addr: currentPc, text });
  }
  return out;
}
