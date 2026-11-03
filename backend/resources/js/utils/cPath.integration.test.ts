import { describe, it, expect } from 'vitest';
import { Compiler } from '@compiler/Compiler';
import { ASM_RESERVED_WORDS } from './assembler';
import { assembleProgram, type AssembleProgramResult } from './asmLoader';
import { DATA_BASE } from '../constants';

const SAMPLES: Record<string, string> = {
  assign_add_sub: `
int main() {
  int a;
  int b;
  a = 20;
  b = 3;
  a = a + b;
  a = a - 1;
  return a;
}
`,
  if_while_for: `
int main() {
  int a;
  a = 0;
  if (a == 0) {
    a = 1;
  }
  while (a < 3) {
    a = a + 1;
  }
  for (a = 0; a < 2; a = a + 1) {
  }
  return a;
}
`,
  mul: `
int main() {
  int a;
  a = 6 * 7;
  return a;
}
`,
  globals: `
int g = 4;
char c;

int main() {
  g = 5;
  c = 7;
  g = g + 1;
  return g;
}
`,
  struct_point: `
struct Point {
  int x;
  int y;
};

int main() {
  struct Point p;
  p.x = 1;
  return p.x;
}
`,
  forward_jp: `
int main() {
  return 1;
}
`,
};

function compileAsm(src: string, name: string, origin = 0x0000) {
  const compiled = new Compiler({ sourceFile: name, origin }).compile(src);
  expect(compiled.success, compiled.errors.map(e => e.message).join('\n')).toBe(true);
  return compiled.assembly;
}

function signed8(n: number): number {
  return n >= 128 ? n - 256 : n;
}

function encodedTarget(addr: number, bytes: number[]): number | null {
  const op = bytes[0];
  if (op === 0xc3 || op === 0xcd) return bytes[1] | (bytes[2] << 8);
  if ([0xc2, 0xca, 0xd2, 0xda, 0xe2, 0xea, 0xf2, 0xfa].includes(op) && bytes.length >= 3) {
    return bytes[1] | (bytes[2] << 8);
  }
  if ([0xc4, 0xcc, 0xd4, 0xdc, 0xe4, 0xec, 0xf4, 0xfc].includes(op) && bytes.length >= 3) {
    return bytes[1] | (bytes[2] << 8);
  }
  if (op === 0x18 || op === 0x10 || op === 0x20 || op === 0x28 || op === 0x30 || op === 0x38) {
    return (addr + 2 + signed8(bytes[1])) & 0xffff;
  }
  return null;
}

function jumpTargetName(instr: string): string | null {
  if (!/^(JP|CALL|JR|DJNZ)\b/i.test(instr.trim())) return null;
  const tokens = instr.match(/[A-Za-z_]\w*/g) ?? [];
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (!ASM_RESERVED_WORDS.has(tokens[i].toUpperCase())) return tokens[i];
  }
  return null;
}

function expectJumpsMatch(r: AssembleProgramResult) {
  const mismatches: string[] = [];
  for (const ins of r.instructions) {
    const name = jumpTargetName(ins.text);
    if (!name) continue;
    const expected = r.labelMap[name];
    if (expected === undefined) {
      mismatches.push(`${ins.text} @${ins.addr}: label ${name} missing`);
      continue;
    }
    const got = encodedTarget(ins.addr, ins.bytes);
    if (got !== expected) {
      mismatches.push(`${ins.text} @${ins.addr}: encoded ${got} !== label ${expected}`);
    }
  }
  expect(mismatches, mismatches.join('\n')).toEqual([]);
}

describe('c2z80 + loadAsmText', () => {
  it('assign/if/while: assemble OK and every JP/JR/CALL matches the real label', () => {
    for (const id of ['assign_add_sub', 'if_while_for'] as const) {
      const asm = compileAsm(SAMPLES[id], `${id}.c`);
      const r = assembleProgram(asm);
      expect(r.errorLines, `${id}: ${r.errorLines.join('\n')}`).toEqual([]);
      expectJumpsMatch(r);
    }
  });

  it('mul: CALL __mul16 and runtime JR/JP land on real addresses', () => {
    const asm = compileAsm(SAMPLES.mul, 'mul.c');
    expect(asm).toMatch(/CALL\s+__mul16/);
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.labelMap.__mul16).toBeGreaterThan(0);
    const call = r.instructions.find(i => /CALL\s+__mul16/i.test(i.text));
    expect(call).toBeTruthy();
    expect(encodedTarget(call!.addr, call!.bytes)).toBe(r.labelMap.__mul16);
    expectJumpsMatch(r);
  });

  it('globals: DW/DB carry initializer 4, not always 0', () => {
    const asm = compileAsm(SAMPLES.globals, 'globals.c');
    expect(asm).toMatch(/_g:\s*DW\s*4/);
    expect(asm).toMatch(/_c:\s*DB\s*0/);
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.dataMemory[DATA_BASE]).toBe(4);
    expect(r.dataMemory[DATA_BASE + 1]).toBe(0);
    expectJumpsMatch(r);
  });

  it('struct member store uses offsets and a local frame', () => {
    const asm = compileAsm(SAMPLES.struct_point, 'struct_point.c');
    expect(asm).toMatch(/LD\s+HL,\s*65532/); // -4 frame for two ints
    expect(asm).toMatch(/LD\s+\(IY-4\),\s*L/);
    expect(asm).toMatch(/LD\s+\(IY-3\),\s*H/);
    expect(asm).toMatch(/LD\s+L,\s*\(IY-4\)/);
    expect(asm).not.toMatch(/LD\s+A,\s*\(HL\)/);
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expectJumpsMatch(r);
  });

  it('origin option is emitted as ORG and applied by the loader', () => {
    const asm = compileAsm(SAMPLES.forward_jp, 'origin.c', 0x1234);
    expect(asm).toMatch(/ORG\s+0x1234/i);
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    expect(r.labelMap.main).toBe(0x1234);
    expect(r.codeMemory[0x1234]).toBe(0xfd); // PUSH IY
    const jp = r.instructions.find(i => /^JP\b/i.test(i.text.trim()));
    expect(jp).toBeTruthy();
    expect(encodedTarget(jp!.addr, jp!.bytes)).toBe(r.labelMap[jumpTargetName(jp!.text)!]);
  });

  it('forward JP _ret_0 encodes the real epilogue address', () => {
    const asm = compileAsm(SAMPLES.forward_jp, 'fwd.c');
    const r = assembleProgram(asm);
    expect(r.errorLines).toEqual([]);
    const jp = r.instructions.find(i => /JP\s+_ret_0/i.test(i.text));
    expect(jp).toBeTruthy();
    expect(encodedTarget(jp!.addr, jp!.bytes)).toBe(r.labelMap._ret_0);
    expect(r.labelMap._ret_0).toBeGreaterThan(jp!.addr);
  });
});
