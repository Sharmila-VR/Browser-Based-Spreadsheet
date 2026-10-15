import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeCell: { row: 0, col: 0 },
  selectedRange: { startRow: 0, startCol: 0, endRow: 0, endCol: 0 },
  isSelecting: false,
  isFillDragging: false,
  fillTargetRange: null,
  isEditing: false,
  editValue: '',
  initialEditValue: '',
};

export const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    setActiveCell: (state, action) => {
      const { row, col, extendSelection = false } = action.payload;
      const validRow = Math.max(0, Math.min(999999, row));
      const validCol = Math.max(0, Math.min(99, col));

      if (extendSelection) {
        state.selectedRange = {
          startRow: Math.min(state.activeCell.row, validRow),
          startCol: Math.min(state.activeCell.col, validCol),
          endRow: Math.max(state.activeCell.row, validRow),
          endCol: Math.max(state.activeCell.col, validCol),
        };
      } else {
        state.activeCell = { row: validRow, col: validCol };
        state.selectedRange = {
          startRow: validRow,
          startCol: validCol,
          endRow: validRow,
          endCol: validCol,
        };
      }
      state.isEditing = false;
    },
    setSelectionRange: (state, action) => {
      const { startRow, startCol, endRow, endCol } = action.payload;
      state.selectedRange = {
        startRow: Math.max(0, Math.min(startRow, endRow)),
        startCol: Math.max(0, Math.min(startCol, endCol)),
        endRow: Math.min(999999, Math.max(startRow, endRow)),
        endCol: Math.min(99, Math.max(startCol, endCol)),
      };
    },
    setIsSelecting: (state, action) => {
      state.isSelecting = action.payload;
    },
    startFillDrag: (state) => {
      state.isFillDragging = true;
      state.fillTargetRange = { ...state.selectedRange };
    },
    updateFillTargetRange: (state, action) => {
      state.fillTargetRange = action.payload;
    },
    endFillDrag: (state) => {
      state.isFillDragging = false;
      state.fillTargetRange = null;
    },
    startEditing: (state, action) => {
      state.isEditing = true;
      const val = action.payload !== undefined ? action.payload : '';
      state.editValue = val;
      state.initialEditValue = val;
    },
    setEditValue: (state, action) => {
      state.editValue = action.payload;
    },
    stopEditing: (state) => {
      state.isEditing = false;
    },
  },
});

export const {
  setActiveCell,
  setSelectionRange,
  setIsSelecting,
  startFillDrag,
  updateFillTargetRange,
  endFillDrag,
  startEditing,
  setEditValue,
  stopEditing,
} = selectionSlice.actions;

export default selectionSlice.reducer;
