import { describe, it, expect } from 'vitest';
import { assembleInstruction, disasm } from './assembler';

/** Disassemble a single instruction from raw bytes at address 0 */
const disasmOne = (bytes: number[]): string => {
  const mem = new Uint8Array(0x10000);
  bytes.forEach((b, i) => { mem[i] = b; });
  return disasm(mem, 0, 1)[0].text;
};

// ============================================================
// assembleInstruction
// ============================================================
describe('assembleInstruction', () => {

  describe('1-byte opcodes', () => {
    it.each<[string, number[]]>([
      ['NOP',        [0x00]],
      ['HALT',       [0x76]],
      ['RET',        [0xc9]],
      ['EX DE,HL',   [0xeb]],
      ['DI',         [0xf3]],
      ['EI',         [0xfb]],
      ['RLCA',       [0x07]],
      ['RRCA',       [0x0f]],
      ['RLA',        [0x17]],
      ['RRA',        [0x1f]],
      ['DAA',        [0x27]],
      ['CPL',        [0x2f]],
      ['SCF',        [0x37]],
      ['CCF',        [0x3f]],
      ["EX AF,AF'",  [0x08]],
      ['EXX',        [0xd9]],
      ['LD SP,HL',   [0xf9]],
      ['NEG',        [0xed, 0x44]],
      ['RETN',       [0xed, 0x45]],
      ['RETI',       [0xed, 0x4d]],
      ['RRD',        [0xed, 0x67]],
      ['RLD',        [0xed, 0x6f]],
      ['LDIR',       [0xed, 0xb0]],
      ['LDDR',       [0xed, 0xb8]],
      ['CPIR',       [0xed, 0xb1]],
      ['CPDR',       [0xed, 0xb9]],
      ['INIR',       [0xed, 0xa2]],
      ['INDR',       [0xed, 0xaa]],
      ['OTIR',       [0xed, 0xa3]],
      ['OTDR',       [0xed, 0xab]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('LD r, r\'', () => {
    it.each<[string, number[]]>([
      ['LD A, B', [0x78]],
      ['LD A, C', [0x79]],
      ['LD A, D', [0x7a]],
      ['LD A, E', [0x7b]],
      ['LD A, H', [0x7c]],
      ['LD A, L', [0x7d]],
      ['LD A, A', [0x7f]],
      ['LD B, A', [0x47]],
      ['LD B, B', [0x40]],
      ['LD B, C', [0x41]],
      ['LD C, D', [0x4a]],
      ['LD D, E', [0x53]],
      ['LD H, L', [0x65]],
      ['LD L, H', [0x6c]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('LD r, n', () => {
    it.each<[string, number[]]>([
      ['LD B, 01H',  [0x06, 0x01]],
      ['LD C, 02H',  [0x0e, 0x02]],
      ['LD D, 03H',  [0x16, 0x03]],
      ['LD E, 04H',  [0x1e, 0x04]],
      ['LD H, 05H',  [0x26, 0x05]],
      ['LD L, 06H',  [0x2e, 0x06]],
      ['LD A, 07H',  [0x3e, 0x07]],
      ['LD A, 255',  [0x3e, 0xff]],
      ['LD B, 0',    [0x06, 0x00]],
      ['LD A, 0FFH', [0x3e, 0xff]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('INC r', () => {
    it.each<[string, number[]]>([
      ['INC B', [0x04]],
      ['INC C', [0x0c]],
      ['INC D', [0x14]],
      ['INC E', [0x1c]],
      ['INC H', [0x24]],
      ['INC L', [0x2c]],
      ['INC A', [0x3c]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('DEC r', () => {
    it.each<[string, number[]]>([
      ['DEC B', [0x05]],
      ['DEC C', [0x0d]],
      ['DEC D', [0x15]],
      ['DEC E', [0x1d]],
      ['DEC H', [0x25]],
      ['DEC L', [0x2d]],
      ['DEC A', [0x3d]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('INC / DEC rr', () => {
    it.each<[string, number[]]>([
      ['INC BC', [0x03]],
      ['INC DE', [0x13]],
      ['INC HL', [0x23]],
      ['INC SP', [0x33]],
      ['DEC BC', [0x0b]],
      ['DEC DE', [0x1b]],
      ['DEC HL', [0x2b]],
      ['DEC SP', [0x3b]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('INC / DEC (HL)', () => {
    it.each<[string, number[]]>([
      ['INC (HL)', [0x34]],
      ['DEC (HL)', [0x35]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('ALU register', () => {
    it.each<[string, number[]]>([
      ['ADD A, B', [0x80]],
      ['ADD A, C', [0x81]],
      ['ADD A, D', [0x82]],
      ['ADD A, E', [0x83]],
      ['ADD A, H', [0x84]],
      ['ADD A, L', [0x85]],
      ['ADD A, A', [0x87]],
      ['ADC A, B', [0x88]],
      ['ADC A, A', [0x8f]],
      ['SUB B',    [0x90]],
      ['SUB C',    [0x91]],
      ['SUB A',    [0x97]],
      ['SBC A, B', [0x98]],
      ['SBC A, A', [0x9f]],
      ['AND B',    [0xa0]],
      ['AND A',    [0xa7]],
      ['XOR B',    [0xa8]],
      ['XOR A',    [0xaf]],
      ['OR B',     [0xb0]],
      ['OR A',     [0xb7]],
      ['CP B',     [0xb8]],
      ['CP A',     [0xbf]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('ALU immediate', () => {
    it.each<[string, number[]]>([
      ['ADD A, 10H', [0xc6, 0x10]],
      ['ADC A, 20H', [0xce, 0x20]],
      ['SUB 30H',    [0xd6, 0x30]],
      ['SBC A, 40H', [0xde, 0x40]],
      ['AND 0FH',    [0xe6, 0x0f]],
      ['XOR 01H',    [0xee, 0x01]],
      ['OR 80H',     [0xf6, 0x80]],
      ['CP FFH',     [0xfe, 0xff]],
      ['XOR 0EEH',   [0xee, 0xee]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('ADD HL, rr', () => {
    it.each<[string, number[]]>([
      ['ADD HL, BC', [0x09]],
      ['ADD HL, DE', [0x19]],
      ['ADD HL, HL', [0x29]],
      ['ADD HL, SP', [0x39]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('ADC HL, rr / SBC HL, rr', () => {
    it.each<[string, number[]]>([
      ['ADC HL, BC', [0xed, 0x4a]],
      ['ADC HL, DE', [0xed, 0x5a]],
      ['ADC HL, HL', [0xed, 0x6a]],
      ['ADC HL, SP', [0xed, 0x7a]],
      ['SBC HL, BC', [0xed, 0x42]],
      ['SBC HL, DE', [0xed, 0x52]],
      ['SBC HL, HL', [0xed, 0x62]],
      ['SBC HL, SP', [0xed, 0x72]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('LD rr, nn', () => {
    it.each<[string, number[]]>([
      ['LD BC, 1234H', [0x01, 0x34, 0x12]],
      ['LD DE, 5678H', [0x11, 0x78, 0x56]],
      ['LD HL, 9ABCH', [0x21, 0xbc, 0x9a]],
      ['LD SP, 0000H', [0x31, 0x00, 0x00]],
      ['LD HL, 0',     [0x21, 0x00, 0x00]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('LD IX/IY, nn', () => {
    it.each<[string, number[]]>([
      ['LD IX, 1234H', [0xdd, 0x21, 0x34, 0x12]],
      ['LD IY, 5678H', [0xfd, 0x21, 0x78, 0x56]],
      ['LD IX, 0',     [0xdd, 0x21, 0x00, 0x00]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('LD I/R', () => {
    it.each<[string, number[]]>([
      ['LD I, A', [0xed, 0x47]],
      ['LD R, A', [0xed, 0x4f]],
      ['LD A, I', [0xed, 0x57]],
      ['LD A, R', [0xed, 0x5f]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('IM 0/1/2', () => {
    it.each<[string, number[]]>([
      ['IM 0', [0xed, 0x46]],
      ['IM 1', [0xed, 0x56]],
      ['IM 2', [0xed, 0x5e]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('JP / CALL', () => {
    it.each<[string, number[]]>([
      ['JP 1234H',   [0xc3, 0x34, 0x12]],
      ['JP 0000H',   [0xc3, 0x00, 0x00]],
      ['CALL 1234H', [0xcd, 0x34, 0x12]],
      ['CALL 5678H', [0xcd, 0x78, 0x56]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('Conditional JP', () => {
    it.each<[string, number[]]>([
      ['JP NZ, 1234H', [0xc2, 0x34, 0x12]],
      ['JP Z, 1234H',  [0xca, 0x34, 0x12]],
      ['JP NC, 1234H', [0xd2, 0x34, 0x12]],
      ['JP C, 1234H',  [0xda, 0x34, 0x12]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('JR / DJNZ', () => {
    // forward: addr=0, target=5 → offset = 5-(0+2) = 3
    it('assembles JR forward', () => {
      expect(assembleInstruction('JR 0005H', 0)).toEqual([0x18, 0x03]);
    });
    it('assembles DJNZ forward', () => {
      expect(assembleInstruction('DJNZ 0005H', 0)).toEqual([0x10, 0x03]);
    });
    // backward: addr=10, target=8 → offset = 8-(10+2) = -4 = 0xfc
    it('assembles DJNZ backward', () => {
      expect(assembleInstruction('DJNZ 0008H', 10)).toEqual([0x10, 0xfc]);
    });
  });

  describe('Conditional JR', () => {
    // addr=0, target=0x0010 → offset = 16-2 = 14 = 0x0e
    it.each<[string, number[]]>([
      ['JR NZ, 0010H', [0x20, 0x0e]],
      ['JR Z, 0010H',  [0x28, 0x0e]],
      ['JR NC, 0010H', [0x30, 0x0e]],
      ['JR C, 0010H',  [0x38, 0x0e]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('Memory operations', () => {
    it.each<[string, number[]]>([
      // LD (HL), r
      ['LD (HL), B',    [0x70]],
      ['LD (HL), C',    [0x71]],
      ['LD (HL), D',    [0x72]],
      ['LD (HL), E',    [0x73]],
      ['LD (HL), H',    [0x74]],
      ['LD (HL), L',    [0x75]],
      ['LD (HL), A',    [0x77]],
      // LD r, (HL)
      ['LD B, (HL)',    [0x46]],
      ['LD C, (HL)',    [0x4e]],
      ['LD D, (HL)',    [0x56]],
      ['LD E, (HL)',    [0x5e]],
      ['LD H, (HL)',    [0x66]],
      ['LD L, (HL)',    [0x6e]],
      ['LD A, (HL)',    [0x7e]],
      // indirect register pairs
      ['LD (BC), A',   [0x02]],
      ['LD (DE), A',   [0x12]],
      ['LD A, (BC)',   [0x0a]],
      ['LD A, (DE)',   [0x1a]],
      // absolute address
      ['LD (8000H), A', [0x32, 0x00, 0x80]],
      ['LD A, (8001H)', [0x3a, 0x01, 0x80]],
      // LD (HL), n
      ['LD (HL), 55H',  [0x36, 0x55]],
      ['LD (HL), 0',    [0x36, 0x00]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('PUSH / POP', () => {
    it.each<[string, number[]]>([
      ['PUSH BC', [0xc5]],
      ['PUSH DE', [0xd5]],
      ['PUSH HL', [0xe5]],
      ['PUSH AF', [0xf5]],
      ['POP BC',  [0xc1]],
      ['POP DE',  [0xd1]],
      ['POP HL',  [0xe1]],
      ['POP AF',  [0xf1]],
      ['PUSH IX', [0xdd, 0xe5]],
      ['PUSH IY', [0xfd, 0xe5]],
      ['POP IX',  [0xdd, 0xe1]],
      ['POP IY',  [0xfd, 0xe1]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('BIT b, r', () => {
    it.each<[string, number[]]>([
      ['BIT 0, B', [0xcb, 0x40]],
      ['BIT 0, C', [0xcb, 0x41]],
      ['BIT 0, A', [0xcb, 0x47]],
      ['BIT 7, B', [0xcb, 0x78]],
      ['BIT 7, A', [0xcb, 0x7f]],
      ['BIT 3, H', [0xcb, 0x5c]],
      ['BIT 4, L', [0xcb, 0x65]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('I/O operations', () => {
    it.each<[string, number[]]>([
      // OUT/IN with immediate port
      ['OUT (00H), A', [0xd3, 0x00]],
      ['OUT (FFH), A', [0xd3, 0xff]],
      ['IN A, (01H)',  [0xdb, 0x01]],
      ['IN A, (00H)',  [0xdb, 0x00]],
      // OUT/IN with C register
      ['OUT (C), B',   [0xed, 0x41]],
      ['OUT (C), C',   [0xed, 0x49]],
      ['OUT (C), D',   [0xed, 0x51]],
      ['OUT (C), E',   [0xed, 0x59]],
      ['OUT (C), H',   [0xed, 0x61]],
      ['OUT (C), L',   [0xed, 0x69]],
      ['OUT (C), A',   [0xed, 0x79]],
      ['IN B, (C)',    [0xed, 0x40]],
      ['IN C, (C)',    [0xed, 0x48]],
      ['IN D, (C)',    [0xed, 0x50]],
      ['IN E, (C)',    [0xed, 0x58]],
      ['IN H, (C)',    [0xed, 0x60]],
      ['IN L, (C)',    [0xed, 0x68]],
      ['IN A, (C)',    [0xed, 0x78]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('IX / IY indexed addressing', () => {
    it.each<[string, number[]]>([
      // LD r, (IX/IY+d)
      ['LD A, (IX+05H)',    [0xdd, 0x7e, 0x05]],
      ['LD B, (IX+00H)',    [0xdd, 0x46, 0x00]],
      ['LD C, (IY+01H)',    [0xfd, 0x4e, 0x01]],
      ['LD A, (IY+FFH)',    [0xfd, 0x7e, 0xff]],
      // LD (IX/IY+d), r
      ['LD (IX+05H), A',   [0xdd, 0x77, 0x05]],
      ['LD (IY+02H), B',   [0xfd, 0x70, 0x02]],
      ['LD (IX+00H), C',   [0xdd, 0x71, 0x00]],
      // LD (IX/IY+d), n
      ['LD (IX+05H), 10H', [0xdd, 0x36, 0x05, 0x10]],
      ['LD (IY+00H), FFH', [0xfd, 0x36, 0x00, 0xff]],
      // INC/DEC IX/IY
      ['INC IX',           [0xdd, 0x23]],
      ['INC IY',           [0xfd, 0x23]],
      ['DEC IX',           [0xdd, 0x2b]],
      ['DEC IY',           [0xfd, 0x2b]],
      // INC/DEC (IX/IY+d)
      ['INC (IX+02H)',     [0xdd, 0x34, 0x02]],
      ['DEC (IY+03H)',     [0xfd, 0x35, 0x03]],
      // ADD IX/IY, rr
      ['ADD IX, BC',       [0xdd, 0x09]],
      ['ADD IX, DE',       [0xdd, 0x19]],
      ['ADD IX, IX',       [0xdd, 0x29]],
      ['ADD IX, SP',       [0xdd, 0x39]],
      ['ADD IY, BC',       [0xfd, 0x09]],
      ['ADD IY, DE',       [0xfd, 0x19]],
      ['ADD IY, IY',       [0xfd, 0x29]],
      ['ADD IY, SP',       [0xfd, 0x39]],
    ])('assembles %s', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });
  });

  describe('Directives and comments', () => {
    it.each<[string, number[]]>([
      ['DB 01H',  []],
      ['DW 1234H', []],
      ['ORG 1000H', []],
      ['END',     []],
      ['',        []],
      ['-',       []],
    ])('"%s" returns []', (mnem, expected) => {
      expect(assembleInstruction(mnem, 0)).toEqual(expected);
    });

    it('ignores comments', () => {
      expect(assembleInstruction('NOP ; do nothing', 0)).toEqual([0x00]);
    });
    it('handles extra whitespace', () => {
      expect(assembleInstruction('  LD   A ,  01H  ', 0)).toEqual([0x3e, 0x01]);
    });
    it('handles lowercase hex suffix', () => {
      expect(assembleInstruction('LD A, 0ffh', 0)).toEqual([0x3e, 0xff]);
    });
    it('handles 0x prefix hex', () => {
      expect(assembleInstruction('LD A, 0xFF', 0)).toEqual([0x3e, 0xff]);
    });
  });
});

// ============================================================
// disasm
// ============================================================
describe('disasm', () => {

  describe('1-byte opcodes', () => {
    it.each<[number[], string]>([
      [[0x00], 'NOP'],
      [[0x76], 'HALT'],
      [[0xc9], 'RET'],
      [[0xeb], 'EX DE,HL'],
      [[0xf3], 'DI'],
      [[0xfb], 'EI'],
      [[0x07], 'RLCA'],
      [[0x0f], 'RRCA'],
      [[0x17], 'RLA'],
      [[0x1f], 'RRA'],
      [[0x27], 'DAA'],
      [[0x2f], 'CPL'],
      [[0x37], 'SCF'],
      [[0x3f], 'CCF'],
      [[0x08], "EX AF,AF'"],
      [[0xd9], 'EXX'],
      [[0xf9], 'LD SP,HL'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('LD r, r\' and LD r, (HL)', () => {
    it.each<[number[], string]>([
      [[0x78], 'LD A,B'],
      [[0x79], 'LD A,C'],
      [[0x7a], 'LD A,D'],
      [[0x7b], 'LD A,E'],
      [[0x7c], 'LD A,H'],
      [[0x7d], 'LD A,L'],
      [[0x7f], 'LD A,A'],
      [[0x47], 'LD B,A'],
      [[0x40], 'LD B,B'],
      [[0x4a], 'LD C,D'],
      [[0x53], 'LD D,E'],
      [[0x65], 'LD H,L'],
      [[0x6c], 'LD L,H'],
      // LD r, (HL)
      [[0x7e], 'LD A,(HL)'],
      [[0x46], 'LD B,(HL)'],
      [[0x4e], 'LD C,(HL)'],
      [[0x56], 'LD D,(HL)'],
      [[0x5e], 'LD E,(HL)'],
      [[0x66], 'LD H,(HL)'],
      [[0x6e], 'LD L,(HL)'],
      // LD (HL), r
      [[0x70], 'LD (HL),B'],
      [[0x71], 'LD (HL),C'],
      [[0x72], 'LD (HL),D'],
      [[0x73], 'LD (HL),E'],
      [[0x74], 'LD (HL),H'],
      [[0x75], 'LD (HL),L'],
      [[0x77], 'LD (HL),A'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('LD r, n', () => {
    it.each<[number[], string]>([
      [[0x06, 0x01], 'LD B,01'],
      [[0x0e, 0x02], 'LD C,02'],
      [[0x16, 0x03], 'LD D,03'],
      [[0x1e, 0x04], 'LD E,04'],
      [[0x26, 0x05], 'LD H,05'],
      [[0x2e, 0x06], 'LD L,06'],
      [[0x3e, 0xff], 'LD A,FF'],
      [[0x36, 0x55], 'LD (HL),55'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('INC / DEC r', () => {
    it.each<[number[], string]>([
      [[0x04], 'INC B'],
      [[0x0c], 'INC C'],
      [[0x14], 'INC D'],
      [[0x1c], 'INC E'],
      [[0x24], 'INC H'],
      [[0x2c], 'INC L'],
      [[0x3c], 'INC A'],
      [[0x05], 'DEC B'],
      [[0x0d], 'DEC C'],
      [[0x15], 'DEC D'],
      [[0x1d], 'DEC E'],
      [[0x25], 'DEC H'],
      [[0x2d], 'DEC L'],
      [[0x3d], 'DEC A'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('INC / DEC rr and (HL)', () => {
    it.each<[number[], string]>([
      [[0x03], 'INC BC'],
      [[0x13], 'INC DE'],
      [[0x23], 'INC HL'],
      [[0x33], 'INC SP'],
      [[0x0b], 'DEC BC'],
      [[0x1b], 'DEC DE'],
      [[0x2b], 'DEC HL'],
      [[0x3b], 'DEC SP'],
      [[0x34], 'INC (HL)'],
      [[0x35], 'DEC (HL)'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('ALU register', () => {
    it.each<[number[], string]>([
      [[0x80], 'ADD A,B'],
      [[0x81], 'ADD A,C'],
      [[0x87], 'ADD A,A'],
      [[0x88], 'ADC A,B'],
      [[0x8f], 'ADC A,A'],
      [[0x90], 'SUB B'],
      [[0x97], 'SUB A'],
      [[0x98], 'SBC A,B'],
      [[0x9f], 'SBC A,A'],
      [[0xa0], 'AND B'],
      [[0xa7], 'AND A'],
      [[0xa8], 'XOR B'],
      [[0xaf], 'XOR A'],
      [[0xb0], 'OR B'],
      [[0xb7], 'OR A'],
      [[0xb8], 'CP B'],
      [[0xbf], 'CP A'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('ALU immediate', () => {
    it.each<[number[], string]>([
      [[0xc6, 0x10], 'ADD A,10'],
      [[0xce, 0x20], 'ADC A,20'],
      [[0xd6, 0x30], 'SUB 30'],
      [[0xde, 0x40], 'SBC A,40'],
      [[0xe6, 0x0f], 'AND 0F'],
      [[0xee, 0x01], 'XOR 01'],
      [[0xf6, 0x80], 'OR 80'],
      [[0xfe, 0xff], 'CP FF'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('ADD HL, rr', () => {
    it.each<[number[], string]>([
      [[0x09], 'ADD HL,BC'],
      [[0x19], 'ADD HL,DE'],
      [[0x29], 'ADD HL,HL'],
      [[0x39], 'ADD HL,SP'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('LD rr, nn', () => {
    it.each<[number[], string]>([
      [[0x01, 0x34, 0x12], 'LD BC,1234'],
      [[0x11, 0x78, 0x56], 'LD DE,5678'],
      [[0x21, 0xbc, 0x9a], 'LD HL,9ABC'],
      [[0x31, 0x00, 0x00], 'LD SP,0000'],
      [[0x22, 0x00, 0x40], 'LD (4000),HL'],
      [[0x2a, 0x00, 0x40], 'LD HL,(4000)'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('JP / CALL / RET', () => {
    it.each<[number[], string]>([
      [[0xc3, 0x34, 0x12], 'JP 1234'],
      [[0xcd, 0x78, 0x56], 'CALL 5678'],
      [[0xc9], 'RET'],
      [[0xc0], 'RET NZ'],
      [[0xc8], 'RET Z'],
      [[0xd0], 'RET NC'],
      [[0xd8], 'RET C'],
      [[0xe0], 'RET PO'],
      [[0xe8], 'RET PE'],
      [[0xf0], 'RET P'],
      [[0xf8], 'RET M'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('JP conditional', () => {
    it.each<[number[], string]>([
      [[0xc2, 0x34, 0x12], 'JP NZ,1234'],
      [[0xca, 0x34, 0x12], 'JP Z,1234'],
      [[0xd2, 0x34, 0x12], 'JP NC,1234'],
      [[0xda, 0x34, 0x12], 'JP C,1234'],
      [[0xe2, 0x34, 0x12], 'JP PO,1234'],
      [[0xea, 0x34, 0x12], 'JP PE,1234'],
      [[0xf2, 0x34, 0x12], 'JP P,1234'],
      [[0xfa, 0x34, 0x12], 'JP M,1234'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('JR / DJNZ (relative jumps from address 0)', () => {
    it.each<[number[], string]>([
      // offset 3 → target = 0+2+3 = 5 = 0x0005
      [[0x18, 0x03], 'JR 0005'],
      [[0x10, 0x03], 'DJNZ 0005'],
      // offset 0x0e=14 → target = 0+2+14 = 16 = 0x0010
      [[0x20, 0x0e], 'JR NZ,0010'],
      [[0x28, 0x0e], 'JR Z,0010'],
      [[0x30, 0x0e], 'JR NC,0010'],
      [[0x38, 0x0e], 'JR C,0010'],
      // backward: offset 0xfc = -4 signed → target = 0+2-4 = -2 = 0xFFFE
      [[0x18, 0xfc], 'JR FFFE'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('Memory: indirect and absolute', () => {
    it.each<[number[], string]>([
      [[0x02], 'LD (BC),A'],
      [[0x12], 'LD (DE),A'],
      [[0x0a], 'LD A,(BC)'],
      [[0x1a], 'LD A,(DE)'],
      [[0x32, 0x00, 0x80], 'LD (8000),A'],
      [[0x3a, 0x01, 0x80], 'LD A,(8001)'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('PUSH / POP', () => {
    it.each<[number[], string]>([
      [[0xc5], 'PUSH BC'],
      [[0xd5], 'PUSH DE'],
      [[0xe5], 'PUSH HL'],
      [[0xf5], 'PUSH AF'],
      [[0xc1], 'POP BC'],
      [[0xd1], 'POP DE'],
      [[0xe1], 'POP HL'],
      [[0xf1], 'POP AF'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('I/O', () => {
    it.each<[number[], string]>([
      [[0xd3, 0x00], 'OUT (00),A'],
      [[0xd3, 0xff], 'OUT (FF),A'],
      [[0xdb, 0x01], 'IN A,(01)'],
      [[0xed, 0x41], 'OUT (C),B'],
      [[0xed, 0x49], 'OUT (C),C'],
      [[0xed, 0x51], 'OUT (C),D'],
      [[0xed, 0x59], 'OUT (C),E'],
      [[0xed, 0x61], 'OUT (C),H'],
      [[0xed, 0x69], 'OUT (C),L'],
      [[0xed, 0x79], 'OUT (C),A'],
      [[0xed, 0x40], 'IN B,(C)'],
      [[0xed, 0x48], 'IN C,(C)'],
      [[0xed, 0x50], 'IN D,(C)'],
      [[0xed, 0x58], 'IN E,(C)'],
      [[0xed, 0x60], 'IN H,(C)'],
      [[0xed, 0x68], 'IN L,(C)'],
      [[0xed, 0x78], 'IN A,(C)'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('CB prefix: BIT / RES / SET / rotate / shift', () => {
    it.each<[number[], string]>([
      // BIT
      [[0xcb, 0x40], 'BIT 0,B'],
      [[0xcb, 0x47], 'BIT 0,A'],
      [[0xcb, 0x4f], 'BIT 1,A'],
      [[0xcb, 0x78], 'BIT 7,B'],
      [[0xcb, 0x7f], 'BIT 7,A'],
      [[0xcb, 0x5c], 'BIT 3,H'],
      // RES
      [[0xcb, 0x80], 'RES 0,B'],
      [[0xcb, 0x87], 'RES 0,A'],
      [[0xcb, 0xb8], 'RES 7,B'],
      // SET
      [[0xcb, 0xc0], 'SET 0,B'],
      [[0xcb, 0xc7], 'SET 0,A'],
      [[0xcb, 0xff], 'SET 7,A'],
      // rotate/shift
      [[0xcb, 0x00], 'RLC B'],
      [[0xcb, 0x07], 'RLC A'],
      [[0xcb, 0x08], 'RRC B'],
      [[0xcb, 0x0f], 'RRC A'],
      [[0xcb, 0x10], 'RL B'],
      [[0xcb, 0x17], 'RL A'],
      [[0xcb, 0x18], 'RR B'],
      [[0xcb, 0x1f], 'RR A'],
      [[0xcb, 0x20], 'SLA B'],
      [[0xcb, 0x27], 'SLA A'],
      [[0xcb, 0x28], 'SRA B'],
      [[0xcb, 0x2f], 'SRA A'],
      [[0xcb, 0x38], 'SRL B'],
      [[0xcb, 0x3f], 'SRL A'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('DD / FD prefix (IX / IY)', () => {
    it.each<[number[], string]>([
      // LD IX/IY, nn
      [[0xdd, 0x21, 0x34, 0x12], 'LD IX,1234'],
      [[0xfd, 0x21, 0x78, 0x56], 'LD IY,5678'],
      // LD r, (IX/IY+d)
      [[0xdd, 0x7e, 0x05], 'LD A,(IX+5)'],
      [[0xfd, 0x46, 0x00], 'LD B,(IY+0)'],
      [[0xdd, 0x4e, 0x01], 'LD C,(IX+1)'],
      // LD (IX/IY+d), r
      [[0xdd, 0x77, 0x05], 'LD (IX+5),A'],
      [[0xfd, 0x70, 0x02], 'LD (IY+2),B'],
      // LD (IX/IY+d), n
      [[0xdd, 0x36, 0x05, 0x10], 'LD (IX+5),10'],
      [[0xfd, 0x36, 0x00, 0xff], 'LD (IY+0),FF'],
      // INC / DEC IX/IY
      [[0xdd, 0x23], 'INC IX'],
      [[0xfd, 0x23], 'INC IY'],
      [[0xdd, 0x2b], 'DEC IX'],
      [[0xfd, 0x2b], 'DEC IY'],
      // PUSH / POP IX/IY
      [[0xdd, 0xe5], 'PUSH IX'],
      [[0xfd, 0xe5], 'PUSH IY'],
      [[0xdd, 0xe1], 'POP IX'],
      [[0xfd, 0xe1], 'POP IY'],
      // ADD IX/IY, rr
      [[0xdd, 0x09], 'ADD IX,BC'],
      [[0xdd, 0x19], 'ADD IX,DE'],
      [[0xdd, 0x29], 'ADD IX,IX'],
      [[0xdd, 0x39], 'ADD IX,SP'],
      [[0xfd, 0x09], 'ADD IY,BC'],
      [[0xfd, 0x19], 'ADD IY,DE'],
      [[0xfd, 0x29], 'ADD IY,IY'],
      [[0xfd, 0x39], 'ADD IY,SP'],
      // LD SP, IX/IY
      [[0xdd, 0xf9], 'LD SP,IX'],
      [[0xfd, 0xf9], 'LD SP,IY'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });

  describe('ED prefix', () => {
    it.each<[number[], string]>([
      [[0xed, 0x44], 'NEG'],
      [[0xed, 0x45], 'RETN'],
      [[0xed, 0x46], 'IM 0'],
      [[0xed, 0x47], 'LD I,A'],
      [[0xed, 0x4a], 'ADC HL,BC'],
      [[0xed, 0x4d], 'RETI'],
      [[0xed, 0x4f], 'LD R,A'],
      [[0xed, 0x42], 'SBC HL,BC'],
      [[0xed, 0x52], 'SBC HL,DE'],
      [[0xed, 0x56], 'IM 1'],
      [[0xed, 0x57], 'LD A,I'],
      [[0xed, 0x5a], 'ADC HL,DE'],
      [[0xed, 0x5e], 'IM 2'],
      [[0xed, 0x5f], 'LD A,R'],
      [[0xed, 0x62], 'SBC HL,HL'],
      [[0xed, 0x67], 'RRD'],
      [[0xed, 0x6a], 'ADC HL,HL'],
      [[0xed, 0x6f], 'RLD'],
      [[0xed, 0x72], 'SBC HL,SP'],
      [[0xed, 0x7a], 'ADC HL,SP'],
      [[0xed, 0xa2], 'INIR'],
      [[0xed, 0xa3], 'OTIR'],
      [[0xed, 0xaa], 'INDR'],
      [[0xed, 0xab], 'OTDR'],
      [[0xed, 0xb0], 'LDIR'],
      [[0xed, 0xb1], 'CPIR'],
      [[0xed, 0xb8], 'LDDR'],
      [[0xed, 0xb9], 'CPDR'],
    ])('disassembles %j → %s', (bytes, expected) => {
      expect(disasmOne(bytes)).toBe(expected);
    });
  });
});
