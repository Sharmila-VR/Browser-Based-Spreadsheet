import { configureStore } from '@reduxjs/toolkit';
import gridReducer from './gridSlice.js';
import selectionReducer from './selectionSlice.js';
import historyReducer from './historySlice.js';
import uiReducer from './uiSlice.js';

export const store = configureStore({
  reducer: {
    grid: gridReducer,
    selection: selectionReducer,
    history: historyReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});
