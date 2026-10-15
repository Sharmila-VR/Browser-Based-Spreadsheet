import { coordsToCellId, expandRange } from './coords.js';

export class FormulaEvaluator {
  constructor(getCellValue) {
    this.getCellValue = getCellValue;
  }

  evaluate(ast) {
    if (!ast) return '';
    try {
      return this.evalNode(ast);
    } catch (err) {
      if (err.message && err.message.startsWith('#')) {
        return err.message;
      }
      return '#ERROR!';
    }
  }

  evalNode(node) {
    if (!node) return null;

    switch (node.type) {
      case 'Number':
        return node.value;

      case 'String':
        return node.value;

      case 'Boolean':
        return node.value;

      case 'CellRef': {
        const cellId = coordsToCellId(node.row, node.col);
        const val = this.getCellValue(cellId);
        return this.cleanValue(val);
      }

      case 'Range': {
        return node;
      }

      case 'UnaryOp': {
        const val = this.evalNode(node.expr);
        if (this.isError(val)) return val;
        const num = Number(val);
        if (isNaN(num)) return '#VALUE!';
        if (node.op === '-') return -num;
        if (node.op === '+') return num;
        return '#ERROR!';
      }

      case 'BinaryOp':
        return this.evalBinary(node.op, node.left, node.right);

      case 'FunctionCall':
        return this.evalFunction(node.name.toUpperCase(), node.args);

      default:
        return '#ERROR!';
    }
  }

