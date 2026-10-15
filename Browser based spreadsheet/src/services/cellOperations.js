import { coordsToCellId, shiftFormulaReferences } from '../core/coords.js';
import { store } from '../store/index.js';
import { recordAction, popUndo, popRedo } from '../store/historySlice.js';
import { workerSetCell, workerBatchSetCells } from './workerClient.js';
import { setStatusMessage } from '../store/uiSlice.js';

export async function copyRangeToClipboard(cells, selectedRange) {
  const { startRow, startCol, endRow, endCol } = selectedRange;
  const rows = [];

  for (let r = startRow; r <= endRow; r++) {
    const rowValues = [];
    for (let c = startCol; c <= endCol; c++) {
      const cellId = coordsToCellId(r, c);
      const cell = cells[cellId];
      const text = cell ? (cell.raw !== undefined ? cell.raw : cell.value) : '';
      rowValues.push(text !== null && text !== undefined ? String(text) : '');
    }
    rows.push(rowValues.join('\t'));
  }

  const tsv = rows.join('\r\n');
  try {
    await navigator.clipboard.writeText(tsv);
    store.dispatch(
      setStatusMessage(
        `Copied ${endRow - startRow + 1} x ${endCol - startCol + 1} cells to clipboard`
      )
    );
  } catch (err) {
  }
  return tsv;
}

export async function pasteClipboardToGrid(clipboardText, targetRow, targetCol, currentCells) {
  if (!clipboardText) return;

  const lines = clipboardText.split(/\r\n|\n|\r/);
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  if (lines.length === 0) return;

  const edits = [];
  const before = {};
  const after = {};

  for (let r = 0; r < lines.length; r++) {
    const cols = lines[r].split('\t');
    const destRow = targetRow + r;
    if (destRow >= 1000000) break;

    for (let c = 0; c < cols.length; c++) {
      const destCol = targetCol + c;
      if (destCol >= 100) break;

      const cellId = coordsToCellId(destRow, destCol);
      let rawVal = cols[c];

      if (rawVal.startsWith('=')) {
        rawVal = shiftFormulaReferences(rawVal, r, c);
      }

      const prevCell = currentCells[cellId];
      before[cellId] = prevCell ? { ...prevCell } : { raw: '', value: '' };
      after[cellId] = { raw: rawVal, value: rawVal };

      edits.push({ cellId, raw: rawVal });
    }
  }

  if (edits.length === 0) return;

  store.dispatch(
    recordAction({
      description: `Paste ${edits.length} cells`,
      before,
      after,
    })
  );

  await workerBatchSetCells(edits);
  store.dispatch(setStatusMessage(`Pasted ${edits.length} cells`));
}

export async function executeFillHandle(sourceRange, targetRange, currentCells) {
  const { startRow: sR1, startCol: sC1, endRow: sR2, endCol: sC2 } = sourceRange;
  const { startRow: tR1, startCol: tC1, endRow: tR2, endCol: tC2 } = targetRange;

  const srcHeight = sR2 - sR1 + 1;
  const srcWidth = sC2 - sC1 + 1;

  const edits = [];
  const before = {};
  const after = {};

  for (let r = tR1; r <= tR2; r++) {
    for (let c = tC1; c <= tC2; c++) {
      if (r >= sR1 && r <= sR2 && c >= sC1 && c <= sC2) {
        continue;
      }

      const rowOffset = r - sR1;
      const colOffset = c - sC1;

      const srcR = sR1 + ((((rowOffset % srcHeight) + srcHeight) % srcHeight));
      const srcC = sC1 + ((((colOffset % srcWidth) + srcWidth) % srcWidth));

      const srcCellId = coordsToCellId(srcR, srcC);
      const srcCell = currentCells[srcCellId];
      const destCellId = coordsToCellId(r, c);

      let newRaw = '';
      if (srcCell && srcCell.raw !== undefined) {
        const raw = String(srcCell.raw);
        if (raw.startsWith('=')) {
          const deltaRow = r - srcR;
          const deltaCol = c - srcC;
          newRaw = shiftFormulaReferences(raw, deltaRow, deltaCol);
        } else {
          const num = Number(raw);
          if (!isNaN(num) && raw.trim() !== '') {
            const step = rowOffset >= srcHeight ? Math.floor(rowOffset / srcHeight) : Math.floor(colOffset / srcWidth);
            newRaw = String(num + step);
          } else {
            newRaw = raw;
          }
        }
      }

      const prevCell = currentCells[destCellId];
      before[destCellId] = prevCell ? { ...prevCell } : { raw: '', value: '' };
      after[destCellId] = { raw: newRaw, value: newRaw };

      edits.push({ cellId: destCellId, raw: newRaw });
    }
  }

  if (edits.length === 0) return;

  store.dispatch(
    recordAction({
      description: `Fill ${edits.length} cells`,
      before,
      after,
    })
  );

  await workerBatchSetCells(edits);
  store.dispatch(setStatusMessage(`Filled ${edits.length} cells`));
}

export async function applyCellEdit(cellId, newRaw, currentCells) {
  const prev = currentCells[cellId];
  const oldRaw = prev ? (prev.raw !== undefined ? prev.raw : '') : '';
  if (oldRaw === newRaw) return;

  const before = { [cellId]: prev ? { ...prev } : { raw: '', value: '' } };
  const after = { [cellId]: { raw: newRaw, value: newRaw } };

  store.dispatch(
    recordAction({
      description: `Edit ${cellId}`,
      before,
      after,
    })
  );

  await workerSetCell(cellId, newRaw);
}

export async function performUndo(historyState) {
  const { past } = historyState;
  if (past.length === 0) return;

  const lastAction = past[past.length - 1];
  store.dispatch(popUndo());

  const edits = [];
  for (const [cellId, cellData] of Object.entries(lastAction.before)) {
    edits.push({ cellId, raw: cellData.raw || '' });
  }

  await workerBatchSetCells(edits);
  store.dispatch(setStatusMessage(`Undo: ${lastAction.description}`));
}

export async function performRedo(historyState) {
  const { future } = historyState;
  if (future.length === 0) return;

  const nextAction = future[future.length - 1];
  store.dispatch(popRedo());

  const edits = [];
  for (const [cellId, cellData] of Object.entries(nextAction.after)) {
    edits.push({ cellId, raw: cellData.raw || '' });
  }

  await workerBatchSetCells(edits);
  store.dispatch(setStatusMessage(`Redo: ${nextAction.description}`));
}
