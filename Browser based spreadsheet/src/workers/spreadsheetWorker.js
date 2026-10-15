import { parseFormula, extractDependencies } from '../core/formulaParser.js';
import { FormulaEvaluator } from '../core/evaluator.js';
import { DependencyGraph } from '../core/dependencyGraph.js';

const graph = new DependencyGraph();
const cellStore = new Map();

function getCellValue(cellId) {
  const cell = cellStore.get(cellId);
  return cell ? cell.value : null;
}

const evaluator = new FormulaEvaluator(getCellValue);

function processCellInput(cellId, raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';

  if (trimmed === '') {
    cellStore.delete(cellId);
    graph.clearCell(cellId);
    return { isFormula: false, value: '' };
  }

  if (trimmed.startsWith('=')) {
    try {
      const ast = parseFormula(trimmed);
      const deps = extractDependencies(ast);
      graph.setDependencies(cellId, deps);
      cellStore.set(cellId, { raw: trimmed, ast, value: null });
      return { isFormula: true, ast };
    } catch (err) {
      graph.clearCell(cellId);
      const errMsg = '#ERROR!';
      cellStore.set(cellId, { raw: trimmed, ast: null, value: errMsg });
      return { isFormula: false, value: errMsg };
    }
  } else {
    graph.clearCell(cellId);
    const num = Number(trimmed);
    const value = !isNaN(num) ? num : (trimmed.toUpperCase() === 'TRUE' ? true : (trimmed.toUpperCase() === 'FALSE' ? false : trimmed));
    cellStore.set(cellId, { raw: trimmed, ast: null, value });
    return { isFormula: false, value };
  }
}

function runRecalculation(dirtyRoots) {
  const t0 = performance.now();
  const plan = graph.computeRecalculationPlan(dirtyRoots);
  const updates = {};

  for (const cellId of plan.circularCells) {
    const existing = cellStore.get(cellId) || { raw: '', ast: null };
    existing.value = '#CIRC!';
    cellStore.set(cellId, existing);
    updates[cellId] = { raw: existing.raw, value: '#CIRC!' };
  }

  for (const cellId of plan.evaluationOrder) {
    if (plan.circularCells.has(cellId)) continue;
    const cell = cellStore.get(cellId);
    if (!cell) {
      updates[cellId] = { raw: '', value: '' };
      continue;
    }

    if (cell.ast) {
      const computedValue = evaluator.evaluate(cell.ast);
      cell.value = computedValue;
      updates[cellId] = { raw: cell.raw, value: computedValue };
    } else {
      updates[cellId] = { raw: cell.raw, value: cell.value };
    }
  }

  const elapsed = performance.now() - t0;
  return { updates, circularCells: Array.from(plan.circularCells), elapsed };
}

self.onmessage = function (event) {
  const { type, payload, reqId } = event.data;

  switch (type) {
    case 'SET_CELL': {
      const { cellId, raw } = payload;
      processCellInput(cellId, raw);
      const { updates, circularCells, elapsed } = runRecalculation([cellId]);
      self.postMessage({
        type: 'RECALC_SUCCESS',
        reqId,
        updates,
        circularCells,
        elapsed,
      });
      break;
    }

    case 'BATCH_SET_CELLS': {
      const { edits } = payload;
      const dirtyRoots = new Set();
      for (const edit of edits) {
        processCellInput(edit.cellId, edit.raw);
        dirtyRoots.add(edit.cellId);
      }
      const { updates, circularCells, elapsed } = runRecalculation(dirtyRoots);
      self.postMessage({
        type: 'RECALC_SUCCESS',
        reqId,
        updates,
        circularCells,
        elapsed,
      });
      break;
    }

    case 'INIT_GRID': {
      cellStore.clear();
      const dirtyRoots = new Set();
      if (payload && payload.cells) {
        for (const [cellId, cellData] of Object.entries(payload.cells)) {
          processCellInput(cellId, cellData.raw);
          dirtyRoots.add(cellId);
        }
      }
      const { updates, circularCells, elapsed } = runRecalculation(dirtyRoots);
      self.postMessage({
        type: 'INIT_SUCCESS',
        reqId,
        updates,
        circularCells,
        elapsed,
      });
      break;
    }

    default:
      break;
  }
};
