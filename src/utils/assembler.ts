import { REGS_MAP, REGS_LIST, hex4, hex2, MEM_SIZE } from '../constants';

// ===== アセンブラ =====
export const assembleInstruction = (text: string, currentAddr: number): number[] => {
  const lineWithoutComment = text.split(';')[0];
  const s = lineWithoutComment.toUpperCase().trim();
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
  const ldRnMatch = compact.match(/^LD([A-EHL]|B|C|D|E|H|L|A),([0-9A-F]+H?|[0-9]+)$/);
  if (ldRnMatch) {
    const r = REGS_MAP[ldRnMatch[1]];
    const valStr = ldRnMatch[2];
    const n = valStr.endsWith('H') ? parseInt(valStr, 16) : (valStr.match(/^[0-9]+$/) ? parseInt(valStr, 10) : parseInt(valStr, 16));
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
  const ldRRnnMatch = compact.match(/^LD(HL|BC|DE|SP),([0-9A-F]+H?|[0-9]+)$/);
  if (ldRRnnMatch) {
    const rr = ldRRnnMatch[1];
    const valStr = ldRRnnMatch[2];
    const nn = valStr.endsWith('H') ? parseInt(valStr, 16) : (valStr.match(/^[0-9]+$/) ? parseInt(valStr, 10) : parseInt(valStr, 16));
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
  if (compact === 'LD(BC),A') return [0x02];
  if (compact === 'LD(DE),A') return [0x12];
  if (compact === 'LDA,(BC)') return [0x0a];
  if (compact === 'LDA,(DE)') return [0x1a];

  // LD (nn), A / LD A, (nn)
  const ldMemAMatch = compact.match(/^LD\(([0-9A-F]{3,}|[0-9A-F]{1,2}H?|[0-9A-F]{2})\),A$/);
  if (ldMemAMatch) {
    const valStr = ldMemAMatch[1];
    if (valStr !== 'BC' && valStr !== 'DE' && valStr !== 'HL') {
      const nn = parseInt(valStr, 16);
      return [0x32, nn & 0xff, (nn >> 8) & 0xff];
    }
  }
  const ldAMemMatch = compact.match(/^LDA,\(([0-9A-F]{3,}|[0-9A-F]{1,2}H?|[0-9A-F]{2})\)$/);
  if (ldAMemMatch) {
    const valStr = ldAMemMatch[1];
    if (valStr !== 'BC' && valStr !== 'DE' && valStr !== 'HL') {
      const nn = parseInt(valStr, 16);
      return [0x3a, nn & 0xff, (nn >> 8) & 0xff];
    }
  }

  // LD (HL), n
  const ldHLnMatch = compact.match(/^LD\(HL\),([0-9A-F]+H?|[0-9]+)$/);
  if (ldHLnMatch) {
    const valStr = ldHLnMatch[1];
    const n = valStr.endsWith('H') ? parseInt(valStr, 16) : (valStr.match(/^[0-9]+$/) ? parseInt(valStr, 10) : parseInt(valStr, 16));
    return [0x36, n & 0xff];
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
  const outNMMatch = compact.match(/^OUT\(([0-9A-F]+)H?\),A$/);
  if (outNMMatch) {
    return [0xd3, parseInt(outNMMatch[1], 16) & 0xff];
  }
  const inNAMatch = compact.match(/^INA,\(([0-9A-F]+)H?\)$/);
  if (inNAMatch) {
    return [0xdb, parseInt(inNAMatch[1], 16) & 0xff];
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
  const ldIXIYnnMatch = compact.match(/^LD(IX|IY),([0-9A-F]+)H?$/);
  if (ldIXIYnnMatch) {
    const isIY = ldIXIYnnMatch[1] === 'IY';
    const nn = parseInt(ldIXIYnnMatch[2], 16);
    return [isIY ? 0xfd : 0xdd, 0x21, nn & 0xff, (nn >> 8) & 0xff];
  }

  // LD (IX+d), n / LD (IY+d), n
  const ldIXYdNMatch = compact.match(/^LD\((IX|IY)\+([0-9A-F]+)H?\),([0-9A-F]+)H?$/);
  if (ldIXYdNMatch) {
    const isIY = ldIXYdNMatch[1] === 'IY';
    const d = parseInt(ldIXYdNMatch[2], 16);
    const n = parseInt(ldIXYdNMatch[3], 16);
    const offset = d > 127 ? d - 256 : d;
    return [isIY ? 0xfd : 0xdd, 0x36, offset & 0xff, n & 0xff];
  }

  // LD A, (IX+d) / LD A, (IY+d)
  const ldAIXYdMatch = compact.match(/^LDA,\((IX|IY)\+([0-9A-F]+)H?\)$/);
  if (ldAIXYdMatch) {
    const isIY = ldAIXYdMatch[1] === 'IY';
    const d = parseInt(ldAIXYdMatch[2], 16);
    const offset = d > 127 ? d - 256 : d;
    return [isIY ? 0xfd : 0xdd, 0x7e, offset & 0xff];
  }

  // LD (IX+d), A / LD (IY+d), A
  const ldIXYdAMatch = compact.match(/^LD\((IX|IY)\+([0-9A-F]+)H?\),A$/);
  if (ldIXYdAMatch) {
    const isIY = ldIXYdAMatch[1] === 'IY';
    const d = parseInt(ldIXYdAMatch[2], 16);
    const offset = d > 127 ? d - 256 : d;
    return [isIY ? 0xfd : 0xdd, 0x77, offset & 0xff];
  }

  // INC IX / INC IY / DEC IX / DEC IY
  const incDecIXYMatch = compact.match(/^(INC|DEC)(IX|IY)$/);
  if (incDecIXYMatch) {
    const isInc = incDecIXYMatch[1] === 'INC';
    const isIY = incDecIXYMatch[2] === 'IY';
    return [isIY ? 0xfd : 0xdd, isInc ? 0x23 : 0x2b];
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
        case 0x06: text = `LD B,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x08: text = 'EX AF,AF\''; pc += 1; break;
        case 0x0e: text = `LD C,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x11: text = `LD DE,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x16: text = `LD D,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x1e: text = `LD E,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x21: text = `LD HL,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x26: text = `LD H,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x2e: text = `LD L,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x31: text = `LD SP,${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0x3e: text = `LD A,${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x02: text = 'LD (BC),A'; pc += 1; break;
        case 0x12: text = 'LD (DE),A'; pc += 1; break;
        case 0x0a: text = 'LD A,(BC)'; pc += 1; break;
        case 0x1a: text = 'LD A,(DE)'; pc += 1; break;
        case 0x32: text = `LD (${hex4(code[pc + 1] | (code[pc + 2] << 8))}),A`; pc += 3; break;
        case 0x3a: text = `LD A,(${hex4(code[pc + 1] | (code[pc + 2] << 8))})`; pc += 3; break;
        case 0x36: text = `LD (HL),${hex2(code[pc + 1])}`; pc += 2; break;
        case 0x76: text = 'HALT'; pc += 1; break;
        case 0xc3: text = `JP ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xcd: text = `CALL ${hex4(code[pc + 1] | (code[pc + 2] << 8))}`; pc += 3; break;
        case 0xc9: text = 'RET'; pc += 1; break;
        case 0xd3: text = `OUT (${hex2(code[pc + 1])}),A`; pc += 2; break;
        case 0xdb: text = `IN A,(${hex2(code[pc + 1])})`; pc += 2; break;
        case 0xd9: text = 'EXX'; pc += 1; break;
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
            text = `LD (${reg}+${hex2(d)}),${hex2(code[pc + 3])}`;
            pc += 4;
          } else if (subOp === 0x7e) {
            let d = code[pc + 2];
            if (d > 127) d -= 256;
            text = `LD A,(${reg}+${hex2(d)})`;
            pc += 3;
          } else if (subOp === 0x77) {
            let d = code[pc + 2];
            if (d > 127) d -= 256;
            text = `LD (${reg}+${hex2(d)}),A`;
            pc += 3;
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
          else text = op !== 0 ? `DB ${hex2(op)}` : '-';
          pc += 1;
      }
    }
    out.push({ addr: currentPc, text });
  }
  return out;
}
