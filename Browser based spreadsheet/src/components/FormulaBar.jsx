import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Box, InputBase, IconButton, Tooltip, Typography, Divider } from '@mui/material';
import Check from '@mui/icons-material/Check';
import Close from '@mui/icons-material/Close';

import { coordsToCellId, parseCellRef } from '../core/coords.js';
import { setActiveCell } from '../store/selectionSlice.js';
import { applyCellEdit } from '../services/cellOperations.js';

export default function FormulaBar() {
  const dispatch = useDispatch();
  const theme = useSelector((state) => state.ui.theme);
  const activeCell = useSelector((state) => state.selection.activeCell);
  const cells = useSelector((state) => state.grid.cells);

  const activeCellId = coordsToCellId(activeCell.row, activeCell.col);
  const currentCellData = cells[activeCellId];
  const currentRaw = currentCellData ? (currentCellData.raw !== undefined ? currentCellData.raw : currentCellData.value) : '';

  const [nameBoxInput, setNameBoxInput] = useState(activeCellId);
  const [formulaInput, setFormulaInput] = useState(currentRaw !== null && currentRaw !== undefined ? String(currentRaw) : '');

  useEffect(() => {
    setNameBoxInput(activeCellId);
    setFormulaInput(currentRaw !== null && currentRaw !== undefined ? String(currentRaw) : '');
  }, [activeCellId, currentRaw]);

  const handleNameBoxSubmit = (e) => {
    if (e.key === 'Enter') {
      const parsed = parseCellRef(nameBoxInput);
      if (parsed) {
        dispatch(setActiveCell({ row: parsed.row, col: parsed.col }));
      } else {
        setNameBoxInput(activeCellId);
      }
    }
  };

  const commitFormula = async () => {
    await applyCellEdit(activeCellId, formulaInput, cells);
  };

  const cancelFormula = () => {
    setFormulaInput(currentRaw !== null && currentRaw !== undefined ? String(currentRaw) : '');
  };

  const handleFormulaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitFormula();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelFormula();
    }
  };

  const isDark = theme === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 0.5,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
        gap: 1,
        minHeight: 36,
      }}
    >
      <InputBase
        value={nameBoxInput}
        onChange={(e) => setNameBoxInput(e.target.value.toUpperCase())}
        onKeyDown={handleNameBoxSubmit}
        onBlur={() => setNameBoxInput(activeCellId)}
        title="Active cell address (Type coordinates e.g. A50000 and press Enter to jump)"
        inputProps={{ 'aria-label': 'Active cell address' }}
        sx={{
          width: 84,
          height: 28,
          px: 1,
          textAlign: 'center',
          fontWeight: 600,
          fontSize: 12,
          fontFamily: '"JetBrains Mono", monospace',
          borderRadius: 1,
          border: `1px solid ${isDark ? '#334155' : '#cbd5e1'}`,
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          color: isDark ? '#f8fafc' : '#0f172a',
          '& input': {
            textAlign: 'center',
            p: 0,
          },
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Tooltip title="Cancel (Escape)">
          <span>
            <IconButton
              size="small"
              onClick={cancelFormula}
              sx={{ color: '#ef4444', p: 0.4 }}
              aria-label="Cancel formula edit"
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Confirm (Enter)">
          <span>
            <IconButton
              size="small"
              onClick={commitFormula}
              sx={{ color: '#10b981', p: 0.4 }}
              aria-label="Confirm formula edit"
            >
              <Check sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Typography
        component="span"
        sx={{
          fontSize: 14,
          fontWeight: 700,
          fontStyle: 'italic',
          fontFamily: 'serif',
          color: '#10b981',
          userSelect: 'none',
          px: 0.5,
        }}
      >
        fx
      </Typography>

      <Divider orientation="vertical" flexItem sx={{ my: 0.5, borderColor: isDark ? '#334155' : '#e2e8f0' }} />

      <InputBase
        fullWidth
        value={formulaInput}
        onChange={(e) => setFormulaInput(e.target.value)}
        onKeyDown={handleFormulaKeyDown}
        placeholder="Enter value or formula (e.g. =SUM(A1:B10))"
        inputProps={{ 'aria-label': 'Formula input' }}
        sx={{
          fontSize: 13,
          fontFamily: '"JetBrains Mono", monospace',
          color: isDark ? '#f8fafc' : '#0f172a',
          px: 1,
          '& input': {
            p: 0,
          },
        }}
      />
    </Box>
  );
}
