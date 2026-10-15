import { store } from '../store/index.js';
import { applyWorkerUpdates, setCalculating } from '../store/gridSlice.js';
import { setStatusMessage } from '../store/uiSlice.js';

let worker = null;
let reqCounter = 0;
const pendingRequests = new Map();

export function initSpreadsheetWorker() {
  if (worker) return worker;

  try {
    worker = new Worker(new URL('../workers/spreadsheetWorker.js', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event) => {
      const { type, reqId, updates, circularCells, elapsed } = event.data;

      if (type === 'RECALC_SUCCESS' || type === 'INIT_SUCCESS') {
        store.dispatch(applyWorkerUpdates({ updates, circularCells, elapsed }));
        store.dispatch(
          setStatusMessage(
            `Recalculated in ${elapsed ? elapsed.toFixed(1) : 0}ms${circularCells && circularCells.length > 0 ? ` (${circularCells.length} circular refs)` : ''
            }`
          )
        );

        if (pendingRequests.has(reqId)) {
          const resolve = pendingRequests.get(reqId);
          pendingRequests.delete(reqId);
          resolve({ updates, circularCells, elapsed });
        }
      }
    };

    worker.onerror = (err) => {
      store.dispatch(setCalculating(false));
      store.dispatch(setStatusMessage('Worker calculation error'));
    };
  } catch (err) {
  }

  return worker;
}

export function postWorkerMessage(type, payload) {
  if (!worker) initSpreadsheetWorker();

  const reqId = ++reqCounter;
  store.dispatch(setCalculating(true));

  return new Promise((resolve) => {
    pendingRequests.set(reqId, resolve);
    worker.postMessage({ type, payload, reqId });
  });
}

export function workerSetCell(cellId, raw) {
  return postWorkerMessage('SET_CELL', { cellId, raw });
}

export function workerBatchSetCells(edits) {
  return postWorkerMessage('BATCH_SET_CELLS', { edits });
}

export function workerInitGrid(cells) {
  return postWorkerMessage('INIT_GRID', { cells });
}
