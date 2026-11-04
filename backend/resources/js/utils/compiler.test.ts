import { describe, it, expect } from 'vitest';
import { Compiler } from '@compiler/Compiler';
import { TokenType } from '@compiler/lexer/Token';

function compile(source: string, sourceFile = 'test.c') {
  return new Compiler({ sourceFile }).compile(source);
}

describe('Compiler', () => {
  describe('compile success', () => {
    it('compiles a simple return', () => {
      const result = compile('int main() { return 42; }');
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.assembly).toContain('main:');
      expect(result.assembly).toContain('LD\tHL, 42');
      expect(result.assembly).toContain('RET');
    });

    it('compiles arithmetic and function parameters', () => {
      const result = compile('int add(int a, int b) { return a + b; }');
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('add:');
      expect(result.assembly).toContain('ADD\tHL, DE');
    });

    it('compiles if and while control flow', () => {
      const result = compile(
        'int main() { int x = 1; if (x) { return 1; } while (x < 10) { x = x + 1; } return 0; }',
      );
      expect(result.success).toBe(true);
      expect(result.assembly).toMatch(/JP/);
    });

    it('compiles for, switch, and inline asm', () => {
      const result = compile(
        [
          'int main() {',
          '  for (int i = 0; i < 5; i = i + 1) {}',
          '  switch (i) { case 1: return 1; default: return 0; }',
          '  __asm__("NOP");',
          '  return 0;',
          '}',
        ].join('\n'),
      );
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('NOP');
    });

    it('compiles globals, calls, and compound assignment', () => {
      const result = compile(
        [
          'int g;',
          'int inc(int v) { return v + 1; }',
          'int main() { g = 10; g += inc(1); return g; }',
        ].join('\n'),
      );
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('_g:');
      expect(result.assembly).toContain('CALL\tinc');
    });

    it('compiles pointers, arrays, and structs', () => {
      const result = compile(
        [
          'struct Point { int x; int y; };',
          'int main() {',
          '  int arr[4];',
          '  int x = 5;',
          '  int *p = &x;',
          '  struct Point pt;',
          '  arr[0] = 42;',
          '  *p = 10;',
          '  pt.x = 1;',
          '  return arr[0] + *p + pt.x;',
          '}',
        ].join('\n'),
      );
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('main:');
    });

    it('accepts hex literals and comments', () => {
      const result = compile(
        'int main() { /* init */ int x = 0xFF; // value\n return x; }',
      );
      expect(result.success).toBe(true);
      expect(result.assembly).toContain('LD\tHL, 255');
    });

    it('emits a non-empty source map', () => {
      const result = compile('int main() { return 0; }');
      expect(result.success).toBe(true);
      expect(result.sourceMap.sources).toContain('test.c');
      expect(result.sourceMap.mappings.length).toBeGreaterThan(0);
      expect(result.stats.inputLines).toBeGreaterThan(0);
      expect(result.stats.outputLines).toBeGreaterThan(0);
    });
  });

  describe('compile errors', () => {
    it('reports undefined identifiers', () => {
      const result = compile('int main() { return unknown; }');
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Undefined identifier'))).toBe(
        true,
      );
    });

    it('reports wrong argument count', () => {
      const result = compile(
        'int foo(int a) { return a; } int main() { return foo(1, 2); }',
      );
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.message.includes('Wrong number of arguments'))).toBe(
        true,
      );
    });

    it('reports parse errors', () => {
      const result = compile('int main() { return }');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('tokenize', () => {
    it('recognizes keywords, identifiers, and punctuation', () => {
      const compiler = new Compiler();
      const tokens = compiler.tokenize('int main() { return 0; }');
      const types = tokens.map((t) => t.type);

      expect(types).toContain(TokenType.KW_INT);
      expect(types).toContain(TokenType.IDENTIFIER);
      expect(types).toContain(TokenType.KW_RETURN);
      expect(types).toContain(TokenType.LPAREN);
      expect(types).toContain(TokenType.EOF);
    });
  });

  describe('parse', () => {
    it('builds a function declaration AST', () => {
      const compiler = new Compiler();
      const ast = compiler.parse('int foo(int x) { return x; }');
      const fn = ast.body[0];

      expect(fn.kind).toBe('FunctionDecl');
      if (fn.kind === 'FunctionDecl') {
        expect(fn.name).toBe('foo');
        expect(fn.params).toHaveLength(1);
        expect(fn.body?.kind).toBe('BlockStmt');
      }
    });
  });
});
