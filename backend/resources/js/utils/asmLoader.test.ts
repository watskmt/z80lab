import { describe, it, expect } from 'vitest';
import { assembleInstruction, resolveAsmIdentifiers } from './assembler';
import { assembleProgram } from './asmLoader';
import { DATA_BASE } from '../constants';

describe('resolveAsmIdentifiers', () => {
  it('keeps mnemonics and registers while dummy-substituting unknown labels', () => {
    expect(resolveAsmIdentifiers('PUSH IY', {}, 'dummy')).toBe('PUSH IY');
    expect(resolveAsmIdentifiers('JP later', {}, 'dummy')).toBe('JP 0');
    expect(resolveAsmIdentifiers('JP Z, _wend_5', {}, 'dummy')).toBe('JP Z, 0');
    expect(resolveAsmIdentifiers('JR NC, __mul16_skip', {}, 'dummy')).toBe('JR NC, 0');
    expect(resolveAsmIdentifiers('CALL __mul16', {}, 'dummy')).toBe('CALL 0');
    expect(resolveAsmIdentifiers('LD HL, (_g)', {}, 'dummy')).toBe('LD HL, (0)');
  });

  it('substitutes known labels with their addresses', () => {
    expect(resolveAsmIdentifiers('JP later', { later: 4 }, 'dummy')).toBe('JP 4');
  });

  it('sizes JP/CALL/JR via dummy operands instead of empty assemble', () => {
    expect(assembleInstruction('JP later', 0)).toEqual([]);
    expect(assembleInstruction(resolveAsmIdentifiers('JP later', {}, 'dummy'), 0).length).toBe(3);
    expect(assembleInstruction(resolveAsmIdentifiers('CALL __mul16', {}, 'dummy'), 0).length).toBe(3);
    expect(assembleInstruction(resolveAsmIdentifiers('JR NC, __mul16_skip', {}, 'dummy'), 0).length).toBe(2);
    expect(assembleInstruction(resolveAsmIdentifiers('JP C, __div16_done', {}, 'dummy'), 0).length).toBe(3);
    expect(assembleInstruction(resolveAsmIdentifiers('PUSH IY', {}, 'dummy'), 0)).toEqual([0xfd, 0xe5]);
  });
});

describe('assembleProgram forward labels', () => {
  it('places later at the real address of a forward JP', () => {
    const asm = `
main:
  JP later
  NOP
later:
  RET
`;
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.labelMap.later).toBe(4);
    expect([...r.codeMemory.slice(0, 5)]).toEqual([0xc3, 0x04, 0x00, 0x00, 0xc9]);
  });

  it('sizes conditional JP and JR to the real label', () => {
    const asm = `
  JR NC, skip
  NOP
  NOP
skip:
  JP C, dest
  NOP
dest:
  RET
`;
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.labelMap.skip).toBe(4);
    expect(r.labelMap.dest).toBe(8);
    expect(r.codeMemory[0]).toBe(0x30); // JR NC
    expect(r.codeMemory[1]).toBe(0x02); // offset to skip
    expect(r.codeMemory[4]).toBe(0xda); // JP C
    expect(r.codeMemory[5]).toBe(0x08);
    expect(r.codeMemory[6]).toBe(0x00);
  });

  it('writes DW initializers into data memory', () => {
    const asm = `
  LD HL, (_g)
  RET
_g: DW 4
`;
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.labelMap._g).toBe(DATA_BASE);
    expect(r.dataMemory[DATA_BASE]).toBe(4);
    expect(r.dataMemory[DATA_BASE + 1]).toBe(0);
    expect(r.codeMemory[0]).toBe(0x2a);
    expect(r.codeMemory[1]).toBe(DATA_BASE & 0xff);
    expect(r.codeMemory[2]).toBe((DATA_BASE >> 8) & 0xff);
  });
});
