import { describe, it, expect } from 'vitest';
import { assembleInstruction } from './assembler';

describe('assembleInstruction', () => {
  describe('1-byte opcodes', () => {
    it('should assemble NOP', () => {
      expect(assembleInstruction('NOP', 0)).toEqual([0x00]);
    });
    it('should assemble HALT', () => {
      expect(assembleInstruction('HALT', 0)).toEqual([0x76]);
    });
    it('should assemble RET', () => {
      expect(assembleInstruction('RET', 0)).toEqual([0xc9]);
    });
  });

  describe('LD r, r', () => {
    it('should assemble LD A, B', () => {
      expect(assembleInstruction('LD A, B', 0)).toEqual([0x78]);
    });
    it('should assemble LD B, A', () => {
      expect(assembleInstruction('LD B, A', 0)).toEqual([0x47]);
    });
    it('should assemble LD C, D', () => {
      expect(assembleInstruction('LD C, D', 0)).toEqual([0x4a]);
    });
  });

  describe('LD r, n', () => {
    it('should assemble LD A, 01H', () => {
      expect(assembleInstruction('LD A, 01H', 0)).toEqual([0x3e, 0x01]);
    });
    it('should assemble LD A, 01h (lowercase h)', () => {
      expect(assembleInstruction('LD A, 01h', 0)).toEqual([0x3e, 0x01]);
    });
    it('should assemble LD B, 55', () => {
      expect(assembleInstruction('LD B, 55', 0)).toEqual([0x06, 55]);
    });
  });

  describe('ALU operations', () => {
    it('should assemble ADD A, B', () => {
      // 0x80 | (opIdx << 3) | r
      // ADD -> opIdx 0
      // B -> r 0
      // Expected: 0x80 | 0 | 0 = 0x80 = 128
      expect(assembleInstruction('ADD A, B', 0)).toEqual([0x80]);
    });
    it('should assemble ADD A, C', () => {
      // C -> r 1
      // Expected: 0x80 | 1 = 0x81 = 129
      expect(assembleInstruction('ADD A, C', 0)).toEqual([0x81]);
    });
    it('should assemble ADD A, A', () => {
      // A -> r 7
      // Expected: 0x80 | 7 = 0x87 = 135
      expect(assembleInstruction('ADD A, A', 0)).toEqual([0x87]);
    });
    it('should assemble SUB C', () => {
      expect(assembleInstruction('SUB C', 0)).toEqual([0x91]);
    });
    it('should assemble XOR 01H', () => {
      expect(assembleInstruction('XOR 01H', 0)).toEqual([0xee, 0x01]);
    });
    it('should assemble XOR 01h (lowercase h)', () => {
      expect(assembleInstruction('XOR 01h', 0)).toEqual([0xee, 0x01]);
    });
    it('should assemble XOR EEH', () => {
      expect(assembleInstruction('XOR EEH', 0)).toEqual([0xee, 0xee]);
    });
    it('should assemble XOR 0EEh', () => {
      expect(assembleInstruction('XOR 0EEh', 0)).toEqual([0xee, 0xee]);
    });
    it('should assemble AND 0Fh', () => {
      expect(assembleInstruction('AND 0Fh', 0)).toEqual([0xe6, 0x0f]);
    });
  });

  describe('Memory operations', () => {
    it('should assemble LD (HL), A', () => {
      expect(assembleInstruction('LD (HL), A', 0)).toEqual([0x77]);
    });
    it('should assemble LD A, (HL)', () => {
      expect(assembleInstruction('LD A, (HL)', 0)).toEqual([0x7e]);
    });
    it('should assemble LD (8000H), A', () => {
      expect(assembleInstruction('LD (8000H), A', 0)).toEqual([0x32, 0x00, 0x80]);
    });
    it('should assemble LD A, (8001H)', () => {
      expect(assembleInstruction('LD A, (8001H)', 0)).toEqual([0x3a, 0x01, 0x80]);
    });
  });

  describe('Control Flow', () => {
    it('should assemble JP 0000H', () => {
      expect(assembleInstruction('JP 0000H', 0)).toEqual([0xc3, 0x00, 0x00]);
    });
    it('should assemble CALL 1234H', () => {
      expect(assembleInstruction('CALL 1234H', 0)).toEqual([0xcd, 0x34, 0x12]);
    });
    it('should assemble DJNZ 0005H', () => {
      // Address: 0000H: DJNZ 0005H -> offset = 0005H - (0000H + 2) = 3
      expect(assembleInstruction('DJNZ 0005H', 0)).toEqual([0x10, 0x03]);
    });
    it('should assemble DJNZ backward jump', () => {
      // Address: 000AH: DJNZ 0008H -> offset = 0008H - (000AH + 2) = 0008H - 000CH = -4 = 0xFC
      expect(assembleInstruction('DJNZ 0008H', 10)).toEqual([0x10, 0xfc]);
    });
    it('should assemble JR 0005H', () => {
      expect(assembleInstruction('JR 0005H', 0)).toEqual([0x18, 0x03]);
    });
  });

  describe('I/O Operations', () => {
    it('should assemble OUT (00H), A', () => {
      expect(assembleInstruction('OUT (00H), A', 0)).toEqual([0xd3, 0x00]);
    });
    it('should assemble IN A, (01H)', () => {
      expect(assembleInstruction('IN A, (01H)', 0)).toEqual([0xdb, 0x01]);
    });
  });

  describe('Indexed Addressing', () => {
    it('should assemble LD IX, 1234H', () => {
      expect(assembleInstruction('LD IX, 1234H', 0)).toEqual([0xdd, 0x21, 0x34, 0x12]);
    });
    it('should assemble LD (IX+05H), A', () => {
      expect(assembleInstruction('LD (IX+05H), A', 0)).toEqual([0xdd, 0x77, 0x05]);
    });
    it('should assemble LD (IX+05H), 10H', () => {
      expect(assembleInstruction('LD (IX+05H), 10H', 0)).toEqual([0xdd, 0x36, 0x05, 0x10]);
    });
    it('should assemble LD A, (IY-01H)', () => {
      // -1 in 2's complement 8-bit is 0xFF
      expect(assembleInstruction('LD A, (IY+FFH)', 0)).toEqual([0xfd, 0x7e, 0xff]);
    });
  });

  describe('Stack Operations', () => {
    it('should assemble PUSH BC', () => {
      expect(assembleInstruction('PUSH BC', 0)).toEqual([0xc5]);
    });
    it('should assemble POP HL', () => {
      expect(assembleInstruction('POP HL', 0)).toEqual([0xe1]);
    });
  });

  describe('Directives and Comments', () => {
    it('should skip DB directive', () => {
      expect(assembleInstruction('DB 01H', 0)).toEqual([]);
    });
    it('should ignore comments', () => {
      expect(assembleInstruction('LD A, 01H ; This is a comment', 0)).toEqual([0x3e, 0x01]);
    });
    it('should handle extra whitespace', () => {
      expect(assembleInstruction('  LD   A ,  01H  ', 0)).toEqual([0x3e, 0x01]);
    });
  });
});
