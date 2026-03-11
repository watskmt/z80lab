// Z80CodeGen.ts - Z80アセンブリコード生成器（ソースマップ付き）

import * as AST from '../parser/AST';
import { SemanticAnalyzer } from '../semantic/SemanticAnalyzer';

export interface SourceMapping {
  asmLine: number;
  srcFile: number;
  srcLine: number;
  srcCol: number;
}

export interface SourceMap {
  sources: string[];
  mappings: SourceMapping[];
}

export interface CodeGenResult {
  assembly: string;
  sourceMap: SourceMap;
}

// ローカル変数情報
interface LocalVar {
  name: string;
  type: AST.CType;
  offset: number; // IYからの相対オフセット（負値）
}

export class Z80CodeGen {
  private lines: string[] = [];
  private mappings: SourceMapping[] = [];
  private labelCount = 0;
  private localVars: LocalVar[] = [];
  private localSize = 0;
  private currentRetLabel = '';
  private stringPool: { label: string; value: string }[] = [];
  private globalVars: { name: string; type: AST.CType }[] = [];

  constructor(
    private semantic: SemanticAnalyzer,
    private sourceFile = 'input.c'
  ) {}

  generate(program: AST.Program): CodeGenResult {
    this.emit('; c2z80 generated Z80 assembly');
    this.emit('; Source: ' + this.sourceFile);
    this.emit('');
    this.emit('\tORG\t0x0000');
    this.emit('');

    // グローバル変数収集
    for (const node of program.body) {
      if (node.kind === 'VarDecl') {
        this.globalVars.push({ name: node.name, type: node.varType });
      }
    }

    // 関数生成
    for (const node of program.body) {
      if (node.kind === 'FunctionDecl' && node.body) {
        this.genFunction(node);
      }
    }

    // 文字列プール
    if (this.stringPool.length > 0) {
      this.emit('');
      this.emit('; String pool');
      for (const s of this.stringPool) {
        this.emit(`${s.label}:\tDB\t"${s.value}", 0`);
      }
    }

    // グローバル変数セクション
    const globals = program.body.filter((n): n is AST.VarDecl => n.kind === 'VarDecl');
    if (globals.length > 0) {
      this.emit('');
      this.emit('; Global variables');
      for (const v of globals) {
        const size = AST.typeSize(v.varType);
        if (size === 1) this.emit(`_${v.name}:\tDB\t0`);
        else           this.emit(`_${v.name}:\tDW\t0`);
      }
    }

    return {
      assembly: this.lines.join('\n'),
      sourceMap: { sources: [this.sourceFile], mappings: this.mappings },
    };
  }

  // --- 関数生成 ---
  private genFunction(fn: AST.FunctionDecl) {
    this.localVars = [];
    this.localSize = 0;
    this.currentRetLabel = this.newLabel('_ret');

    // ローカル変数をスキャンしてスタックサイズ計算
    this.scanLocals(fn.body!);

    this.emitMapped(`${fn.name}:`, fn.line, fn.col);
    this.emit('\tPUSH\tIY');
    this.emit('\tLD\tIY, 0');
    this.emit('\tADD\tIY, SP');
    if (this.localSize > 0) {
      this.emit(`\tLD\tHL, ${((-this.localSize) & 0xFFFF)}`);
      this.emit('\tADD\tHL, SP');
      this.emit('\tLD\tSP, HL');
    }

    // 引数をローカル変数として登録（IYからの正オフセット: IY+4, IY+6, ...）
    let argOffset = 4; // PUSH IY + CALL戻りアドレス
    for (const p of fn.params) {
      this.localVars.push({ name: p.name, type: p.paramType, offset: argOffset });
      argOffset += AST.typeSize(p.paramType);
    }

    this.genBlock(fn.body!);

    this.emit(`${this.currentRetLabel}:`);
    if (this.localSize > 0) {
      this.emit(`\tLD\tHL, ${this.localSize}`);
      this.emit('\tADD\tHL, SP');
      this.emit('\tLD\tSP, HL');
    }
    this.emit('\tPOP\tIY');
    this.emit('\tRET');
    this.emit('');
  }

