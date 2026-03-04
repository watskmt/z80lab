import { REGS_MAP, REGS_LIST, hex4, hex2, MEM_SIZE } from '../constants';

// ===== アセンブラ =====
export const assembleInstruction = (text: string, currentAddr: number): number[] => {
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
