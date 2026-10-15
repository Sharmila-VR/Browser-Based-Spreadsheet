import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  past: [],
  future: [],
  maxDepth: 100,
};

export const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    recordAction: (state, action) => {
      const { description = 'Edit', before, after } = action.payload;
      state.past.push({ description, before, after });
      if (state.past.length > state.maxDepth) {
        state.past.shift();
      }
      state.future = [];
    },
    popUndo: (state) => {
      if (state.past.length === 0) return;
      const last = state.past.pop();
      state.future.push(last);
    },
    popRedo: (state) => {
      if (state.future.length === 0) return;
      const next = state.future.pop();
      state.past.push(next);
    },
    clearHistory: (state) => {
      state.past = [];
      state.future = [];
    },
  },
});

export const { recordAction, popUndo, popRedo, clearHistory } = historySlice.actions;
export default historySlice.reducer;