  private scanLocals(block: AST.BlockStmt) {
    for (const stmt of block.body) {
      if (stmt.kind === 'VarDecl') {
        const size = AST.typeSize(stmt.varType);
        this.localSize += size;
        this.localVars.push({ name: stmt.name, type: stmt.varType, offset: -this.localSize });
      } else if (stmt.kind === 'BlockStmt') {
        this.scanLocals(stmt);
      } else if (stmt.kind === 'IfStmt') {
        if (stmt.then.kind === 'BlockStmt') this.scanLocals(stmt.then);
        if (stmt.else_?.kind === 'BlockStmt') this.scanLocals(stmt.else_);
      } else if (stmt.kind === 'WhileStmt' && stmt.body.kind === 'BlockStmt') {
        this.scanLocals(stmt.body);
      } else if (stmt.kind === 'ForStmt' && stmt.body.kind === 'BlockStmt') {
        this.scanLocals(stmt.body);
      }
    }
  }

  // --- 文生成 ---
  private genBlock(block: AST.BlockStmt) {
    for (const stmt of block.body) this.genStmt(stmt);
  }

  private genStmt(stmt: AST.Stmt) {
    switch (stmt.kind) {
      case 'BlockStmt':   this.genBlock(stmt); break;
      case 'ExprStmt':    this.emitMapped('', stmt.line, stmt.col); this.genExpr(stmt.expr); break;
      case 'ReturnStmt':  this.genReturn(stmt); break;
      case 'VarDecl':     this.genVarInit(stmt); break;
      case 'IfStmt':      this.genIf(stmt); break;
      case 'WhileStmt':   this.genWhile(stmt); break;
      case 'ForStmt':     this.genFor(stmt); break;
      case 'DoWhileStmt': this.genDoWhile(stmt); break;
      case 'SwitchStmt':  this.genSwitch(stmt); break;
      case 'BreakStmt':   this.emit(`\tJP\t${this.currentBreakLabel}`); break;
      case 'ContinueStmt':this.emit(`\tJP\t${this.currentContinueLabel}`); break;
      case 'AsmStmt':     this.genAsm(stmt); break;
    }
  }

  private currentBreakLabel = '';
  private currentContinueLabel = '';

  private genReturn(stmt: AST.ReturnStmt) {
    this.emitMapped('\t; return', stmt.line, stmt.col);
    if (stmt.value) {
      this.genExpr(stmt.value);
      // 結果はHL（16bit）またはA（8bit）に入っている
    }
    this.emit(`\tJP\t${this.currentRetLabel}`);
  }

  private genVarInit(stmt: AST.VarDecl) {
    if (!stmt.init) return;
    this.emitMapped('\t; var init ' + stmt.name, stmt.line, stmt.col);
    this.genExpr(stmt.init);
    const local = this.localVars.find(v => v.name === stmt.name);
    if (local) this.storeToLocal(local, stmt.varType);
  }

  private genIf(stmt: AST.IfStmt) {
    const elseLabel = this.newLabel('_else');
    const endLabel = this.newLabel('_endif');
    this.emitMapped('\t; if', stmt.line, stmt.col);
    this.genExpr(stmt.cond);
    this.emit('\tLD\tA, H');
    this.emit('\tOR\tL');
    this.emit(`\tJP\tZ, ${elseLabel}`);
    this.genStmt(stmt.then);
    if (stmt.else_) {
      this.emit(`\tJP\t${endLabel}`);
      this.emit(`${elseLabel}:`);
      this.genStmt(stmt.else_);
      this.emit(`${endLabel}:`);
    } else {
      this.emit(`${elseLabel}:`);
    }
  }

  private genWhile(stmt: AST.WhileStmt) {
    const loopLabel = this.newLabel('_while');
    const endLabel = this.newLabel('_wend');
    const savedBreak = this.currentBreakLabel;
    const savedCont = this.currentContinueLabel;
    this.currentBreakLabel = endLabel;
    this.currentContinueLabel = loopLabel;
    this.emitMapped(`${loopLabel}:`, stmt.line, stmt.col);
    this.genExpr(stmt.cond);
    this.emit('\tLD\tA, H');
    this.emit('\tOR\tL');
    this.emit(`\tJP\tZ, ${endLabel}`);
    this.genStmt(stmt.body);
    this.emit(`\tJP\t${loopLabel}`);
    this.emit(`${endLabel}:`);
    this.currentBreakLabel = savedBreak;
    this.currentContinueLabel = savedCont;
  }