  cleanValue(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      if (val.startsWith('#')) return val;
      const num = Number(val);
      return !isNaN(num) && val.trim() !== '' ? num : val;
    }
    return val;
  }

  isError(val) {
    return typeof val === 'string' && val.startsWith('#');
  }

  evalBinary(op, leftNode, rightNode) {
    const leftVal = this.evalNode(leftNode);
    if (this.isError(leftVal)) return leftVal;

    const rightVal = this.evalNode(rightNode);
    if (this.isError(rightVal)) return rightVal;

    if (op === '&') {
      const lStr = leftVal === null || leftVal === undefined ? '' : String(leftVal);
      const rStr = rightVal === null || rightVal === undefined ? '' : String(rightVal);
      return lStr + rStr;
    }

    if (['=', '<>', '<', '<=', '>', '>='].includes(op)) {
      return this.evalComparison(op, leftVal, rightVal);
    }

    const leftNum = Number(leftVal);
    const rightNum = Number(rightVal);
    if (isNaN(leftNum) || isNaN(rightNum)) {
      return '#VALUE!';
    }

    switch (op) {
      case '+':
        return leftNum + rightNum;
      case '-':
        return leftNum - rightNum;
      case '*':
        return leftNum * rightNum;
      case '/':
        if (rightNum === 0) return '#DIV/0!';
        return leftNum / rightNum;
      case '^':
        return Math.pow(leftNum, rightNum);
      default:
        return '#ERROR!';
    }
  }

  evalComparison(op, left, right) {
    const lNum = Number(left);
    const rNum = Number(right);
    const bothNumbers = typeof left !== 'boolean' && typeof right !== 'boolean' && !isNaN(lNum) && !isNaN(rNum);

    const a = bothNumbers ? lNum : (typeof left === 'string' ? left.toLowerCase() : left);
    const b = bothNumbers ? rNum : (typeof right === 'string' ? right.toLowerCase() : right);

    switch (op) {
      case '=':
        return a === b;
      case '<>':
        return a !== b;
      case '<':
        return a < b;
      case '<=':
        return a <= b;
      case '>':
        return a > b;
      case '>=':
        return a >= b;
      default:
        return false;
    }
  }

  evalFunction(name, args) {
    switch (name) {
      case 'SUM':
        return this.fnSum(args);

      case 'AVG':
      case 'AVERAGE':
        return this.fnAvg(args);

      case 'IF':
        return this.fnIf(args);

      case 'COUNTIF':
        return this.fnCountIf(args);

      case 'VLOOKUP':
        return this.fnVLookup(args);

      case 'MIN':
        return this.fnMin(args);

      case 'MAX':
        return this.fnMax(args);

      case 'CONCAT':
      case 'CONCATENATE':
        return this.fnConcat(args);

      case 'LEN': {
        if (!args || args.length !== 1) return '#ERROR!';
        const v = this.evalNode(args[0]);
        if (this.isError(v)) return v;
        return String(v).length;
      }

      default:
        return '#NAME?';
    }
  }

  flattenArgs(args) {
    const values = [];
    for (const arg of args) {
      if (arg.type === 'Range') {
        const cells = expandRange(arg.raw);
        for (const cellId of cells) {
          const val = this.getCellValue(cellId);
          values.push(val);
        }
      } else {
        const val = this.evalNode(arg);
        values.push(val);
      }
    }
    return values;
  }

  fnSum(args) {
    const values = this.flattenArgs(args);
    let sum = 0;
    for (const v of values) {
      if (this.isError(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      const num = Number(v);
      if (!isNaN(num)) {
        sum += num;
      }
    }
    return sum;
  }

  fnAvg(args) {
    const values = this.flattenArgs(args);
    let sum = 0;
    let count = 0;
    for (const v of values) {
      if (this.isError(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      const num = Number(v);
      if (!isNaN(num)) {
        sum += num;
        count++;
      }
    }
    if (count === 0) return '#DIV/0!';
    return sum / count;
  }

  fnMin(args) {
    const values = this.flattenArgs(args);
    let min = Infinity;
    let found = false;
    for (const v of values) {
      if (this.isError(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      const num = Number(v);
      if (!isNaN(num)) {
        if (num < min) min = num;
        found = true;
      }
    }
    return found ? min : 0;
  }

  fnMax(args) {
    const values = this.flattenArgs(args);
    let max = -Infinity;
    let found = false;
    for (const v of values) {
      if (this.isError(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      const num = Number(v);
      if (!isNaN(num)) {
        if (num > max) max = num;
        found = true;
      }
    }
    return found ? max : 0;
  }

  fnConcat(args) {
    const values = this.flattenArgs(args);
    let res = '';
    for (const v of values) {
      if (this.isError(v)) return v;
      if (v !== null && v !== undefined) res += String(v);
    }
    return res;
  }

  fnIf(args) {
    if (!args || args.length < 2 || args.length > 3) {
      return '#ERROR!';
    }
    const condVal = this.evalNode(args[0]);
    if (this.isError(condVal)) return condVal;

    const isTrue = Boolean(condVal);
    if (isTrue) {
      return this.evalNode(args[1]);
    } else {
      return args.length === 3 ? this.evalNode(args[2]) : false;
    }
  }

  fnCountIf(args) {
    if (!args || args.length !== 2) return '#ERROR!';
    const rangeArg = args[0];
    const criteriaArg = args[1];

    if (rangeArg.type !== 'Range') {
      return '#ERROR!';
    }

    const criteriaRaw = this.evalNode(criteriaArg);
    if (this.isError(criteriaRaw)) return criteriaRaw;

    const cells = expandRange(rangeArg.raw);
    let count = 0;

    let op = '=';
    let target = criteriaRaw;

    if (typeof criteriaRaw === 'string') {
      const match = criteriaRaw.match(/^([<>=!]+)(.*)$/);
      if (match) {
        op = match[1] === '!=' ? '<>' : match[1];
        const valStr = match[2].trim();
        const num = Number(valStr);
        target = !isNaN(num) && valStr !== '' ? num : valStr;
      }
    }

    for (const cellId of cells) {
      const cellVal = this.cleanValue(this.getCellValue(cellId));
      if (this.evalComparison(op, cellVal, target)) {
        count++;
      }
    }

    return count;
  }

  fnVLookup(args) {
    if (!args || args.length < 3 || args.length > 4) {
      return '#ERROR!';
    }

    const lookupVal = this.evalNode(args[0]);
    if (this.isError(lookupVal)) return lookupVal;

    const tableArg = args[1];
    if (tableArg.type !== 'Range') return '#VALUE!';

    const colIndexVal = this.evalNode(args[2]);
    if (this.isError(colIndexVal)) return colIndexVal;
    const colIndex = Number(colIndexVal);
    if (isNaN(colIndex) || colIndex < 1) return '#VALUE!';

    const isApprox = args.length === 4 ? Boolean(this.evalNode(args[3])) : true;

    const { startRow, startCol, endRow, endCol } = tableArg;
    const tableWidth = endCol - startCol + 1;
    if (colIndex > tableWidth) return '#REF!';

    const targetCol = startCol + colIndex - 1;

    let matchedRow = -1;

    if (!isApprox) {
      for (let r = startRow; r <= endRow; r++) {
        const keyCellId = coordsToCellId(r, startCol);
        const keyVal = this.cleanValue(this.getCellValue(keyCellId));
        if (this.evalComparison('=', keyVal, lookupVal)) {
          matchedRow = r;
          break;
        }
      }
    } else {
      let bestRow = -1;
      for (let r = startRow; r <= endRow; r++) {
        const keyCellId = coordsToCellId(r, startCol);
        const keyVal = this.cleanValue(this.getCellValue(keyCellId));
        if (this.evalComparison('=', keyVal, lookupVal)) {
          bestRow = r;
          break;
        } else if (this.evalComparison('<', keyVal, lookupVal)) {
          bestRow = r;
        } else {
          break;
        }
      }
      matchedRow = bestRow;
    }

    if (matchedRow === -1) {
      return '#N/A';
    }

    const resultCellId = coordsToCellId(matchedRow, targetCol);
    return this.cleanValue(this.getCellValue(resultCellId));
  }
}
