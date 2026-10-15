import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'dark',
  rowCount: 1000000,
  colCount: 100,
  defaultRowHeight: 26,
  defaultColWidth: 140,
  headerRowHeight: 28,
  headerColWidth: 54,
  statusMessage: 'Ready',
  fps: 60,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setStatusMessage: (state, action) => {
      state.statusMessage = action.payload;
    },
    setFps: (state, action) => {
      state.fps = action.payload;
    },
    setColWidth: (state, action) => {
      state.defaultColWidth = action.payload;
    },
  },
});

export const { toggleTheme, setTheme, setStatusMessage, setFps, setColWidth } = uiSlice.actions;
export default uiSlice.reducer;
