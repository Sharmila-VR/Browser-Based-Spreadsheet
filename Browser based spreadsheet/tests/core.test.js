import { describe, it, expect } from 'vitest';
import {
  colIndexToName,
  colNameToIndex,
  coordsToCellId,
  parseCellRef,
  parseRange,
  expandRange,
  shiftFormulaReferences,
} from '../src/core/coords.js';
import { tokenize, parseFormula, extractDependencies, TokenType } from '../src/core/formulaParser.js';
import { FormulaEvaluator } from '../src/core/evaluator.js';
import { DependencyGraph } from '../src/core/dependencyGraph.js';

describe('Coordinate and Reference Utilities', () => {
  it('converts column index to name and vice versa', () => {
    expect(colIndexToName(0)).toBe('A');
    expect(colIndexToName(25)).toBe('Z');
    expect(colIndexToName(26)).toBe('AA');
    expect(colIndexToName(27)).toBe('AB');
    expect(colIndexToName(701)).toBe('ZZ');
    expect(colIndexToName(702)).toBe('AAA');

    expect(colNameToIndex('A')).toBe(0);
    expect(colNameToIndex('Z')).toBe(25);
    expect(colNameToIndex('AA')).toBe(26);
    expect(colNameToIndex('AB')).toBe(27);
    expect(colNameToIndex('ZZ')).toBe(701);
  });

  it('formats coordinates to cell ID', () => {
    expect(coordsToCellId(0, 0)).toBe('A1');
    expect(coordsToCellId(999999, 99)).toBe('CV1000000');
  });

  it('parses cell references with absolute/relative flags', () => {
    expect(parseCellRef('A1')).toEqual({ raw: 'A1', col: 0, row: 0, absCol: false, absRow: false });
    expect(parseCellRef('$B$10')).toEqual({ raw: '$B$10', col: 1, row: 9, absCol: true, absRow: true });
    expect(parseCellRef('$C4')).toEqual({ raw: '$C4', col: 2, row: 3, absCol: true, absRow: false });
    expect(parseCellRef('D$5')).toEqual({ raw: 'D$5', col: 3, row: 4, absCol: false, absRow: true });
    expect(parseCellRef('invalid')).toBeNull();
  });

  it('parses and expands ranges', () => {
    expect(parseRange('invalid')).toBeNull();

    const range = parseRange('A1:B2');
    expect(range).toEqual({
      startRow: 0,
      startCol: 0,
      endRow: 1,
      endCol: 1,
      startAbsCol: false,
      startAbsRow: false,
      endAbsCol: false,
      endAbsRow: false,
    });

    const cells = expandRange('A1:B2');
    expect(cells).toEqual(['A1', 'B1', 'A2', 'B2']);
    expect(expandRange('invalid')).toEqual([]);

    expect(() => expandRange('A1:Z100000', 100)).toThrow();
  });

  it('shifts formula references correctly', () => {
    expect(shiftFormulaReferences('=A1+B1', 1, 0)).toBe('=A2+B2');
    expect(shiftFormulaReferences('=A1+B1', 0, 1)).toBe('=B1+C1');

    expect(shiftFormulaReferences('=$A$1+B1', 2, 2)).toBe('=$A$1+D3');
    expect(shiftFormulaReferences('=$A1+A$1', 1, 1)).toBe('=$A2+B$1');

    expect(shiftFormulaReferences('=A1', -5, 0)).toBe('=#REF!');
    expect(shiftFormulaReferences('=A1', 0, -5)).toBe('=#REF!');

    expect(shiftFormulaReferences('Hello', 1, 1)).toBe('Hello');
  });
});

