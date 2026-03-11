// Parser.ts - 再帰下降パーサ

import { Token, TokenType } from '../lexer/Token';
import * as AST from './AST';

export class ParseError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`[E0002] Parse error at ${line}:${col}: ${message}`);
  }
}

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): AST.Program {
    const node: AST.Program = { kind: 'Program', body: [], line: 1, col: 1 };
    while (!this.atEOF()) {
      const decl = this.parseTopLevel();
      if (decl) node.body.push(decl);
    }
    return node;
  }

  // --- ユーティリティ ---
  private peek(offset = 0): Token { return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private atEOF(): boolean { return this.peek().type === TokenType.EOF; }
  private check(type: TokenType): boolean { return this.peek().type === type; }

  private expect(type: TokenType): Token {
    if (!this.check(type)) {
      const t = this.peek();
      throw new ParseError(`Expected '${type}', got '${t.value || t.type}'`, t.line, t.col);
    }
    return this.advance();
  }

  private match(...types: TokenType[]): Token | null {
    for (const t of types) { if (this.check(t)) return this.advance(); }
    return null;
  }

  // --- トップレベル ---
  private parseTopLevel(): AST.FunctionDecl | AST.VarDecl | AST.StructDecl | null {
    // struct 宣言
    if (this.check(TokenType.KW_STRUCT) && this.peek(2).type === TokenType.LBRACE) {
      return this.parseStructDecl();
    }
    // 型で始まる宣言
    const baseType = this.tryParseType();
    if (!baseType) { this.advance(); return null; } // スキップ

    const nameTok = this.expect(TokenType.IDENTIFIER);

    // 関数宣言
    if (this.check(TokenType.LPAREN)) {
      return this.parseFunctionDecl(baseType, nameTok);
    }

    // グローバル変数
    return this.parseVarDeclRest(baseType, nameTok, true);
  }

  private parseStructDecl(): AST.StructDecl {
    const tok = this.expect(TokenType.KW_STRUCT);
    const name = this.expect(TokenType.IDENTIFIER).value;
    this.expect(TokenType.LBRACE);
    const fields: AST.StructField[] = [];
    while (!this.check(TokenType.RBRACE) && !this.atEOF()) {
      const ft = this.parseType();
      const fn = this.expect(TokenType.IDENTIFIER).value;
      this.expect(TokenType.SEMICOLON);
      fields.push({ name: fn, type: ft });
    }
    this.expect(TokenType.RBRACE);
    this.expect(TokenType.SEMICOLON);
    return { kind: 'StructDecl', name, fields, line: tok.line, col: tok.col };
  }

  private parseFunctionDecl(returnType: AST.CType, nameTok: Token): AST.FunctionDecl {
    this.expect(TokenType.LPAREN);
    const params: AST.ParamDecl[] = [];
    if (!this.check(TokenType.RPAREN)) {
      do {
        if (this.check(TokenType.KW_VOID) && this.peek(1).type === TokenType.RPAREN) {
          this.advance(); break;
        }
        const pt = this.parseType();
        const pn = this.expect(TokenType.IDENTIFIER);
        params.push({ kind: 'ParamDecl', name: pn.value, paramType: pt, line: pn.line, col: pn.col });
      } while (this.match(TokenType.COMMA));
    }
    this.expect(TokenType.RPAREN);

    let body: AST.BlockStmt | null = null;
    if (this.check(TokenType.LBRACE)) body = this.parseBlock();
    else this.expect(TokenType.SEMICOLON);

    return { kind: 'FunctionDecl', name: nameTok.value, returnType, params, body, line: nameTok.line, col: nameTok.col };
  }

  // --- 型パーサ ---
  private tryParseType(): AST.CType | null {
    if (this.check(TokenType.KW_VOID) || this.check(TokenType.KW_INT) ||
        this.check(TokenType.KW_CHAR) || this.check(TokenType.KW_UNSIGNED) ||
        this.check(TokenType.KW_STRUCT)) {
      return this.parseType();
    }
    return null;
  }

  private parseType(): AST.CType {
    let signed = true;
    if (this.match(TokenType.KW_UNSIGNED)) signed = false;

    let base: AST.CType;
    if (this.match(TokenType.KW_VOID))   base = { kind: 'void' };
    else if (this.match(TokenType.KW_CHAR)) base = { kind: 'char', signed };
    else if (this.match(TokenType.KW_INT))  base = { kind: 'int', signed };
    else if (this.check(TokenType.KW_STRUCT)) {
      this.advance();
      const name = this.expect(TokenType.IDENTIFIER).value;
      base = { kind: 'struct', name };
    } else {
      // unsigned だけなら unsigned int
      if (!signed) base = { kind: 'int', signed: false };
      else { const t = this.peek(); throw new ParseError(`Expected type`, t.line, t.col); }
    }

    // ポインタ
    while (this.match(TokenType.STAR)) base = { kind: 'pointer', base };
    return base;
  }

  // --- 文 ---
  private parseBlock(): AST.BlockStmt {
    const tok = this.expect(TokenType.LBRACE);
    const body: AST.Stmt[] = [];
    while (!this.check(TokenType.RBRACE) && !this.atEOF()) {
      body.push(this.parseStmt());
    }
    this.expect(TokenType.RBRACE);
    return { kind: 'BlockStmt', body, line: tok.line, col: tok.col };
  }

  private parseStmt(): AST.Stmt {
    const t = this.peek();

    if (this.check(TokenType.LBRACE))    return this.parseBlock();
    if (this.check(TokenType.KW_RETURN)) return this.parseReturn();
    if (this.check(TokenType.KW_IF))     return this.parseIf();
    if (this.check(TokenType.KW_WHILE))  return this.parseWhile();
    if (this.check(TokenType.KW_FOR))    return this.parseFor();
    if (this.check(TokenType.KW_DO))     return this.parseDoWhile();
    if (this.check(TokenType.KW_SWITCH)) return this.parseSwitch();
    if (this.check(TokenType.KW_BREAK))  { this.advance(); this.expect(TokenType.SEMICOLON); return { kind: 'BreakStmt', line: t.line, col: t.col }; }
    if (this.check(TokenType.KW_CONTINUE)) { this.advance(); this.expect(TokenType.SEMICOLON); return { kind: 'ContinueStmt', line: t.line, col: t.col }; }
    if (this.check(TokenType.KW_ASM))    return this.parseAsm();

    // 変数宣言
    const varType = this.tryParseType();
    if (varType) {
      const name = this.expect(TokenType.IDENTIFIER);
      return this.parseVarDeclRest(varType, name, false);
    }

    // 式文
    const expr = this.parseExpr();
    this.expect(TokenType.SEMICOLON);
    return { kind: 'ExprStmt', expr, line: t.line, col: t.col };
  }

  private parseReturn(): AST.ReturnStmt {
    const tok = this.expect(TokenType.KW_RETURN);
    let value: AST.Expr | undefined;
    if (!this.check(TokenType.SEMICOLON)) value = this.parseExpr();
    this.expect(TokenType.SEMICOLON);
    return { kind: 'ReturnStmt', value, line: tok.line, col: tok.col };
  }

  private parseIf(): AST.IfStmt {
    const tok = this.expect(TokenType.KW_IF);
    this.expect(TokenType.LPAREN);
    const cond = this.parseExpr();
    this.expect(TokenType.RPAREN);
    const then = this.parseStmt();
    let else_: AST.Stmt | undefined;
    if (this.match(TokenType.KW_ELSE)) else_ = this.parseStmt();
    return { kind: 'IfStmt', cond, then, else_, line: tok.line, col: tok.col };
  }

  private parseWhile(): AST.WhileStmt {
    const tok = this.expect(TokenType.KW_WHILE);
    this.expect(TokenType.LPAREN);
    const cond = this.parseExpr();
    this.expect(TokenType.RPAREN);
    const body = this.parseStmt();
    return { kind: 'WhileStmt', cond, body, line: tok.line, col: tok.col };
  }

  private parseFor(): AST.ForStmt {
    const tok = this.expect(TokenType.KW_FOR);
    this.expect(TokenType.LPAREN);

    let init: AST.Stmt | undefined;
    if (!this.check(TokenType.SEMICOLON)) init = this.parseStmt();
    else this.expect(TokenType.SEMICOLON);

    let cond: AST.Expr | undefined;
    if (!this.check(TokenType.SEMICOLON)) cond = this.parseExpr();
    this.expect(TokenType.SEMICOLON);

    let update: AST.Expr | undefined;
    if (!this.check(TokenType.RPAREN)) update = this.parseExpr();
    this.expect(TokenType.RPAREN);

    const body = this.parseStmt();
    return { kind: 'ForStmt', init, cond, update, body, line: tok.line, col: tok.col };
  }

  private parseDoWhile(): AST.DoWhileStmt {
    const tok = this.expect(TokenType.KW_DO);
    const body = this.parseStmt();
    this.expect(TokenType.KW_WHILE);
    this.expect(TokenType.LPAREN);
    const cond = this.parseExpr();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.SEMICOLON);
    return { kind: 'DoWhileStmt', body, cond, line: tok.line, col: tok.col };
  }

  private parseSwitch(): AST.SwitchStmt {
    const tok = this.expect(TokenType.KW_SWITCH);
    this.expect(TokenType.LPAREN);
    const expr = this.parseExpr();
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.LBRACE);
    const cases: AST.SwitchCase[] = [];
    while (!this.check(TokenType.RBRACE) && !this.atEOF()) {
      const ct = this.peek();
      let value: AST.Expr | undefined;
      if (this.match(TokenType.KW_CASE)) {
        value = this.parseExpr();
        this.expect(TokenType.COLON);
      } else if (this.match(TokenType.KW_DEFAULT)) {
        this.expect(TokenType.COLON);
      } else {
        throw new ParseError('Expected case or default', ct.line, ct.col);
      }
      const body: AST.Stmt[] = [];
      while (!this.check(TokenType.KW_CASE) && !this.check(TokenType.KW_DEFAULT) && !this.check(TokenType.RBRACE) && !this.atEOF()) {
        body.push(this.parseStmt());
      }
      cases.push({ kind: 'SwitchCase', value, body, line: ct.line, col: ct.col });
    }
    this.expect(TokenType.RBRACE);
    return { kind: 'SwitchStmt', expr, cases, line: tok.line, col: tok.col };
  }

  private parseAsm(): AST.AsmStmt {
    const tok = this.expect(TokenType.KW_ASM);
    this.expect(TokenType.LPAREN);
    const code = this.expect(TokenType.STRING_LITERAL).value;
    this.expect(TokenType.RPAREN);
    this.expect(TokenType.SEMICOLON);
    return { kind: 'AsmStmt', code, line: tok.line, col: tok.col };
  }

  private parseVarDeclRest(varType: AST.CType, nameTok: Token, isGlobal: boolean): AST.VarDecl {
    // 配列 int arr[N]
    let finalType = varType;
    if (this.match(TokenType.LBRACKET)) {
      const sizeTok = this.expect(TokenType.INT_LITERAL);
      this.expect(TokenType.RBRACKET);
      finalType = { kind: 'array', base: varType, size: parseInt(sizeTok.value) };
    }

    let init: AST.Expr | undefined;
    if (this.match(TokenType.EQ)) init = this.parseExpr();
    this.expect(TokenType.SEMICOLON);
    return { kind: 'VarDecl', name: nameTok.value, varType: finalType, init, isGlobal, line: nameTok.line, col: nameTok.col };
  }

  // --- 式 (Pratt parser) ---
  private parseExpr(): AST.Expr {
    return this.parseAssign();
  }

  private parseAssign(): AST.Expr {
    const left = this.parseTernary();
    const assignOps: TokenType[] = [
      TokenType.EQ, TokenType.PLUS_EQ, TokenType.MINUS_EQ,
      TokenType.STAR_EQ, TokenType.SLASH_EQ, TokenType.AMP_EQ, TokenType.PIPE_EQ,
    ];
    for (const op of assignOps) {
      if (this.check(op)) {
        const opTok = this.advance();
        const value = this.parseAssign();
        return { kind: 'AssignExpr', op: opTok.value, target: left, value, line: opTok.line, col: opTok.col };
      }
    }
    return left;
  }

  private parseTernary(): AST.Expr {
    const cond = this.parseOr();
    if (this.match(TokenType.QUESTION)) {
      const then = this.parseExpr();
      this.expect(TokenType.COLON);
      const else_ = this.parseTernary();
      return { kind: 'TernaryExpr', cond, then, else_, line: cond.line, col: cond.col };
    }
    return cond;
  }

  private parseOr(): AST.Expr     { return this.parseBinary(['||'], () => this.parseAnd()); }
  private parseAnd(): AST.Expr    { return this.parseBinary(['&&'], () => this.parseBitOr()); }
  private parseBitOr(): AST.Expr  { return this.parseBinary(['|'],  () => this.parseBitXor()); }
  private parseBitXor(): AST.Expr { return this.parseBinary(['^'],  () => this.parseBitAnd()); }
  private parseBitAnd(): AST.Expr { return this.parseBinary(['&'],  () => this.parseEquality()); }
  private parseEquality(): AST.Expr { return this.parseBinary(['==','!='], () => this.parseRelational()); }
  private parseRelational(): AST.Expr { return this.parseBinary(['<','>','<=','>='], () => this.parseShift()); }
  private parseShift(): AST.Expr  { return this.parseBinary(['<<','>>'], () => this.parseAddSub()); }
  private parseAddSub(): AST.Expr { return this.parseBinary(['+','-'],   () => this.parseMulDiv()); }
  private parseMulDiv(): AST.Expr { return this.parseBinary(['*','/','%'], () => this.parseUnary()); }

  private parseBinary(ops: string[], next: () => AST.Expr): AST.Expr {
    let left = next();
    while (ops.includes(this.peek().value) || ops.includes(this.peek().type)) {
      const op = this.advance();
      const right = next();
      left = { kind: 'BinaryExpr', op: op.value, left, right, line: op.line, col: op.col };
    }
    return left;
  }

  private parseUnary(): AST.Expr {
    const t = this.peek();
    if (t.value === '-' || t.value === '!' || t.value === '~') {
      this.advance();
      return { kind: 'UnaryExpr', op: t.value, operand: this.parseUnary(), prefix: true, line: t.line, col: t.col };
    }
    if (t.type === TokenType.STAR) {
      this.advance();
      return { kind: 'UnaryExpr', op: '*', operand: this.parseUnary(), prefix: true, line: t.line, col: t.col };
    }
    if (t.type === TokenType.AMP) {
      this.advance();
      return { kind: 'UnaryExpr', op: '&', operand: this.parseUnary(), prefix: true, line: t.line, col: t.col };
    }
    if (t.type === TokenType.PLUS_PLUS || t.type === TokenType.MINUS_MINUS) {
      this.advance();
      return { kind: 'UnaryExpr', op: t.value, operand: this.parseUnary(), prefix: true, line: t.line, col: t.col };
    }
    // キャスト (type)expr
    if (t.type === TokenType.LPAREN) {
      const saved = this.pos;
      try {
        this.advance();
        const ct = this.parseType();
        if (this.check(TokenType.RPAREN)) {
          this.advance();
          const expr = this.parseUnary();
          return { kind: 'CastExpr', castType: ct, expr, line: t.line, col: t.col };
        }
      } catch { /* not a cast */ }
      this.pos = saved;
    }
    return this.parsePostfix();
  }

  private parsePostfix(): AST.Expr {
    let expr = this.parsePrimary();
    while (true) {
      const t = this.peek();
      if (t.type === TokenType.LBRACKET) {
        this.advance();
        const index = this.parseExpr();
        this.expect(TokenType.RBRACKET);
        expr = { kind: 'IndexExpr', array: expr, index, line: t.line, col: t.col };
      } else if (t.type === TokenType.DOT || t.type === TokenType.ARROW) {
        this.advance();
        const member = this.expect(TokenType.IDENTIFIER).value;
        expr = { kind: 'MemberExpr', object: expr, member, arrow: t.type === TokenType.ARROW, line: t.line, col: t.col };
      } else if (t.type === TokenType.PLUS_PLUS || t.type === TokenType.MINUS_MINUS) {
        this.advance();
        expr = { kind: 'UnaryExpr', op: t.value, operand: expr, prefix: false, line: t.line, col: t.col };
      } else break;
    }
    return expr;
  }

  private parsePrimary(): AST.Expr {
    const t = this.peek();
    if (t.type === TokenType.INT_LITERAL) {
      this.advance();
      return { kind: 'IntLiteral', value: parseInt(t.value), line: t.line, col: t.col };
    }
    if (t.type === TokenType.CHAR_LITERAL) {
      this.advance();
      const code = t.value === '\\n' ? 10 : t.value === '\\0' ? 0 : t.value.charCodeAt(0);
      return { kind: 'CharLiteral', value: code, line: t.line, col: t.col };
    }
    if (t.type === TokenType.STRING_LITERAL) {
      this.advance();
      return { kind: 'StringLiteral', value: t.value, line: t.line, col: t.col };
    }
    if (t.type === TokenType.IDENTIFIER) {
      this.advance();
      // 関数呼び出し
      if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args: AST.Expr[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do { args.push(this.parseExpr()); } while (this.match(TokenType.COMMA));
        }
        this.expect(TokenType.RPAREN);
        return { kind: 'CallExpr', callee: { kind: 'Identifier', name: t.value, line: t.line, col: t.col }, args, line: t.line, col: t.col };
      }
      return { kind: 'Identifier', name: t.value, line: t.line, col: t.col };
    }
    if (t.type === TokenType.LPAREN) {
      this.advance();
      const expr = this.parseExpr();
      this.expect(TokenType.RPAREN);
      return expr;
    }
    throw new ParseError(`Unexpected token '${t.value || t.type}'`, t.line, t.col);
  }
}
