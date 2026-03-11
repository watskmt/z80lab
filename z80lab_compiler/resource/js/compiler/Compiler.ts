// Compiler.ts - コンパイラ公開API

import { Lexer } from './lexer/Lexer';
import { Parser } from './parser/Parser';
import { SemanticAnalyzer } from './semantic/SemanticAnalyzer';
import { Z80CodeGen, SourceMap } from './codegen/Z80CodeGen';

export interface CompilerOptions {
  target?: 'z80' | 'z80a';
  outputFormat?: 'nasm' | 'tasm' | 'raw';
  sourceMap?: boolean;      // default: true
  origin?: number;          // default: 0x0000
  stackSize?: number;
  sourceFile?: string;
}

export interface CompileError {
  code: string;
  message: string;
  file: string;
  line: number;
  col: number;
  severity: 'error' | 'warning';
}

export interface CompileResult {
  success: boolean;
  assembly: string;
  errors: CompileError[];
  warnings: CompileError[];
  sourceMap: SourceMap;
  stats: {
    inputLines: number;
    outputLines: number;
    compileTimeMs: number;
  };
}

export class Compiler {
  private options: Required<CompilerOptions>;

  constructor(options: CompilerOptions = {}) {
    this.options = {
      target: options.target ?? 'z80',
      outputFormat: options.outputFormat ?? 'nasm',
      sourceMap: options.sourceMap ?? true,
      origin: options.origin ?? 0x0000,
      stackSize: options.stackSize ?? 256,
      sourceFile: options.sourceFile ?? 'input.c',
    };
  }

  setOptions(options: Partial<CompilerOptions>) {
    Object.assign(this.options, options);
  }

  compile(source: string): CompileResult {
    const startTime = Date.now();
    const errors: CompileError[] = [];
    const warnings: CompileError[] = [];
    const inputLines = source.split('\n').length;

    try {
      // 1. 字句解析
      const lexer = new Lexer(source);
      const tokens = lexer.tokenize();

      // 2. 構文解析
      const parser = new Parser(tokens);
      const ast = parser.parse();

      // 3. 意味解析
      const semantic = new SemanticAnalyzer();
      semantic.analyze(ast);
      for (const e of semantic.errors) {
        errors.push({
          code: 'E0003',
          message: e.message,
          file: this.options.sourceFile,
          line: e.line,
          col: e.col,
          severity: 'error',
        });
      }
      if (errors.length > 0) {
        return {
          success: false, assembly: '', errors, warnings,
          sourceMap: { sources: [this.options.sourceFile], mappings: [] },
          stats: { inputLines, outputLines: 0, compileTimeMs: Date.now() - startTime },
        };
      }

      // 4. コード生成
      const codegen = new Z80CodeGen(semantic, this.options.sourceFile);
      const result = codegen.generate(ast);

      return {
        success: true,
        assembly: result.assembly,
        errors: [],
        warnings,
        sourceMap: result.sourceMap,
        stats: {
          inputLines,
          outputLines: result.assembly.split('\n').length,
          compileTimeMs: Date.now() - startTime,
        },
      };

    } catch (e: any) {
      errors.push({
        code: 'E0000',
        message: e.message ?? String(e),
        file: this.options.sourceFile,
        line: e.line ?? 0,
        col: e.col ?? 0,
        severity: 'error',
      });
      return {
        success: false, assembly: '', errors, warnings,
        sourceMap: { sources: [this.options.sourceFile], mappings: [] },
        stats: { inputLines, outputLines: 0, compileTimeMs: Date.now() - startTime },
      };
    }
  }

  tokenize(source: string) {
    return new Lexer(source).tokenize();
  }

  parse(source: string) {
    const tokens = new Lexer(source).tokenize();
    return new Parser(tokens).parse();
  }
}
