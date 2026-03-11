#!/usr/bin/env node
// cli/index.ts - CLIエントリーポイント

import * as fs from 'fs';
import * as path from 'path';
import { Compiler } from '../Compiler';

function printUsage() {
  console.log(`
c2z80 - C to Z80 Assembler Compiler

Usage:
  c2z80 [options] <input.c>

Options:
  -o, --output    <file>    Output file path (default: stdout)
  --target        <cpu>     Target CPU: z80, z80a (default: z80)
  --format        <fmt>     Output format: nasm, tasm, raw (default: nasm)
  --origin        <addr>    Code origin address (default: 0x0000)
  --stack-size    <bytes>   Stack size in bytes (default: 256)
  --no-source-map           Disable source map output
  --dump-ast                Dump AST as JSON
  --dump-tokens             Dump token list
  -v, --verbose             Verbose output
  -h, --help                Show this help
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage(); process.exit(0);
  }

  let inputFile = '';
  let outputFile = '';
  let target: 'z80' | 'z80a' = 'z80';
  let format: 'nasm' | 'tasm' | 'raw' = 'nasm';
  let origin = 0x0000;
  let stackSize = 256;
  let sourceMap = true;
  let dumpAst = false;
  let dumpTokens = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-o': case '--output': outputFile = args[++i]; break;
      case '--target':       target = args[++i] as 'z80' | 'z80a'; break;
      case '--format':       format = args[++i] as 'nasm' | 'tasm' | 'raw'; break;
      case '--origin':       origin = parseInt(args[++i]); break;
      case '--stack-size':   stackSize = parseInt(args[++i]); break;
      case '--no-source-map':sourceMap = false; break;
      case '--dump-ast':     dumpAst = true; break;
      case '--dump-tokens':  dumpTokens = true; break;
      case '-v': case '--verbose': verbose = true; break;
      default:
        if (!args[i].startsWith('-')) inputFile = args[i];
    }
  }

  if (!inputFile) { console.error('Error: No input file specified'); process.exit(1); }
  if (!fs.existsSync(inputFile)) { console.error(`Error: File not found: ${inputFile}`); process.exit(1); }

  const source = fs.readFileSync(inputFile, 'utf-8');
  const compiler = new Compiler({ target, outputFormat: format, sourceMap, origin, stackSize, sourceFile: path.basename(inputFile) });

  if (dumpTokens) {
    const tokens = compiler.tokenize(source);
    console.log(JSON.stringify(tokens, null, 2));
    process.exit(0);
  }

  if (dumpAst) {
    const ast = compiler.parse(source);
    console.log(JSON.stringify(ast, null, 2));
    process.exit(0);
  }

  const result = compiler.compile(source);

  if (verbose) {
    console.error(`Input:  ${result.stats.inputLines} lines`);
    console.error(`Output: ${result.stats.outputLines} lines`);
    console.error(`Time:   ${result.stats.compileTimeMs}ms`);
  }

  if (!result.success) {
    for (const e of result.errors) {
      console.error(`${e.file}:${e.line}:${e.col}: ${e.severity}: ${e.message}`);
    }
    process.exit(1);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, result.assembly, 'utf-8');
    if (sourceMap) {
      fs.writeFileSync(outputFile + '.map', JSON.stringify(result.sourceMap, null, 2), 'utf-8');
    }
    if (verbose) console.error(`Written to ${outputFile}`);
  } else {
    process.stdout.write(result.assembly);
  }
}

main();
