import { assembleInstruction } from './src/utils/assembler.ts';

const test = (asm: string) => {
  const bytes = assembleInstruction(asm, 0);
  console.log(asm + ' -> ' + bytes.map((b: number) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '));
};

test('XOR 01H');
test('XOR 01h');
test('LD A, 01h');
test('OUT (00h), A');
test('JP 0000h');