  private genFor(stmt: AST.ForStmt) {
    const loopLabel = this.newLabel('_for');
    const contLabel = this.newLabel('_forc');
    const endLabel = this.newLabel('_fend');
    const savedBreak = this.currentBreakLabel;
    const savedCont = this.currentContinueLabel;
    this.currentBreakLabel = endLabel;
    this.currentContinueLabel = contLabel;
    if (stmt.init) this.genStmt(stmt.init);
    this.emitMapped(`${loopLabel}:`, stmt.line, stmt.col);
    if (stmt.cond) {
      this.genExpr(stmt.cond);
      this.emit('\tLD\tA, H');
      this.emit('\tOR\tL');
      this.emit(`\tJP\tZ, ${endLabel}`);
    }
    this.genStmt(stmt.body);
    this.emit(`${contLabel}:`);
    if (stmt.update) this.genExpr(stmt.update);
    this.emit(`\tJP\t${loopLabel}`);
    this.emit(`${endLabel}:`);
    this.currentBreakLabel = savedBreak;
    this.currentContinueLabel = savedCont;
  }

  private genDoWhile(stmt: AST.DoWhileStmt) {
    const loopLabel = this.newLabel('_do');
    const endLabel = this.newLabel('_doend');
    const savedBreak = this.currentBreakLabel;
    const savedCont = this.currentContinueLabel;
    this.currentBreakLabel = endLabel;
    this.currentContinueLabel = loopLabel;
    this.emitMapped(`${loopLabel}:`, stmt.line, stmt.col);
    this.genStmt(stmt.body);
    this.genExpr(stmt.cond);
    this.emit('\tLD\tA, H');
    this.emit('\tOR\tL');
    this.emit(`\tJP\tNZ, ${loopLabel}`);
    this.emit(`${endLabel}:`);
    this.currentBreakLabel = savedBreak;
    this.currentContinueLabel = savedCont;
  }

  private genSwitch(stmt: AST.SwitchStmt) {
    const endLabel = this.newLabel('_swend');
    const savedBreak = this.currentBreakLabel;
    this.currentBreakLabel = endLabel;
    this.genExpr(stmt.expr);
    this.emit('\tPUSH\tHL');
    const caseLabels: string[] = [];
    let defaultLabel = endLabel;
    for (let i = 0; i < stmt.cases.length; i++) {
      const lbl = this.newLabel('_case');
      caseLabels.push(lbl);
      const c = stmt.cases[i];
      if (c.value) {
        this.emit('\tPOP\tHL');
        this.emit('\tPUSH\tHL');
        this.genExpr(c.value);
        this.emit('\tOR\tA'); // clear carry
        this.emit('\tSBC\tHL, HL'); // HL = 0 for comparison
        this.emit(`\tJP\tZ, ${lbl}`);
      } else {
        defaultLabel = lbl;
      }
    }
    this.emit(`\tJP\t${defaultLabel}`);
    for (let i = 0; i < stmt.cases.length; i++) {
      this.emit(`${caseLabels[i]}:`);
      for (const s of stmt.cases[i].body) this.genStmt(s);
    }
    this.emit(`${endLabel}:`);
    this.emit('\tPOP\tHL'); // clean stack
    this.currentBreakLabel = savedBreak;
  }

  private genAsm(stmt: AST.AsmStmt) {
    this.emitMapped('\t; inline asm', stmt.line, stmt.col);
    for (const line of stmt.code.split('\\n')) {
      this.emit('\t' + line.trim());
    }
  }

