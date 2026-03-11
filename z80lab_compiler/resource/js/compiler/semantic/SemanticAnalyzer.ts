// SemanticAnalyzer.ts - 意味解析・型検査・シンボルテーブル

import * as AST from '../parser/AST';

export class SemanticError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`[E0003] Semantic error at ${line}:${col}: ${message}`);
  }
}

interface Symbol {
  name: string;
  type: AST.CType;
  isGlobal: boolean;
  offset?: number; // スタックフレームオフセット（ローカル変数）
}

class Scope {
  private symbols = new Map<string, Symbol>();
  constructor(public parent: Scope | null = null) {}

  define(sym: Symbol) { this.symbols.set(sym.name, sym); }

  lookup(name: string): Symbol | null {
    return this.symbols.get(name) ?? this.parent?.lookup(name) ?? null;
  }
}

export interface FunctionInfo {
  name: string;
  returnType: AST.CType;
  params: { name: string; type: AST.CType }[];
}

export class SemanticAnalyzer {
  private scope: Scope = new Scope();
  private functions = new Map<string, FunctionInfo>();
  private structs = new Map<string, AST.StructField[]>();
  private currentFunction: FunctionInfo | null = null;
  public errors: SemanticError[] = [];

  analyze(program: AST.Program): void {
    // 第1パス: 関数・グローバルの登録
    for (const node of program.body) {
      if (node.kind === 'StructDecl') {
        this.structs.set(node.name, node.fields);
      } else if (node.kind === 'FunctionDecl') {
        this.functions.set(node.name, {
          name: node.name,
          returnType: node.returnType,
          params: node.params.map(p => ({ name: p.name, type: p.paramType })),
        });
      } else if (node.kind === 'VarDecl') {
        this.scope.define({ name: node.name, type: node.varType, isGlobal: true });
      }
    }

    // 第2パス: 本体の解析
    for (const node of program.body) {
      if (node.kind === 'FunctionDecl' && node.body) {
        this.analyzeFunction(node);
      } else if (node.kind === 'VarDecl' && node.init) {
        this.analyzeExpr(node.init);
      }
    }
  }

  private analyzeFunction(fn: AST.FunctionDecl) {
    const info = this.functions.get(fn.name)!;
    this.currentFunction = info;
    const fnScope = new Scope(this.scope);
    const saved = this.scope;
    this.scope = fnScope;

    let offset = 0;
    for (const p of fn.params) {
      fnScope.define({ name: p.name, type: p.paramType, isGlobal: false, offset });
      offset += AST.typeSize(p.paramType);
    }

    if (fn.body) this.analyzeBlock(fn.body);
    this.scope = saved;
    this.currentFunction = null;
  }

  private analyzeBlock(block: AST.BlockStmt) {
    const blockScope = new Scope(this.scope);
    const saved = this.scope;
    this.scope = blockScope;
    for (const stmt of block.body) this.analyzeStmt(stmt);
    this.scope = saved;
  }

  private analyzeStmt(stmt: AST.Stmt) {
    switch (stmt.kind) {
      case 'BlockStmt': this.analyzeBlock(stmt); break;
      case 'VarDecl': {
        if (stmt.init) {
          const initType = this.analyzeExpr(stmt.init);
          if (!this.isCompatible(stmt.varType, initType)) {
            this.error(`Type mismatch in variable '${stmt.name}': expected ${AST.typeName(stmt.varType)}, got ${AST.typeName(initType)}`, stmt.line, stmt.col);
          }
        }
        this.scope.define({ name: stmt.name, type: stmt.varType, isGlobal: false });
        break;
      }
      case 'ExprStmt':  this.analyzeExpr(stmt.expr); break;
      case 'ReturnStmt': {
        if (!this.currentFunction) break;
        const rt = this.currentFunction.returnType;
        if (stmt.value) {
          const vt = this.analyzeExpr(stmt.value);
          if (!this.isCompatible(rt, vt)) {
            this.error(`Return type mismatch: expected ${AST.typeName(rt)}, got ${AST.typeName(vt)}`, stmt.line, stmt.col);
          }
        } else if (rt.kind !== 'void') {
          this.error(`Missing return value in non-void function`, stmt.line, stmt.col);
        }
        break;
      }
      case 'IfStmt':
        this.analyzeExpr(stmt.cond);
        this.analyzeStmt(stmt.then);
        if (stmt.else_) this.analyzeStmt(stmt.else_);
        break;
      case 'WhileStmt':
        this.analyzeExpr(stmt.cond);
        this.analyzeStmt(stmt.body);
        break;
      case 'ForStmt':
        if (stmt.init) this.analyzeStmt(stmt.init);
        if (stmt.cond) this.analyzeExpr(stmt.cond);
        if (stmt.update) this.analyzeExpr(stmt.update);
        this.analyzeStmt(stmt.body);
        break;
      case 'DoWhileStmt':
        this.analyzeStmt(stmt.body);
        this.analyzeExpr(stmt.cond);
        break;
      case 'SwitchStmt':
        this.analyzeExpr(stmt.expr);
        for (const c of stmt.cases) {
          if (c.value) this.analyzeExpr(c.value);
          for (const s of c.body) this.analyzeStmt(s);
        }
        break;
      case 'BreakStmt': case 'ContinueStmt': case 'AsmStmt': break;
    }
  }

