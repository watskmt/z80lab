// Token.ts - トークン型定義

export enum TokenType {
  // リテラル
  INT_LITERAL = 'INT_LITERAL',
  CHAR_LITERAL = 'CHAR_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  IDENTIFIER = 'IDENTIFIER',

  // キーワード
  KW_INT = 'int',
  KW_CHAR = 'char',
  KW_UNSIGNED = 'unsigned',
  KW_VOID = 'void',
  KW_STRUCT = 'struct',
  KW_RETURN = 'return',
  KW_IF = 'if',
  KW_ELSE = 'else',
  KW_WHILE = 'while',
  KW_FOR = 'for',
  KW_DO = 'do',
  KW_SWITCH = 'switch',
  KW_CASE = 'case',
  KW_DEFAULT = 'default',
  KW_BREAK = 'break',
  KW_CONTINUE = 'continue',
  KW_ASM = '__asm__',
  KW_PRAGMA = 'pragma',

  // 算術演算子
  PLUS = '+',
  MINUS = '-',
  STAR = '*',
  SLASH = '/',
  PERCENT = '%',

  // 比較演算子
  EQ_EQ = '==',
  BANG_EQ = '!=',
  LT = '<',
  GT = '>',
  LT_EQ = '<=',
  GT_EQ = '>=',

  // 論理演算子
  AMP_AMP = '&&',
  PIPE_PIPE = '||',
  BANG = '!',

  // ビット演算子
  AMP = '&',
  PIPE = '|',
  CARET = '^',
  TILDE = '~',
  LT_LT = '<<',
  GT_GT = '>>',

  // 代入演算子
  EQ = '=',
  PLUS_EQ = '+=',
  MINUS_EQ = '-=',
  STAR_EQ = '*=',
  SLASH_EQ = '/=',
  AMP_EQ = '&=',
  PIPE_EQ = '|=',

  // インクリメント・デクリメント
  PLUS_PLUS = '++',
  MINUS_MINUS = '--',

  // 区切り文字
  LPAREN = '(',
  RPAREN = ')',
  LBRACE = '{',
  RBRACE = '}',
  LBRACKET = '[',
  RBRACKET = ']',
  SEMICOLON = ';',
  COLON = ':',
  COMMA = ',',
  DOT = '.',
  ARROW = '->',
  HASH = '#',

  // 三項演算子
  QUESTION = '?',

  // 特殊
  EOF = 'EOF',
}

export const KEYWORDS: Record<string, TokenType> = {
  int:      TokenType.KW_INT,
  char:     TokenType.KW_CHAR,
  unsigned: TokenType.KW_UNSIGNED,
  void:     TokenType.KW_VOID,
  struct:   TokenType.KW_STRUCT,
  return:   TokenType.KW_RETURN,
  if:       TokenType.KW_IF,
  else:     TokenType.KW_ELSE,
  while:    TokenType.KW_WHILE,
  for:      TokenType.KW_FOR,
  do:       TokenType.KW_DO,
  switch:   TokenType.KW_SWITCH,
  case:     TokenType.KW_CASE,
  default:  TokenType.KW_DEFAULT,
  break:    TokenType.KW_BREAK,
  continue: TokenType.KW_CONTINUE,
  __asm__:  TokenType.KW_ASM,
};

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}