  // --- 式生成（結果はHL or A） ---
  private genExpr(expr: AST.Expr) {
    switch (expr.kind) {
      case 'IntLiteral':
        this.emit(`\tLD\tHL, ${expr.value}`);
        break;

      case 'CharLiteral':
        this.emit(`\tLD\tHL, ${expr.value}`);
        break;

      case 'StringLiteral': {
        const lbl = this.newLabel('_str');
        this.stringPool.push({ label: lbl, value: expr.value });
        this.emit(`\tLD\tHL, ${lbl}`);
        break;
      }

      case 'Identifier': {
        const local = this.localVars.find(v => v.name === expr.name);
        if (local) {
          this.loadFromLocal(local, expr.type ?? { kind: 'int', signed: true });
        } else {
          // グローバル
          const t = expr.type ?? { kind: 'int', signed: true };
          if (AST.typeSize(t) === 1) {
            this.emit(`\tLD\tA, (_${expr.name})`);
            this.emit('\tLD\tH, 0');
            this.emit('\tLD\tL, A');
          } else {
            this.emit(`\tLD\tHL, (_${expr.name})`);
          }
        }
        break;
      }

      case 'AssignExpr': this.genAssign(expr); break;
      case 'BinaryExpr': this.genBinary(expr); break;
      case 'UnaryExpr':  this.genUnary(expr); break;
      case 'CallExpr':   this.genCall(expr); break;
      case 'IndexExpr':  this.genIndex(expr); break;
      case 'MemberExpr': this.genMember(expr); break;
      case 'TernaryExpr': this.genTernary(expr); break;
      case 'CastExpr':   this.genExpr(expr.expr); break; // 単純キャスト
    }
  }

  private genAssign(expr: AST.AssignExpr) {
    if (expr.op !== '=') {
      // 複合代入: 左辺をロード、演算、格納
      this.genExpr(expr.target);
      this.emit('\tPUSH\tHL');
      this.genExpr(expr.value);
      this.emit('\tPOP\tDE');
      const op = expr.op.replace('=', '');
      this.genBinaryOp(op);
    } else {
      this.genExpr(expr.value);
    }
    this.storeToTarget(expr.target);
  }

  private storeToTarget(target: AST.Expr) {
    if (target.kind === 'Identifier') {
      const local = this.localVars.find(v => v.name === target.name);
      if (local) {
        this.storeToLocal(local, target.type ?? { kind: 'int', signed: true });
      } else {
        const t = target.type ?? { kind: 'int', signed: true };
        if (AST.typeSize(t) === 1) {
          this.emit('\tLD\tA, L');
          this.emit(`\tLD\t(_${target.name}), A`);
        } else {
          this.emit(`\tLD\t(_${target.name}), HL`);
        }
      }
    } else if (target.kind === 'UnaryExpr' && target.op === '*') {
      // *ptr = HL
      this.emit('\tPUSH\tHL');
      this.genExpr(target.operand);
      this.emit('\tEX\tDE, HL');
      this.emit('\tPOP\tHL');
      this.emit('\tLD\t(DE), HL');
    } else if (target.kind === 'IndexExpr') {
      // arr[i] = HL
      this.emit('\tPUSH\tHL');
      this.genIndexAddr(target);
      this.emit('\tEX\tDE, HL');
      this.emit('\tPOP\tHL');
      this.emit('\tLD\t(DE), L');
    }
  }

  private genBinary(expr: AST.BinaryExpr) {
    this.genExpr(expr.left);
    this.emit('\tPUSH\tHL');
    this.genExpr(expr.right);
    this.emit('\tEX\tDE, HL'); // DE = right
    this.emit('\tPOP\tHL');    // HL = left
    this.genBinaryOp(expr.op);
  }