describe('Formula Parser and AST', () => {
  it('tokenizes numbers, strings, operators, and functions', () => {
    const tokens = tokenize('=SUM(A1:B2) + 42 * "text ""quoted"""');
    expect(tokens.map((t) => t.type)).toEqual([
      'FUNCTION',
      'LPAREN',
      'RANGE',
      'RPAREN',
      'OPERATOR',
      'NUMBER',
      'OPERATOR',
      'STRING',
      'EOF',
    ]);
  });

  it('handles tokens, booleans, and errors gracefully', () => {
    expect(parseFormula('')).toBeNull();
    expect(parseFormula(null)).toBeNull();

    const tokens = tokenize('=TRUE <> FALSE');
    expect(tokens[0].type).toBe(TokenType.BOOLEAN);
    expect(tokens[1].value).toBe('<>');
    expect(tokens[2].type).toBe(TokenType.BOOLEAN);

    expect(() => tokenize('=A1 @ B1')).toThrow('Unexpected character');
  });

  it('builds AST with correct operator precedence', () => {
    const ast = parseFormula('=1 + 2 * 3');
    expect(ast.type).toBe('BinaryOp');
    expect(ast.op).toBe('+');
    expect(ast.left.value).toBe(1);
    expect(ast.right.type).toBe('BinaryOp');
    expect(ast.right.op).toBe('*');
    expect(ast.right.left.value).toBe(2);
    expect(ast.right.right.value).toBe(3);

    const unaryAst = parseFormula('=-A1');
    expect(unaryAst.type).toBe('UnaryOp');
    expect(unaryAst.op).toBe('-');

    const plusUnary = parseFormula('=+5');
    expect(plusUnary.type).toBe('UnaryOp');
    expect(plusUnary.op).toBe('+');

    const colonRange = parseFormula('=A1:B10');
    expect(colonRange.type).toBe('Range');
  });

  it('extracts direct dependencies and range dependencies', () => {
    const ast = parseFormula('=SUM(A1:A3) + B2 * $C$4');
    const deps = extractDependencies(ast);
    expect(Array.from(deps).sort()).toEqual(['A1', 'A2', 'A3', 'B2', 'C4'].sort());
    expect(extractDependencies(null).size).toBe(0);
  });

  it('throws on malformed formulas', () => {
    expect(() => parseFormula('=SUM(A1,')).toThrow();
    expect(() => parseFormula('=1 +')).toThrow();
    expect(() => parseFormula('=(1 + 2')).toThrow();
  });
});

describe('Formula Evaluator', () => {
  const cellStore = {
    A1: 10,
    A2: 20,
    A3: 30,
    B1: 'apple',
    B2: 'orange',
    B3: 'apple',
    C1: 5,
    C2: 15,
    C3: 25,
    D1: 100,
    D2: 200,
    D3: 300,
  };
  const evaluator = new FormulaEvaluator((id) => cellStore[id]);

  it('evaluates arithmetic and comparisons', () => {
    expect(evaluator.evaluate(parseFormula('=A1 + A2 * 2'))).toBe(50);
    expect(evaluator.evaluate(parseFormula('=(A1 + A2) * 2'))).toBe(60);
    expect(evaluator.evaluate(parseFormula('=2 ^ 3'))).toBe(8);
    expect(evaluator.evaluate(parseFormula('="Hello " & "World"'))).toBe('Hello World');
    expect(evaluator.evaluate(parseFormula('=A1 > 5'))).toBe(true);
    expect(evaluator.evaluate(parseFormula('=A1 = 10'))).toBe(true);
    expect(evaluator.evaluate(parseFormula('=A1 <> 10'))).toBe(false);
    expect(evaluator.evaluate(parseFormula('=A1 <= 10'))).toBe(true);
    expect(evaluator.evaluate(parseFormula('=A1 >= 20'))).toBe(false);
    expect(evaluator.evaluate(parseFormula('=A1 < 10'))).toBe(false);
  });

  it('evaluates SUM and AVG', () => {
    expect(evaluator.evaluate(parseFormula('=SUM(A1:A3)'))).toBe(60);
    expect(evaluator.evaluate(parseFormula('=AVG(A1:A3)'))).toBe(20);
    expect(evaluator.evaluate(parseFormula('=SUM(A1, A2, 100)'))).toBe(130);
  });

  it('evaluates MIN, MAX, CONCAT, and LEN', () => {
    expect(evaluator.evaluate(parseFormula('=MIN(A1:A3)'))).toBe(10);
    expect(evaluator.evaluate(parseFormula('=MAX(A1:A3)'))).toBe(30);
    expect(evaluator.evaluate(parseFormula('=CONCAT("Spread", "sheet")'))).toBe('Spreadsheet');
    expect(evaluator.evaluate(parseFormula('=LEN("Quantum")'))).toBe(7);
  });

  it('evaluates IF conditional logic', () => {
    expect(evaluator.evaluate(parseFormula('=IF(A1 > 5, "Yes", "No")'))).toBe('Yes');
    expect(evaluator.evaluate(parseFormula('=IF(A1 < 5, "Yes", "No")'))).toBe('No');
    expect(evaluator.evaluate(parseFormula('=IF(A1 < 5, "Yes")'))).toBe(false);
  });

  it('evaluates COUNTIF', () => {
    expect(evaluator.evaluate(parseFormula('=COUNTIF(B1:B3, "apple")'))).toBe(2);
    expect(evaluator.evaluate(parseFormula('=COUNTIF(A1:A3, ">15")'))).toBe(2);
    expect(evaluator.evaluate(parseFormula('=COUNTIF(A1:A3, "<=20")'))).toBe(2);
    expect(evaluator.evaluate(parseFormula('=COUNTIF(A1:A3, "<>20")'))).toBe(2);
  });

  it('evaluates VLOOKUP (exact, approximate, and bounds)', () => {
    expect(evaluator.evaluate(parseFormula('=VLOOKUP("orange", B1:C3, 2, FALSE)'))).toBe(15);
    expect(evaluator.evaluate(parseFormula('=VLOOKUP("banana", B1:C3, 2, FALSE)'))).toBe('#N/A');

    expect(evaluator.evaluate(parseFormula('=VLOOKUP(25, A1:C3, 3, TRUE)'))).toBe(15);

    expect(evaluator.evaluate(parseFormula('=VLOOKUP("apple", B1:C3, 5, FALSE)'))).toBe('#REF!');
    expect(evaluator.evaluate(parseFormula('=VLOOKUP("apple", B1:C3, 0, FALSE)'))).toBe('#VALUE!');
  });

  it('handles division by zero and unknown functions', () => {
    expect(evaluator.evaluate(parseFormula('=10 / 0'))).toBe('#DIV/0!');
    expect(evaluator.evaluate(parseFormula('=UNKNOWNFUNC(1)'))).toBe('#NAME?');
    expect(evaluator.evaluate(null)).toBe('');
  });
});