  analyzeExpr(expr: AST.Expr): AST.CType {
    let t: AST.CType;
    switch (expr.kind) {
      case 'IntLiteral':    t = { kind: 'int', signed: true }; break;
      case 'CharLiteral':   t = { kind: 'char', signed: true }; break;
      case 'StringLiteral': t = { kind: 'pointer', base: { kind: 'char', signed: true } }; break;

      case 'Identifier': {
        const sym = this.scope.lookup(expr.name);
        if (!sym) {
          this.error(`Undefined identifier '${expr.name}'`, expr.line, expr.col);
          t = { kind: 'int', signed: true };
        } else { t = sym.type; }
        break;
      }

      case 'BinaryExpr': {
        const lt = this.analyzeExpr(expr.left);
        const rt = this.analyzeExpr(expr.right);
        if (['==','!=','<','>','<=','>=','&&','||'].includes(expr.op)) t = { kind: 'int', signed: true };
        else t = this.promote(lt, rt);
        break;
      }

      case 'UnaryExpr': {
        const ot = this.analyzeExpr(expr.operand);
        if (expr.op === '*') {
          if (ot.kind !== 'pointer') this.error(`Dereference of non-pointer type`, expr.line, expr.col);
          t = ot.kind === 'pointer' ? ot.base : { kind: 'int', signed: true };
        } else if (expr.op === '&') {
          t = { kind: 'pointer', base: ot };
        } else { t = ot; }
        break;
      }

      case 'AssignExpr': {
        const tt = this.analyzeExpr(expr.target);
        const vt = this.analyzeExpr(expr.value);
        if (!this.isCompatible(tt, vt)) {
          this.error(`Assignment type mismatch: cannot assign ${AST.typeName(vt)} to ${AST.typeName(tt)}`, expr.line, expr.col);
        }
        t = tt;
        break;
      }

      case 'CallExpr': {
        const fn = this.functions.get(expr.callee.name);
        if (!fn) {
          this.error(`Undefined function '${expr.callee.name}'`, expr.line, expr.col);
          t = { kind: 'int', signed: true };
        } else {
          if (expr.args.length !== fn.params.length) {
            this.error(`Wrong number of arguments to '${expr.callee.name}': expected ${fn.params.length}, got ${expr.args.length}`, expr.line, expr.col);
          }
          expr.args.forEach((a, i) => {
            const at = this.analyzeExpr(a);
            if (i < fn.params.length && !this.isCompatible(fn.params[i].type, at)) {
              this.error(`Argument ${i+1} type mismatch in call to '${expr.callee.name}'`, a.line, a.col);
            }
          });
          t = fn.returnType;
        }
        break;
      }

      case 'IndexExpr': {
        const at = this.analyzeExpr(expr.array);
        this.analyzeExpr(expr.index);
        t = at.kind === 'array' ? at.base : at.kind === 'pointer' ? at.base : { kind: 'int', signed: true };
        break;
      }

      case 'MemberExpr': {
        const ot = this.analyzeExpr(expr.object);
        const sType = expr.arrow
          ? (ot.kind === 'pointer' ? ot.base : ot)
          : ot;
        if (sType.kind === 'struct') {
          const fields = this.structs.get(sType.name);
          const field = fields?.find(f => f.name === expr.member);
          t = field?.type ?? { kind: 'int', signed: true };
        } else { t = { kind: 'int', signed: true }; }
        break;
      }

      case 'TernaryExpr': {
        this.analyzeExpr(expr.cond);
        const tt2 = this.analyzeExpr(expr.then);
        this.analyzeExpr(expr.else_);
        t = tt2;
        break;
      }

      case 'CastExpr': {
        this.analyzeExpr(expr.expr);
        t = expr.castType;
        break;
      }

      default: t = { kind: 'int', signed: true };
    }
    expr.type = t;
    return t;
  }

  private promote(a: AST.CType, b: AST.CType): AST.CType {
    if (a.kind === 'pointer' || b.kind === 'pointer') return a.kind === 'pointer' ? a : b;
    if (a.kind === 'int' || b.kind === 'int') return { kind: 'int', signed: true };
    return a;
  }

  private isCompatible(target: AST.CType, src: AST.CType): boolean {
    if (target.kind === src.kind) return true;
    if ((target.kind === 'int' || target.kind === 'char') && (src.kind === 'int' || src.kind === 'char')) return true;
    if (target.kind === 'pointer' && src.kind === 'pointer') return true;
    if (target.kind === 'pointer' && src.kind === 'int') return true; // null pointer etc.
    return false;
  }

  private error(msg: string, line: number, col: number) {
    this.errors.push(new SemanticError(msg, line, col));
  }

  getStructFields(name: string): AST.StructField[] | undefined {
    return this.structs.get(name);
  }
}
