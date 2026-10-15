import { parseCellRef, parseRange, expandRange, coordsToCellId } from './coords.js';

export const TokenType = {
  NUMBER: 'NUMBER',
  STRING: 'STRING',
  BOOLEAN: 'BOOLEAN',
  CELL_REF: 'CELL_REF',
  RANGE: 'RANGE',
  FUNCTION: 'FUNCTION',
  OPERATOR: 'OPERATOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  COMMA: 'COMMA',
  COLON: 'COLON',
  EOF: 'EOF',
};

export function tokenize(formula) {
  const tokens = [];
  let pos = 0;
  const str = formula.trim().startsWith('=') ? formula.trim().slice(1) : formula.trim();

  function peek() {
    return pos < str.length ? str[pos] : null;
  }

  function advance() {
    return pos < str.length ? str[pos++] : null;
  }

  while (pos < str.length) {
    let char = peek();

    if (/\s/.test(char)) {
      advance();
      continue;
    }

    if (char === '"') {
      const startPos = pos;
      advance();
      let value = '';
      while (pos < str.length) {
        if (peek() === '"') {
          advance();
          if (peek() === '"') {
            value += '"';
            advance();
          } else {
            break;
          }
        } else {
          value += advance();
        }
      }
      tokens.push({
        type: TokenType.STRING,
        value,
        raw: str.slice(startPos, pos),
        pos: startPos,
      });
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(str[pos + 1] || ''))) {
      const startPos = pos;
      let numStr = '';
      let hasDot = false;
      while (pos < str.length) {
        const c = peek();
        if (/[0-9]/.test(c)) {
          numStr += advance();
        } else if (c === '.' && !hasDot) {
          hasDot = true;
          numStr += advance();
        } else {
          break;
        }
      }
      tokens.push({
        type: TokenType.NUMBER,
        value: parseFloat(numStr),
        raw: numStr,
        pos: startPos,
      });
      continue;
    }

    const next2 = str.slice(pos, pos + 2);
    if (['<=', '>=', '<>'].includes(next2)) {
      tokens.push({
        type: TokenType.OPERATOR,
        value: next2,
        raw: next2,
        pos,
      });
      pos += 2;
      continue;
    }

    if (['+', '-', '*', '/', '^', '&', '=', '<', '>'].includes(char)) {
      tokens.push({
        type: TokenType.OPERATOR,
        value: char,
        raw: char,
        pos,
      });
      advance();
      continue;
    }

    if (char === '(') {
      tokens.push({ type: TokenType.LPAREN, value: '(', raw: '(', pos });
      advance();
      continue;
    }
    if (char === ')') {
      tokens.push({ type: TokenType.RPAREN, value: ')', raw: ')', pos });
      advance();
      continue;
    }
    if (char === ',') {
      tokens.push({ type: TokenType.COMMA, value: ',', raw: ',', pos });
      advance();
      continue;
    }
    if (char === ':') {
      tokens.push({ type: TokenType.COLON, value: ':', raw: ':', pos });
      advance();
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const startPos = pos;
      let ident = '';
      while (pos < str.length && /[A-Za-z0-9_$:]/.test(peek())) {
        ident += advance();
      }

      if (ident.includes(':')) {
        const parsedR = parseRange(ident);
        if (parsedR) {
          tokens.push({
            type: TokenType.RANGE,
            value: ident.toUpperCase(),
            raw: ident,
            rangeData: parsedR,
            pos: startPos,
          });
          continue;
        }
      }

      const upper = ident.toUpperCase();

      let lookaheadPos = pos;
      while (lookaheadPos < str.length && /\s/.test(str[lookaheadPos])) {
        lookaheadPos++;
      }
      if (str[lookaheadPos] === '(') {
        tokens.push({
          type: TokenType.FUNCTION,
          value: upper,
          raw: ident,
          pos: startPos,
        });
        continue;
      }

      if (upper === 'TRUE' || upper === 'FALSE') {
        tokens.push({
          type: TokenType.BOOLEAN,
          value: upper === 'TRUE',
          raw: ident,
          pos: startPos,
        });
        continue;
      }

      const parsedCell = parseCellRef(ident);
      if (parsedCell) {
        tokens.push({
          type: TokenType.CELL_REF,
          value: ident.toUpperCase(),
          raw: ident,
          cellData: parsedCell,
          pos: startPos,
        });
        continue;
      }

      tokens.push({
        type: TokenType.FUNCTION,
        value: upper,
        raw: ident,
        pos: startPos,
      });
      continue;
    }

    throw new Error(`Unexpected character '${char}' at index ${pos}`);
  }

  tokens.push({ type: TokenType.EOF, value: null, raw: '', pos });
  return tokens;
}