describe('Dependency Graph & Incremental Recalculation', () => {
  it('detects simple and indirect circular references (#CIRC!)', () => {
    const graph = new DependencyGraph();
    graph.setDependencies('A1', ['B1']);
    graph.setDependencies('B1', ['A1']);

    const plan = graph.computeRecalculationPlan(['A1']);
    expect(plan.circularCells.has('A1')).toBe(true);
    expect(plan.circularCells.has('B1')).toBe(true);
  });

  it('orders linear dependencies topologically and inspects dependents', () => {
    const graph = new DependencyGraph();
    graph.setDependencies('C1', ['B1']);
    graph.setDependencies('B1', ['A1']);

    expect(graph.getDependencies('C1').has('B1')).toBe(true);
    expect(graph.getDependents('A1').has('B1')).toBe(true);

    const plan = graph.computeRecalculationPlan(['A1']);
    expect(plan.circularCells.size).toBe(0);
    const idxA = plan.evaluationOrder.indexOf('A1');
    const idxB = plan.evaluationOrder.indexOf('B1');
    const idxC = plan.evaluationOrder.indexOf('C1');
    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);

    graph.clearCell('C1');
    expect(graph.getDependencies('C1').size).toBe(0);
  });

  it('recalculates only affected subgraph (incremental)', () => {
    const graph = new DependencyGraph();
    graph.setDependencies('B1', ['A1']);
    graph.setDependencies('C1', ['B1']);
    graph.setDependencies('Y1', ['X1']);

    const plan = graph.computeRecalculationPlan(['A1']);
    expect(plan.subgraphSize).toBe(3);
    expect(plan.evaluationOrder).toContain('A1');
    expect(plan.evaluationOrder).toContain('B1');
    expect(plan.evaluationOrder).toContain('C1');
    expect(plan.evaluationOrder).not.toContain('X1');
    expect(plan.evaluationOrder).not.toContain('Y1');
  });

  it('satisfies constraint: 50,000-cell dependency chain recalculates in under 200ms', () => {
    const chainLength = 50000;
    const graph = new DependencyGraph();
    const cells = new Array(chainLength);
    for (let i = 0; i < chainLength; i++) {
      cells[i] = `CELL_${i}`;
    }

    for (let i = 1; i < chainLength; i++) {
      graph.setDependencies(cells[i], [cells[i - 1]]);
    }

    const t0 = performance.now();
    const plan = graph.computeRecalculationPlan([cells[0]]);
    const elapsed = performance.now() - t0;

    expect(plan.evaluationOrder.length).toBe(chainLength);
    expect(plan.circularCells.size).toBe(0);
    expect(elapsed).toBeLessThan(200);
  });
});
