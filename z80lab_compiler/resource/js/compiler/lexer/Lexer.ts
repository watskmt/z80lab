// Lexer.ts - 字句解析器

import { Token, TokenType, KEYWORDS } from './Token';

export class LexError extends Error {
  constructor(message: string, public line: number, public col: number) {
    super(`[E0001] Lex error at ${line}:${col}: ${message}`);
  }
}

export class Lexer {
  private pos = 0;
  private line = 1;
  private col = 1;
  private tokens: Token[] = [];

  constructor(private source: string) {}

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.source.length) break;

      const ch = this.source[this.pos];

      if (ch === '#') { this.skipPreprocessorLine(); continue; }
      if (this.isDigit(ch)) { this.readNumber(); continue; }
      if (this.isAlpha(ch) || ch === '_') { this.readIdentOrKeyword(); continue; }
      if (ch === '"') { this.readString(); continue; }
      if (ch === "'") { this.readChar(); continue; }
      this.readOperatorOrPunct();
    }

    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line, col: this.col });
    return this.tokens;
  }

  private peek(offset = 0): string {
    return this.source[this.pos + offset] ?? '';
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    if (ch === '\n') { this.line++; this.col = 1; } else { this.col++; }
    return ch;
  }

  private emit(type: TokenType, value: string, line: number, col: number) {
    this.tokens.push({ type, value, line, col });
  }

  private skipWhitespaceAndComments() {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance(); continue;
      }
      // 行コメント
      if (ch === '/' && this.peek(1) === '/') {
        while (this.pos < this.source.length && this.source[this.pos] !== '\n') this.advance();
        continue;
      }
      // ブロックコメント
      if (ch === '/' && this.peek(1) === '*') {
        this.advance(); this.advance();
        while (this.pos < this.source.length) {
          if (this.source[this.pos] === '*' && this.peek(1) === '/') {
            this.advance(); this.advance(); break;
          }
          this.advance();
        }
        continue;
      }
      break;
    }
  }

  private skipPreprocessorLine() {
    // #pragma はトークンとして残す可能性があるが今は全スキップ
    while (this.pos < this.source.length && this.source[this.pos] !== '\n') this.advance();
  }

  private readNumber() {
    const startLine = this.line, startCol = this.col;
    let value = '';
    // 16進数
    if (this.peek() === '0' && (this.peek(1) === 'x' || this.peek(1) === 'X')) {
      value += this.advance() + this.advance();
      while (this.isHexDigit(this.peek())) value += this.advance();
    } else {
      while (this.isDigit(this.peek())) value += this.advance();
    }
    this.emit(TokenType.INT_LITERAL, value, startLine, startCol);
  }

  private readIdentOrKeyword() {
    const startLine = this.line, startCol = this.col;
    let value = '';
    while (this.isAlphaNum(this.peek()) || this.peek() === '_') value += this.advance();
    const type = KEYWORDS[value] ?? TokenType.IDENTIFIER;
    this.emit(type, value, startLine, startCol);
  }

  private readString() {
    const startLine = this.line, startCol = this.col;
    this.advance(); // opening "
    let value = '';
    while (this.pos < this.source.length && this.peek() !== '"') {
      if (this.peek() === '\\') { value += this.advance(); }
      value += this.advance();
    }
    if (this.peek() !== '"') throw new LexError('Unterminated string', startLine, startCol);
    this.advance(); // closing "
    this.emit(TokenType.STRING_LITERAL, value, startLine, startCol);
  }

  private readChar() {
    const startLine = this.line, startCol = this.col;
    this.advance(); // opening '
    let value = '';
    if (this.peek() === '\\') { value += this.advance(); }
    value += this.advance();
    if (this.peek() !== "'") throw new LexError('Unterminated char literal', startLine, startCol);
    this.advance(); // closing '
    this.emit(TokenType.CHAR_LITERAL, value, startLine, startCol);
  }

  private readOperatorOrPunct() {
    const startLine = this.line, startCol = this.col;
    const ch = this.peek();
    const ch2 = ch + this.peek(1);

    // 3文字演算子（なし、将来拡張用）

    // 2文字演算子
    const two: Record<string, TokenType> = {
      '==': TokenType.EQ_EQ, '!=': TokenType.BANG_EQ,
      '<=': TokenType.LT_EQ, '>=': TokenType.GT_EQ,
      '&&': TokenType.AMP_AMP, '||': TokenType.PIPE_PIPE,
      '<<': TokenType.LT_LT, '>>': TokenType.GT_GT,
      '+=': TokenType.PLUS_EQ, '-=': TokenType.MINUS_EQ,
      '*=': TokenType.STAR_EQ, '/=': TokenType.SLASH_EQ,
      '&=': TokenType.AMP_EQ, '|=': TokenType.PIPE_EQ,
      '++': TokenType.PLUS_PLUS, '--': TokenType.MINUS_MINUS,
      '->': TokenType.ARROW,
    };
    if (two[ch2]) {
      this.advance(); this.advance();
      this.emit(two[ch2], ch2, startLine, startCol);
      return;
    }

    // 1文字演算子
    const one: Record<string, TokenType> = {
      '+': TokenType.PLUS, '-': TokenType.MINUS,
      '*': TokenType.STAR, '/': TokenType.SLASH, '%': TokenType.PERCENT,
      '<': TokenType.LT, '>': TokenType.GT,
      '&': TokenType.AMP, '|': TokenType.PIPE,
      '^': TokenType.CARET, '~': TokenType.TILDE,
      '!': TokenType.BANG, '=': TokenType.EQ,
      '(': TokenType.LPAREN, ')': TokenType.RPAREN,
      '{': TokenType.LBRACE, '}': TokenType.RBRACE,
      '[': TokenType.LBRACKET, ']': TokenType.RBRACKET,
      ';': TokenType.SEMICOLON, ':': TokenType.COLON,
      ',': TokenType.COMMA, '.': TokenType.DOT,
      '?': TokenType.QUESTION, '#': TokenType.HASH,
    };
    if (one[ch]) {
      this.advance();
      this.emit(one[ch], ch, startLine, startCol);
      return;
    }

    throw new LexError(`Unexpected character '${ch}'`, startLine, startCol);
  }

  private isDigit(c: string) { return c >= '0' && c <= '9'; }
  private isHexDigit(c: string) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'); }
  private isAlpha(c: string) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'; }
  private isAlphaNum(c: string) { return this.isAlpha(c) || this.isDigit(c); }
}
