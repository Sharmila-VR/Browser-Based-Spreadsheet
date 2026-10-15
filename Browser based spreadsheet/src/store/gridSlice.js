import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  cells: {},
  circularCells: [],
  lastRecalcMs: 0,
  isCalculating: false,
};

export const gridSlice = createSlice({
  name: 'grid',
  initialState,
  reducers: {
    setCalculating: (state, action) => {
      state.isCalculating = action.payload;
    },
    applyWorkerUpdates: (state, action) => {
      const { updates, circularCells, elapsed } = action.payload;
      for (const [cellId, cellData] of Object.entries(updates)) {
        if (!cellData.raw && (cellData.value === '' || cellData.value === null || cellData.value === undefined)) {
          delete state.cells[cellId];
        } else {
          state.cells[cellId] = {
            raw: cellData.raw,
            value: cellData.value,
          };
        }
      }
      state.circularCells = circularCells || [];
      if (typeof elapsed === 'number') {
        state.lastRecalcMs = elapsed;
      }
      state.isCalculating = false;
    },
    optimisticSetCell: (state, action) => {
      const { cellId, raw, value } = action.payload;
      if (!raw && !value) {
        delete state.cells[cellId];
      } else {
        state.cells[cellId] = {
          raw,
          value: value !== undefined ? value : raw,
        };
      }
    },
    clearAllCells: (state) => {
      state.cells = {};
      state.circularCells = [];
      state.lastRecalcMs = 0;
    },
  },
});

export const { setCalculating, applyWorkerUpdates, optimisticSetCell, clearAllCells } = gridSlice.actions;
export default gridSlice.reducer;