export class FormulaParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
  }

  peek() {
    return this.tokens[this.current];
  }

  previous() {
    return this.tokens[this.current - 1];
  }

  isAtEnd() {
    return this.peek().type === TokenType.EOF;
  }

  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  check(type, value = null) {
    if (this.isAtEnd()) return false;
    if (this.peek().type !== type) return false;
    if (value !== null && this.peek().value !== value) return false;
    return true;
  }

  match(type, value = null) {
    if (this.check(type, value)) {
      this.advance();
      return true;
    }
    return false;
  }

  consume(type, message) {
    if (this.check(type)) return this.advance();
    throw new Error(`${message}. Found ${this.peek().type} ('${this.peek().raw}') at pos ${this.peek().pos}`);
  }

  parse() {
    if (this.tokens.length === 0 || this.check(TokenType.EOF)) {
      return null;
    }
    const ast = this.comparison();
    if (!this.isAtEnd()) {
      throw new Error(`Unexpected token '${this.peek().raw}' after expression at pos ${this.peek().pos}`);
    }
    return ast;
  }

  comparison() {
    let expr = this.concat();

    while (
      this.check(TokenType.OPERATOR, '=') ||
      this.check(TokenType.OPERATOR, '<>') ||
      this.check(TokenType.OPERATOR, '<') ||
      this.check(TokenType.OPERATOR, '<=') ||
      this.check(TokenType.OPERATOR, '>') ||
      this.check(TokenType.OPERATOR, '>=')
    ) {
      const op = this.advance().value;
      const right = this.concat();
      expr = {
        type: 'BinaryOp',
        op,
        left: expr,
        right,
      };
    }
    return expr;
  }

  concat() {
    let expr = this.additive();

    while (this.check(TokenType.OPERATOR, '&')) {
      const op = this.advance().value;
      const right = this.additive();
      expr = {
        type: 'BinaryOp',
        op,
        left: expr,
        right,
      };
    }
    return expr;
  }

  additive() {
    let expr = this.multiplicative();

    while (this.check(TokenType.OPERATOR, '+') || this.check(TokenType.OPERATOR, '-')) {
      const op = this.advance().value;
      const right = this.multiplicative();
      expr = {
        type: 'BinaryOp',
        op,
        left: expr,
        right,
      };
    }
    return expr;
  }

  multiplicative() {
    let expr = this.power();

    while (this.check(TokenType.OPERATOR, '*') || this.check(TokenType.OPERATOR, '/')) {
      const op = this.advance().value;
      const right = this.power();
      expr = {
        type: 'BinaryOp',
        op,
        left: expr,
        right,
      };
    }
    return expr;
  }

  power() {
    let expr = this.unary();

    if (this.check(TokenType.OPERATOR, '^')) {
      const op = this.advance().value;
      const right = this.power();
      return {
        type: 'BinaryOp',
        op,
        left: expr,
        right,
      };
    }
    return expr;
  }

  unary() {
    if (this.check(TokenType.OPERATOR, '+') || this.check(TokenType.OPERATOR, '-')) {
      const op = this.advance().value;
      const expr = this.unary();
      return {
        type: 'UnaryOp',
        op,
        expr,
      };
    }
    return this.rangeExpr();
  }

  rangeExpr() {
    let expr = this.primary();

    if (this.match(TokenType.COLON)) {
      const right = this.primary();
      if (expr.type === 'CellRef' && right.type === 'CellRef') {
        const rawRange = `${expr.raw}:${right.raw}`;
        const rangeData = parseRange(rawRange);
        return {
          type: 'Range',
          raw: rawRange.toUpperCase(),
          startRow: rangeData.startRow,
          startCol: rangeData.startCol,
          endRow: rangeData.endRow,
          endCol: rangeData.endCol,
        };
      }
      throw new Error(`Colon operator requires cell references on both sides`);
    }

    return expr;
  }

  primary() {
    if (this.match(TokenType.NUMBER)) {
      return { type: 'Number', value: this.previous().value };
    }

    if (this.match(TokenType.STRING)) {
      return { type: 'String', value: this.previous().value };
    }

    if (this.match(TokenType.BOOLEAN)) {
      return { type: 'Boolean', value: this.previous().value };
    }

    if (this.match(TokenType.RANGE)) {
      const token = this.previous();
      return {
        type: 'Range',
        raw: token.value,
        startRow: token.rangeData.startRow,
        startCol: token.rangeData.startCol,
        endRow: token.rangeData.endRow,
        endCol: token.rangeData.endCol,
      };
    }

    if (this.match(TokenType.CELL_REF)) {
      const token = this.previous();
      return {
        type: 'CellRef',
        raw: token.value,
        row: token.cellData.row,
        col: token.cellData.col,
        absRow: token.cellData.absRow,
        absCol: token.cellData.absCol,
      };
    }

    if (this.match(TokenType.FUNCTION)) {
      const funcName = this.previous().value;
      this.consume(TokenType.LPAREN, `Expected '(' after function '${funcName}'`);
      const args = [];
      if (!this.check(TokenType.RPAREN)) {
        do {
          args.push(this.comparison());
        } while (this.match(TokenType.COMMA));
      }
      this.consume(TokenType.RPAREN, `Expected ')' after function arguments`);
      return {
        type: 'FunctionCall',
        name: funcName,
        args,
      };
    }

    if (this.match(TokenType.LPAREN)) {
      const expr = this.comparison();
      this.consume(TokenType.RPAREN, "Expected ')' after expression");
      return expr;
    }

    throw new Error(`Unexpected token '${this.peek().raw}' of type ${this.peek().type} at pos ${this.peek().pos}`);
  }
}

export function parseFormula(formula) {
  if (!formula || typeof formula !== 'string') return null;
  const tokens = tokenize(formula);
  const parser = new FormulaParser(tokens);
  return parser.parse();
}

export function extractDependencies(ast) {
  const deps = new Set();
  if (!ast) return deps;

  function traverse(node) {
    if (!node) return;
    switch (node.type) {
      case 'CellRef':
        deps.add(coordsToCellId(node.row, node.col));
        break;
      case 'Range': {
        const cells = expandRange(node.raw);
        for (const c of cells) {
          deps.add(c);
        }
        break;
      }
      case 'FunctionCall':
        if (node.args) {
          for (const arg of node.args) {
            traverse(arg);
          }
        }
        break;
      case 'BinaryOp':
        traverse(node.left);
        traverse(node.right);
        break;
      case 'UnaryOp':
        traverse(node.expr);
        break;
      default:
        break;
    }
  }

  traverse(ast);
  return deps;
}
