import React, { useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { ThemeProvider, createTheme, CssBaseline, Box } from '@mui/material';

import Toolbar from './components/Toolbar.jsx';
import FormulaBar from './components/FormulaBar.jsx';
import CanvasGrid from './components/CanvasGrid.jsx';
import StatusBar from './components/StatusBar.jsx';
import { initSpreadsheetWorker, workerBatchSetCells } from './services/workerClient.js';
import { setStatusMessage } from './store/uiSlice.js';

export default function App() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.ui.theme);

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: {
            main: '#10b981',
          },
          background: {
            default: themeMode === 'dark' ? '#0f172a' : '#ffffff',
            paper: themeMode === 'dark' ? '#1e293b' : '#f8fafc',
          },
          text: {
            primary: themeMode === 'dark' ? '#f8fafc' : '#0f172a',
            secondary: themeMode === 'dark' ? '#94a3b8' : '#64748b',
          },
        },
        typography: {
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 6,
              },
            },
          },
        },
      }),
    [themeMode]
  );

  useEffect(() => {
    initSpreadsheetWorker();

    const initialSeed = [
      { cellId: 'A1', raw: 'Product Line' },
      { cellId: 'B1', raw: 'Unit Price' },
      { cellId: 'C1', raw: 'Units Sold' },
      { cellId: 'D1', raw: 'Gross Revenue' },
      { cellId: 'E1', raw: 'Performance' },

      { cellId: 'A2', raw: 'Quantum Enterprise' },
      { cellId: 'B2', raw: '350' },
      { cellId: 'C2', raw: '420' },
      { cellId: 'D2', raw: '=B2 * C2' },
      { cellId: 'E2', raw: '=IF(D2>50000, "Tier 1", "Tier 2")' },

      { cellId: 'A3', raw: 'Quantum Professional' },
      { cellId: 'B3', raw: '180' },
      { cellId: 'C3', raw: '650' },
      { cellId: 'D3', raw: '=B3 * C3' },
      { cellId: 'E3', raw: '=IF(D3>50000, "Tier 1", "Tier 2")' },

      { cellId: 'A4', raw: 'Cloud Analytics Pro' },
      { cellId: 'B4', raw: '240' },
      { cellId: 'C4', raw: '310' },
      { cellId: 'D4', raw: '=B4 * C4' },
      { cellId: 'E4', raw: '=IF(D4>50000, "Tier 1", "Tier 2")' },

      { cellId: 'A5', raw: 'Data Sync Engine' },
      { cellId: 'B5', raw: '95' },
      { cellId: 'C5', raw: '880' },
      { cellId: 'D5', raw: '=B5 * C5' },
      { cellId: 'E5', raw: '=IF(D5>50000, "Tier 1", "Tier 2")' },

      { cellId: 'A6', raw: 'Security Connector' },
      { cellId: 'B6', raw: '130' },
      { cellId: 'C6', raw: '290' },
      { cellId: 'D6', raw: '=B6 * C6' },
      { cellId: 'E6', raw: '=IF(D6>50000, "Tier 1", "Tier 2")' },

      { cellId: 'A8', raw: 'Total Gross Revenue' },
      { cellId: 'D8', raw: '=SUM(D2:D6)' },

      { cellId: 'A9', raw: 'Average Line Revenue' },
      { cellId: 'D9', raw: '=AVG(D2:D6)' },

      { cellId: 'A10', raw: 'Highest Line Revenue' },
      { cellId: 'D10', raw: '=MAX(D2:D6)' },

      { cellId: 'A11', raw: 'Lowest Line Revenue' },
      { cellId: 'D11', raw: '=MIN(D2:D6)' },

      { cellId: 'A12', raw: 'Top Tier Lines Count' },
      { cellId: 'D12', raw: '=COUNTIF(E2:E6, "Tier 1")' },
    ];

    workerBatchSetCells(initialSeed).then(() => {
      dispatch(setStatusMessage('QuantumSheet initialized. 1,000,000 virtual rows active.'));
    });
  }, [dispatch]);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        <FormulaBar />
        <Box component="main" sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <CanvasGrid />
        </Box>
        <StatusBar />
      </Box>
    </ThemeProvider>
  );
}
