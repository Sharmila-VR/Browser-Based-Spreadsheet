import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Box, Typography, Stack, Divider } from '@mui/material';
import { coordsToCellId } from '../core/coords.js';

export default function StatusBar() {
  const theme = useSelector((state) => state.ui.theme);
  const statusMessage = useSelector((state) => state.ui.statusMessage);
  const rowCount = useSelector((state) => state.ui.rowCount);
  const colCount = useSelector((state) => state.ui.colCount);
  const cells = useSelector((state) => state.grid.cells);
  const selectedRange = useSelector((state) => state.selection.selectedRange);

  const stats = useMemo(() => {
    const { startRow, startCol, endRow, endCol } = selectedRange;
    const totalCells = (endRow - startRow + 1) * (endCol - startCol + 1);

    if (totalCells === 1) {
      const cellId = coordsToCellId(startRow, startCol);
      const cell = cells[cellId];
      if (!cell || (cell.value === '' && cell.raw === '')) {
        return null;
      }
    }

    let sum = 0;
    let numCount = 0;
    let filledCount = 0;
    let min = Infinity;
    let max = -Infinity;

    const maxEval = 50000;
    let evaluated = 0;

    for (let r = startRow; r <= endRow && evaluated < maxEval; r++) {
      for (let c = startCol; c <= endCol && evaluated < maxEval; c++) {
        evaluated++;
        const cellId = coordsToCellId(r, c);
        const cell = cells[cellId];
        if (cell && (cell.value !== '' || cell.raw !== '')) {
          filledCount++;
          const val = cell.value !== undefined ? cell.value : cell.raw;
          const num = Number(val);
          if (!isNaN(num) && typeof val !== 'boolean') {
            sum += num;
            numCount++;
            if (num < min) min = num;
            if (num > max) max = num;
          }
        }
      }
    }

    if (numCount === 0 && filledCount === 0) return null;

    return {
      count: filledCount,
      numCount,
      sum: numCount > 0 ? sum : null,
      avg: numCount > 0 ? sum / numCount : null,
      min: numCount > 0 ? min : null,
      max: numCount > 0 ? max : null,
    };
  }, [selectedRange, cells]);

  const isDark = theme === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        height: 32,
        backgroundColor: isDark ? '#1e293b' : '#f8fafc',
        borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        color: isDark ? '#94a3b8' : '#64748b',
        userSelect: 'none',
        fontSize: 12,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            px: 1.5,
            py: 0.3,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderRadius: '4px 4px 0 0',
            fontWeight: 600,
            fontSize: 12,
            color: '#10b981',
            borderBottom: '2px solid #10b981',
            cursor: 'pointer',
          }}
        >
          Sheet1
        </Box>

        <Divider orientation="vertical" flexItem sx={{ my: 0.8, borderColor: isDark ? '#334155' : '#cbd5e1' }} />

        <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}>
          {statusMessage}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {stats && (
          <Stack direction="row" spacing={1.5} alignItems="center">
            {stats.avg !== null && (
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500 }}>
                Average: <strong>{stats.avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              </Typography>
            )}
            <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500 }}>
              Count: <strong>{stats.count}</strong>
            </Typography>
            {stats.min !== null && (
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500 }}>
                Min: <strong>{stats.min.toLocaleString()}</strong>
              </Typography>
            )}
            {stats.max !== null && (
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 500 }}>
                Max: <strong>{stats.max.toLocaleString()}</strong>
              </Typography>
            )}
            {stats.sum !== null && (
              <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 600, color: '#10b981' }}>
                Sum: <strong>{stats.sum.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
              </Typography>
            )}
          </Stack>
        )}

        <Divider orientation="vertical" flexItem sx={{ my: 0.8, borderColor: isDark ? '#334155' : '#cbd5e1' }} />

        <Typography variant="caption" sx={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: 11 }}>
          {rowCount.toLocaleString()} rows × {colCount} cols
        </Typography>
      </Box>
    </Box>
  );
}
