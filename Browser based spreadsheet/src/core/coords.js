export function colIndexToName(colIndex) {
  let name = '';
  let temp = colIndex;
  while (temp >= 0) {
    name = String.fromCharCode((temp % 26) + 65) + name;
    temp = Math.floor(temp / 26) - 1;
  }
  return name;
}

export function colNameToIndex(colName) {
  let index = 0;
  const upper = colName.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    index = index * 26 + (upper.charCodeAt(i) - 64);
  }
  return index - 1;
}

export function coordsToCellId(row, col) {
  return `${colIndexToName(col)}${row + 1}`;
}

const CELL_REF_REGEX = /^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/;

export function parseCellRef(ref) {
  const match = ref.trim().match(CELL_REF_REGEX);
  if (!match) return null;
  const absCol = match[1] === '$';
  const col = colNameToIndex(match[2]);
  const absRow = match[3] === '$';
  const row = parseInt(match[4], 10) - 1;
  return {
    raw: ref.toUpperCase(),
    col,
    row,
    absCol,
    absRow,
  };
}

const RANGE_REGEX = /^(\$?)([A-Za-z]+)(\$?)([0-9]+):(\$?)([A-Za-z]+)(\$?)([0-9]+)$/;

export function parseRange(rangeStr) {
  const match = rangeStr.trim().match(RANGE_REGEX);
  if (!match) return null;

  const startAbsCol = match[1] === '$';
  const col1 = colNameToIndex(match[2]);
  const startAbsRow = match[3] === '$';
  const row1 = parseInt(match[4], 10) - 1;

  const endAbsCol = match[5] === '$';
  const col2 = colNameToIndex(match[6]);
  const endAbsRow = match[7] === '$';
  const row2 = parseInt(match[8], 10) - 1;

  return {
    startRow: Math.min(row1, row2),
    startCol: Math.min(col1, col2),
    endRow: Math.max(row1, row2),
    endCol: Math.max(col1, col2),
    startAbsCol,
    startAbsRow,
    endAbsCol,
    endAbsRow,
  };
}

export function expandRange(rangeStr, maxCells = 100000) {
  const parsed = parseRange(rangeStr);
  if (!parsed) return [];
  const { startRow, startCol, endRow, endCol } = parsed;
  const count = (endRow - startRow + 1) * (endCol - startCol + 1);
  if (count > maxCells) {
    throw new Error(`Range ${rangeStr} contains ${count} cells, which exceeds max limit of ${maxCells}`);
  }

  const cells = [];
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      cells.push(coordsToCellId(r, c));
    }
  }
  return cells;
}

export function shiftFormulaReferences(formula, deltaRow, deltaCol) {
  if (!formula.startsWith('=')) return formula;

  return formula.replace(/(\$?[A-Za-z]+)(\$?[0-9]+)/g, (match, colPart, rowPart, offset, fullStr) => {
    if (offset > 0 && /[A-Za-z0-9_]/.test(fullStr[offset - 1])) {
      return match;
    }
    const after = fullStr.slice(offset + match.length).trim();
    if (after.startsWith('(')) {
      return match;
    }

    const absCol = colPart.startsWith('$');
    const cleanColName = absCol ? colPart.slice(1) : colPart;
    const absRow = rowPart.startsWith('$');
    const cleanRowNum = parseInt(absRow ? rowPart.slice(1) : rowPart, 10);

    let newColIndex = colNameToIndex(cleanColName);
    if (!absCol) {
      newColIndex += deltaCol;
    }
    if (newColIndex < 0) return '#REF!';

    let newRow = cleanRowNum;
    if (!absRow) {
      newRow += deltaRow;
    }
    if (newRow < 1) return '#REF!';

    const finalCol = absCol ? `$${cleanColName}` : colIndexToName(newColIndex);
    const finalRow = absRow ? `$${cleanRowNum}` : `${newRow}`;
    return `${finalCol}${finalRow}`;
  });
}
