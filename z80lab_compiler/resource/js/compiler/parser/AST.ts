// AST.ts - ASTノード型定義

export type CType =
  | { kind: 'void' }
  | { kind: 'char'; signed: boolean }
  | { kind: 'int'; signed: boolean }
  | { kind: 'pointer'; base: CType }
  | { kind: 'array'; base: CType; size: number }
  | { kind: 'struct'; name: string; fields?: StructField[] };

export interface StructField {
  name: string;
  type: CType;
}

export function typeSize(t: CType): number {
  switch (t.kind) {
    case 'void':    return 0;
    case 'char':    return 1;
    case 'int':     return 2;
    case 'pointer': return 2;
    case 'array':   return t.size * typeSize(t.base);
    case 'struct':  return (t.fields ?? []).reduce((s, f) => s + typeSize(f.type), 0);
  }
}

export function typeName(t: CType): string {
  switch (t.kind) {
    case 'void':    return 'void';
    case 'char':    return t.signed ? 'char' : 'unsigned char';
    case 'int':     return t.signed ? 'int' : 'unsigned int';
    case 'pointer': return `${typeName(t.base)}*`;
    case 'array':   return `${typeName(t.base)}[${t.size}]`;
    case 'struct':  return `struct ${t.name}`;
  }
}

// --- ノード基底 ---
export interface BaseNode {
  line: number;
  col: number;
  type?: CType; // 意味解析後に付与
}

// --- 宣言 ---
export interface Program extends BaseNode {
  kind: 'Program';
  body: (FunctionDecl | VarDecl | StructDecl)[];
}

export interface FunctionDecl extends BaseNode {
  kind: 'FunctionDecl';
  name: string;
  returnType: CType;
  params: ParamDecl[];
  body: BlockStmt | null; // null = プロトタイプ宣言
}

export interface ParamDecl extends BaseNode {
  kind: 'ParamDecl';
  name: string;
  paramType: CType;
}

export interface VarDecl extends BaseNode {
  kind: 'VarDecl';
  name: string;
  varType: CType;
  init?: Expr;
  isGlobal?: boolean;
}

export interface StructDecl extends BaseNode {
  kind: 'StructDecl';
  name: string;
  fields: StructField[];
}

// --- 文 ---
export type Stmt =
  | BlockStmt | ExprStmt | ReturnStmt | IfStmt
  | WhileStmt | ForStmt | DoWhileStmt | SwitchStmt
  | BreakStmt | ContinueStmt | VarDecl | AsmStmt;

export interface BlockStmt extends BaseNode {
  kind: 'BlockStmt';
  body: Stmt[];
}

export interface ExprStmt extends BaseNode {
  kind: 'ExprStmt';
  expr: Expr;
}

export interface ReturnStmt extends BaseNode {
  kind: 'ReturnStmt';
  value?: Expr;
}

export interface IfStmt extends BaseNode {
  kind: 'IfStmt';
  cond: Expr;
  then: Stmt;
  else_?: Stmt;
}

export interface WhileStmt extends BaseNode {
  kind: 'WhileStmt';
  cond: Expr;
  body: Stmt;
}

export interface ForStmt extends BaseNode {
  kind: 'ForStmt';
  init?: Stmt;
  cond?: Expr;
  update?: Expr;
  body: Stmt;
}

export interface DoWhileStmt extends BaseNode {
  kind: 'DoWhileStmt';
  body: Stmt;
  cond: Expr;
}

export interface SwitchStmt extends BaseNode {
  kind: 'SwitchStmt';
  expr: Expr;
  cases: SwitchCase[];
}

export interface SwitchCase extends BaseNode {
  kind: 'SwitchCase';
  value?: Expr; // undefined = default
  body: Stmt[];
}

export interface BreakStmt extends BaseNode { kind: 'BreakStmt'; }
export interface ContinueStmt extends BaseNode { kind: 'ContinueStmt'; }

export interface AsmStmt extends BaseNode {
  kind: 'AsmStmt';
  code: string;
}

// --- 式 ---
export type Expr =
  | IntLiteral | CharLiteral | StringLiteral
  | Identifier | BinaryExpr | UnaryExpr | AssignExpr
  | CallExpr | IndexExpr | MemberExpr | TernaryExpr | CastExpr;

export interface IntLiteral extends BaseNode {
  kind: 'IntLiteral';
  value: number;
}

export interface CharLiteral extends BaseNode {
  kind: 'CharLiteral';
  value: number;
}

export interface StringLiteral extends BaseNode {
  kind: 'StringLiteral';
  value: string;
}

export interface Identifier extends BaseNode {
  kind: 'Identifier';
  name: string;
}

export interface BinaryExpr extends BaseNode {
  kind: 'BinaryExpr';
  op: string;
  left: Expr;
  right: Expr;
}

export interface UnaryExpr extends BaseNode {
  kind: 'UnaryExpr';
  op: string;  // -, !, ~, *, &, ++, --
  operand: Expr;
  prefix: boolean;
}

export interface AssignExpr extends BaseNode {
  kind: 'AssignExpr';
  op: string; // =, +=, -=, *=, /=, &=, |=
  target: Expr;
  value: Expr;
}

export interface CallExpr extends BaseNode {
  kind: 'CallExpr';
  callee: Identifier;
  args: Expr[];
}

export interface IndexExpr extends BaseNode {
  kind: 'IndexExpr';
  array: Expr;
  index: Expr;
}

export interface MemberExpr extends BaseNode {
  kind: 'MemberExpr';
  object: Expr;
  member: string;
  arrow: boolean; // true = ->, false = .
}

export interface TernaryExpr extends BaseNode {
  kind: 'TernaryExpr';
  cond: Expr;
  then: Expr;
  else_: Expr;
}

export interface CastExpr extends BaseNode {
  kind: 'CastExpr';
  castType: CType;
  expr: Expr;
}
