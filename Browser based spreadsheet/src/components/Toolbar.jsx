import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  AppBar,
  Toolbar as MuiToolbar,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Menu,
  MenuItem,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import Undo from '@mui/icons-material/Undo';
import Redo from '@mui/icons-material/Redo';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ContentPaste from '@mui/icons-material/ContentPaste';
import Functions from '@mui/icons-material/Functions';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Brightness4 from '@mui/icons-material/Brightness4';
import Brightness7 from '@mui/icons-material/Brightness7';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Error from '@mui/icons-material/Error';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import TableChart from '@mui/icons-material/TableChart';
import Delete from '@mui/icons-material/Delete';
import Warning from '@mui/icons-material/Warning';

import { toggleTheme, setStatusMessage } from '../store/uiSlice.js';
import { coordsToCellId } from '../core/coords.js';
import {
  copyRangeToClipboard,
  pasteClipboardToGrid,
  performUndo,
  performRedo,
  applyCellEdit,
} from '../services/cellOperations.js';
import { workerBatchSetCells, workerInitGrid } from '../services/workerClient.js';

export default function Toolbar() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.ui.theme);
  const isCalculating = useSelector((state) => state.grid.isCalculating);
  const lastRecalcMs = useSelector((state) => state.grid.lastRecalcMs);
  const circularCells = useSelector((state) => state.grid.circularCells);
  const cells = useSelector((state) => state.grid.cells);
  const selectedRange = useSelector((state) => state.selection.selectedRange);
  const activeCell = useSelector((state) => state.selection.activeCell);
  const history = useSelector((state) => state.history);

  const [demoMenuAnchor, setDemoMenuAnchor] = useState(null);

  const handleOpenDemoMenu = (event) => {
    setDemoMenuAnchor(event.currentTarget);
  };

  const handleCloseDemoMenu = () => {
    setDemoMenuAnchor(null);
  };

  const insertFunction = (funcName) => {
    const activeCellId = coordsToCellId(activeCell.row, activeCell.col);
    let snippet = `=${funcName}(`;
    if (funcName === 'SUM') snippet = '=SUM(D2:D6)';
    else if (funcName === 'AVG') snippet = '=AVG(D2:D6)';
    else if (funcName === 'IF') snippet = '=IF(D2>50000, "Tier 1", "Tier 2")';
    else if (funcName === 'COUNTIF') snippet = '=COUNTIF(E2:E6, "Tier 1")';
    else if (funcName === 'VLOOKUP') snippet = '=VLOOKUP("Quantum Enterprise", A2:D6, 4, FALSE)';

    applyCellEdit(activeCellId, snippet, cells);
  };

  const loadFinancialModel = async () => {
    handleCloseDemoMenu();
    dispatch(setStatusMessage('Loading Enterprise Financial Model scenario...'));
    const edits = [
      { cellId: 'A1', raw: 'Department' },
      { cellId: 'B1', raw: 'Q1 Sales' },
      { cellId: 'C1', raw: 'Q2 Sales' },
      { cellId: 'D1', raw: 'Gross Total' },
      { cellId: 'E1', raw: 'Bonus Status' },

      { cellId: 'A2', raw: 'North America Retail' },
      { cellId: 'B2', raw: '145000' },
      { cellId: 'C2', raw: '182000' },
      { cellId: 'D2', raw: '=SUM(B2:C2)' },
      { cellId: 'E2', raw: '=IF(D2>300000, "Eligible", "Pending")' },

      { cellId: 'A3', raw: 'EMEA Corporate' },
      { cellId: 'B3', raw: '228000' },
      { cellId: 'C3', raw: '261000' },
      { cellId: 'D3', raw: '=SUM(B3:C3)' },
      { cellId: 'E3', raw: '=IF(D3>300000, "Eligible", "Pending")' },

      { cellId: 'A4', raw: 'APAC Enterprise' },
      { cellId: 'B4', raw: '362000' },
      { cellId: 'C4', raw: '415000' },
      { cellId: 'D4', raw: '=SUM(B4:C4)' },
      { cellId: 'E4', raw: '=IF(D4>300000, "Eligible", "Pending")' },

      { cellId: 'A5', raw: 'LATAM Commercial' },
      { cellId: 'B5', raw: '98000' },
      { cellId: 'C5', raw: '115000' },
      { cellId: 'D5', raw: '=SUM(B5:C5)' },
      { cellId: 'E5', raw: '=IF(D5>300000, "Eligible", "Pending")' },

      { cellId: 'A7', raw: 'Consolidated Gross' },
      { cellId: 'D7', raw: '=SUM(D2:D5)' },

      { cellId: 'A8', raw: 'Quarterly Average' },
      { cellId: 'D8', raw: '=AVG(D2:D5)' },

      { cellId: 'A9', raw: 'Eligible Teams' },
      { cellId: 'D9', raw: '=COUNTIF(E2:E5, "Eligible")' },
    ];
    await workerBatchSetCells(edits);
  };

  const loadCircularReference = async () => {
    handleCloseDemoMenu();
    dispatch(setStatusMessage('Creating Circular Reference (#CIRC!)...'));
    const edits = [
      { cellId: 'A1', raw: '=B1 + 10' },
      { cellId: 'B1', raw: '=A1 * 2' },
    ];
    await workerBatchSetCells(edits);
  };

  const load50kChain = async () => {
    handleCloseDemoMenu();
    dispatch(setStatusMessage('Generating 5,000-cell dependency chain...'));
    const edits = [];
    edits.push({ cellId: 'A1', raw: '10' });
    for (let i = 2; i <= 5000; i++) {
      edits.push({ cellId: `A${i}`, raw: `=A${i - 1} + 5` });
    }
    await workerBatchSetCells(edits);
  };

  const handleClearSheet = async () => {
    handleCloseDemoMenu();
    await workerInitGrid({});
    dispatch(setStatusMessage('Grid cleared.'));
  };

  const isDark = theme === 'dark';

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderBottom: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        color: isDark ? '#f8fafc' : '#0f172a',
      }}
    >
      <MuiToolbar
        variant="dense"
        sx={{
          minHeight: 48,
          px: 2,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1.5 }}>
            <TableChart sx={{ color: '#10b981', fontSize: 24 }} />
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                letterSpacing: -0.2,
                fontSize: 15,
                color: isDark ? '#ffffff' : '#0f172a',
              }}
            >
              QuantumSheet
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ my: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }} />

          <Tooltip title="Undo (Ctrl+Z)">
            <span>
              <IconButton
                size="small"
                onClick={() => performUndo(history)}
                disabled={history.past.length === 0}
                sx={{ color: isDark ? '#cbd5e1' : '#475569' }}
              >
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl+Y)">
            <span>
              <IconButton
                size="small"
                onClick={() => performRedo(history)}
                disabled={history.future.length === 0}
                sx={{ color: isDark ? '#cbd5e1' : '#475569' }}
              >
                <Redo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ my: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }} />

          <Tooltip title="Copy (Ctrl+C)">
            <Button
              size="small"
              startIcon={<ContentCopy fontSize="small" />}
              onClick={() => copyRangeToClipboard(cells, selectedRange)}
              sx={{
                textTransform: 'none',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Copy
            </Button>
          </Tooltip>
          <Tooltip title="Paste from Excel or TSV (Ctrl+V)">
            <Button
              size="small"
              startIcon={<ContentPaste fontSize="small" />}
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  pasteClipboardToGrid(text, activeCell.row, activeCell.col, cells);
                } catch (err) {
                }
              }}
              sx={{
                textTransform: 'none',
                color: isDark ? '#cbd5e1' : '#475569',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Paste
            </Button>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ my: 1, borderColor: isDark ? '#334155' : '#e2e8f0' }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {['SUM', 'AVG', 'IF', 'VLOOKUP', 'COUNTIF'].map((fn) => (
              <Button
                key={fn}
                size="small"
                variant="outlined"
                onClick={() => insertFunction(fn)}
                sx={{
                  py: 0.2,
                  px: 0.8,
                  minWidth: 0,
                  fontSize: 11,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.4)',
                  color: isDark ? '#34d399' : '#059669',
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)',
                  '&:hover': {
                    borderColor: '#10b981',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                  },
                }}
              >
                {fn}
              </Button>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            size="small"
            icon={
              isCalculating ? (
                <HourglassEmpty fontSize="small" sx={{ color: '#f59e0b !important' }} />
              ) : circularCells.length > 0 ? (
                <Error fontSize="small" sx={{ color: '#ef4444 !important' }} />
              ) : (
                <CheckCircle fontSize="small" sx={{ color: '#10b981 !important' }} />
              )
            }
            label={
              isCalculating
                ? 'Computing...'
                : circularCells.length > 0
                ? `${circularCells.length} Cycle (#CIRC!)`
                : `Worker Ready (${lastRecalcMs.toFixed(1)}ms)`
            }
            variant="outlined"
            sx={{
              fontSize: 11,
              fontWeight: 500,
              height: 24,
              borderColor: isDark ? '#334155' : '#e2e8f0',
              color: isDark ? '#94a3b8' : '#64748b',
              backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            }}
          />

          <Button
            size="small"
            variant="contained"
            color="primary"
            startIcon={<PlayArrow fontSize="small" />}
            onClick={handleOpenDemoMenu}
            sx={{
              textTransform: 'none',
              fontSize: 12,
              fontWeight: 600,
              py: 0.4,
              px: 1.5,
              borderRadius: 1.5,
              boxShadow: 'none',
              backgroundColor: '#10b981',
              '&:hover': {
                backgroundColor: '#059669',
                boxShadow: 'none',
              },
            }}
          >
            Scenarios
          </Button>

          <Menu
            anchorEl={demoMenuAnchor}
            open={Boolean(demoMenuAnchor)}
            onClose={handleCloseDemoMenu}
            PaperProps={{
              sx: {
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                color: isDark ? '#f8fafc' : '#0f172a',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
                minWidth: 220,
              },
            }}
          >
            <MenuItem onClick={loadFinancialModel} sx={{ fontSize: 13, py: 1 }}>
              <TableChart fontSize="small" sx={{ mr: 1, color: '#10b981' }} />
              Enterprise Financial Model
            </MenuItem>
            <MenuItem onClick={loadCircularReference} sx={{ fontSize: 13, py: 1 }}>
              <Warning fontSize="small" sx={{ mr: 1, color: '#ef4444' }} />
              Circular Reference (#CIRC!)
            </MenuItem>
            <MenuItem onClick={load50kChain} sx={{ fontSize: 13, py: 1 }}>
              <Functions fontSize="small" sx={{ mr: 1, color: '#3b82f6' }} />
              5,000-Chain Recalc Benchmark
            </MenuItem>
            <Divider sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />
            <MenuItem onClick={handleClearSheet} sx={{ fontSize: 13, py: 1, color: '#ef4444' }}>
              <Delete fontSize="small" sx={{ mr: 1, color: '#ef4444' }} />
              Clear Grid
            </MenuItem>
          </Menu>

          <Tooltip title={`Switch to ${isDark ? 'Light' : 'Dark'} theme`}>
            <IconButton
              size="small"
              onClick={() => dispatch(toggleTheme())}
              sx={{ color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              {isDark ? <Brightness7 fontSize="small" /> : <Brightness4 fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </MuiToolbar>
    </AppBar>
  );
}