  private genBinaryOp(op: string) {
    switch (op) {
      case '+':  this.emit('\tADD\tHL, DE'); break;
      case '-':  this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE'); break;
      case '&':  this.emit('\tLD\tA, H'); this.emit('\tAND\tD'); this.emit('\tLD\tH, A');
                 this.emit('\tLD\tA, L'); this.emit('\tAND\tE'); this.emit('\tLD\tL, A'); break;
      case '|':  this.emit('\tLD\tA, H'); this.emit('\tOR\tD'); this.emit('\tLD\tH, A');
                 this.emit('\tLD\tA, L'); this.emit('\tOR\tE'); this.emit('\tLD\tL, A'); break;
      case '^':  this.emit('\tLD\tA, H'); this.emit('\tXOR\tD'); this.emit('\tLD\tH, A');
                 this.emit('\tLD\tA, L'); this.emit('\tXOR\tE'); this.emit('\tLD\tL, A'); break;
      case '*':  this.emit('\tPUSH\tHL'); this.emit('\tPOP\tBC');
                 this.emit('\tCALL\t__mul16'); break;
      case '/':  this.emit('\tPUSH\tHL'); this.emit('\tPOP\tBC');
                 this.emit('\tCALL\t__div16'); break;
      case '%':  this.emit('\tPUSH\tHL'); this.emit('\tPOP\tBC');
                 this.emit('\tCALL\t__mod16'); break;
      case '<<': {
        const lbl = this.newLabel('_shl');
        this.emit('\tLD\tB, E');
        this.emit(`${lbl}:`);
        this.emit('\tADD\tHL, HL');
        this.emit(`\tDJNZ\t${lbl}`);
        break;
      }
      case '>>': {
        const lbl = this.newLabel('_shr');
        this.emit('\tLD\tB, E');
        this.emit(`${lbl}:`);
        this.emit('\tSRL\tH');
        this.emit('\tRR\tL');
        this.emit(`\tDJNZ\t${lbl}`);
        break;
      }
      // 比較: 結果を HL = 1 or 0
      case '==': {
        const lbl = this.newLabel('_eq');
        this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tNZ, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '!=': {
        const lbl = this.newLabel('_ne');
        this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tZ, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '<': {
        const lbl = this.newLabel('_lt');
        this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tNC, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '>': {
        const lbl = this.newLabel('_gt');
        this.emit('\tEX\tDE, HL'); this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tNC, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '<=': {
        const lbl = this.newLabel('_le');
        this.emit('\tEX\tDE, HL'); this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tC, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '>=': {
        const lbl = this.newLabel('_ge');
        this.emit('\tOR\tA'); this.emit('\tSBC\tHL, DE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tC, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
        break;
      }
      case '&&': {
        const end = this.newLabel('_and');
        this.emit('\tLD\tA, H'); this.emit('\tOR\tL'); this.emit('\tLD\tHL, 0');
        this.emit(`\tJP\tZ, ${end}`); this.emit('\tLD\tA, D'); this.emit('\tOR\tE');
        this.emit(`\tJP\tZ, ${end}`); this.emit('\tINC\tHL'); this.emit(`${end}:`);
        break;
      }
      case '||': {
        const end = this.newLabel('_or');
        this.emit('\tLD\tA, H'); this.emit('\tOR\tL'); this.emit('\tOR\tD'); this.emit('\tOR\tE');
        this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tZ, ${end}`); this.emit('\tINC\tHL'); this.emit(`${end}:`);
        break;
      }
    }
  }

  private genUnary(expr: AST.UnaryExpr) {
    if (expr.prefix) {
      switch (expr.op) {
        case '-': this.genExpr(expr.operand); this.emit('\tLD\tDE, 0'); this.emit('\tOR\tA'); this.emit('\tEX\tDE, HL'); this.emit('\tSBC\tHL, DE'); break;
        case '!': {
          const lbl = this.newLabel('_not');
          this.genExpr(expr.operand); this.emit('\tLD\tA, H'); this.emit('\tOR\tL');
          this.emit('\tLD\tHL, 0'); this.emit(`\tJP\tNZ, ${lbl}`); this.emit('\tINC\tHL'); this.emit(`${lbl}:`);
          break;
        }
        case '~': this.genExpr(expr.operand); this.emit('\tLD\tA, H'); this.emit('\tCPL'); this.emit('\tLD\tH, A'); this.emit('\tLD\tA, L'); this.emit('\tCPL'); this.emit('\tLD\tL, A'); break;
        case '*': this.genExpr(expr.operand); this.emit('\tLD\tA, (HL)'); this.emit('\tLD\tH, 0'); this.emit('\tLD\tL, A'); break;
        case '&': this.genAddr(expr.operand); break;
        case '++': this.genExpr(expr.operand); this.emit('\tINC\tHL'); this.storeToTarget(expr.operand); break;
        case '--': this.genExpr(expr.operand); this.emit('\tDEC\tHL'); this.storeToTarget(expr.operand); break;
      }
    } else {
      // post
      this.genExpr(expr.operand);
      this.emit('\tPUSH\tHL');
      if (expr.op === '++') { this.emit('\tINC\tHL'); } else { this.emit('\tDEC\tHL'); }
      this.storeToTarget(expr.operand);
      this.emit('\tPOP\tHL');
    }
  }

  private genAddr(expr: AST.Expr) {
    if (expr.kind === 'Identifier') {
      const local = this.localVars.find(v => v.name === expr.name);
      if (local) {
        this.emit(`\tLD\tHL, IY${local.offset >= 0 ? '+' : ''}${local.offset}`);
        this.emit('\tPUSH\tIY'); this.emit('\tPOP\tDE');
        this.emit(`\tLD\tHL, ${Math.abs(local.offset)}`);
        if (local.offset < 0) { this.emit('\tOR\tA'); this.emit('\tEX\tDE, HL'); this.emit('\tSBC\tHL, DE'); this.emit('\tEX\tDE, HL'); this.emit('\tLD\tHL, 0'); this.emit('\tSBC\tHL, DE'); }
        else { this.emit('\tADD\tHL, DE'); }
      } else {
        this.emit(`\tLD\tHL, _${expr.name}`);
      }
    }
  }

  private genCall(expr: AST.CallExpr) {
    // 引数を逆順にスタックへ
    for (let i = expr.args.length - 1; i >= 0; i--) {
      this.genExpr(expr.args[i]);
      this.emit('\tPUSH\tHL');
    }
    this.emit(`\tCALL\t${expr.callee.name}`);
    if (expr.args.length > 0) {
      this.emit(`\tLD\tHL, ${expr.args.length * 2}`);
      this.emit('\tADD\tHL, SP');
      this.emit('\tLD\tSP, HL');
    }
  }

  private genIndex(expr: AST.IndexExpr) {
    this.genIndexAddr(expr);
    this.emit('\tLD\tA, (HL)');
    this.emit('\tLD\tH, 0');
    this.emit('\tLD\tL, A');
  }

  private genIndexAddr(expr: AST.IndexExpr) {
    this.genExpr(expr.array);
    this.emit('\tPUSH\tHL');
    this.genExpr(expr.index);
    this.emit('\tPOP\tDE');
    this.emit('\tADD\tHL, DE');
  }

  private genMember(expr: AST.MemberExpr) {
    this.genExpr(expr.object);
    // 構造体メンバーへのオフセット計算は簡略化
    this.emit('\tLD\tA, (HL)');
    this.emit('\tLD\tH, 0');
    this.emit('\tLD\tL, A');
  }

  private genTernary(expr: AST.TernaryExpr) {
    const elseLabel = this.newLabel('_tern_else');
    const endLabel = this.newLabel('_tern_end');
    this.genExpr(expr.cond);
    this.emit('\tLD\tA, H'); this.emit('\tOR\tL');
    this.emit(`\tJP\tZ, ${elseLabel}`);
    this.genExpr(expr.then);
    this.emit(`\tJP\t${endLabel}`);
    this.emit(`${elseLabel}:`);
    this.genExpr(expr.else_);
    this.emit(`${endLabel}:`);
  }

  // --- ローカル変数アクセス ---
  private loadFromLocal(local: LocalVar, type: AST.CType) {
    const size = AST.typeSize(type);
    if (size === 1) {
      this.emit(`\tLD\tA, (IY${local.offset >= 0 ? '+' : ''}${local.offset})`);
      this.emit('\tLD\tH, 0');
      this.emit('\tLD\tL, A');
    } else {
      this.emit(`\tLD\tL, (IY${local.offset >= 0 ? '+' : ''}${local.offset})`);
      this.emit(`\tLD\tH, (IY${local.offset >= 0 ? '+' : ''}${local.offset + 1})`);
    }
  }

  private storeToLocal(local: LocalVar, type: AST.CType) {
    const size = AST.typeSize(type);
    if (size === 1) {
      this.emit('\tLD\tA, L');
      this.emit(`\tLD\t(IY${local.offset >= 0 ? '+' : ''}${local.offset}), A`);
    } else {
      this.emit(`\tLD\t(IY${local.offset >= 0 ? '+' : ''}${local.offset}), L`);
      this.emit(`\tLD\t(IY${local.offset >= 0 ? '+' : ''}${local.offset + 1}), H`);
    }
  }

  // --- ユーティリティ ---
  private emit(line: string) {
    this.lines.push(line);
  }

  private emitMapped(line: string, srcLine: number, srcCol: number) {
    if (line) this.lines.push(line);
    this.mappings.push({
      asmLine: this.lines.length,
      srcFile: 0,
      srcLine,
      srcCol,
    });
  }

  private newLabel(prefix: string): string {
    return `${prefix}_${this.labelCount++}`;
  }
}
