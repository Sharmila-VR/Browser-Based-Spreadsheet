import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { coordsToCellId, colIndexToName } from '../core/coords.js';
import {
  setActiveCell,
  setSelectionRange,
  setIsSelecting,
  startFillDrag,
  updateFillTargetRange,
  endFillDrag,
  startEditing,
  setEditValue,
  stopEditing,
} from '../store/selectionSlice.js';
import {
  copyRangeToClipboard,
  pasteClipboardToGrid,
  executeFillHandle,
  applyCellEdit,
  performUndo,
  performRedo,
} from '../services/cellOperations.js';

export default function CanvasGrid() {
  const dispatch = useDispatch();

  const cells = useSelector((state) => state.grid.cells);
  const circularCells = useSelector((state) => state.grid.circularCells);
  const { activeCell, selectedRange, isFillDragging, fillTargetRange, isEditing, editValue } =
    useSelector((state) => state.selection);
  const history = useSelector((state) => state.history);
  const { theme, rowCount, colCount, defaultRowHeight, defaultColWidth, headerRowHeight, headerColWidth } =
    useSelector((state) => state.ui);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const vScrollRef = useRef(null);
  const hScrollRef = useRef(null);
  const editorInputRef = useRef(null);

  const [scrollPos, setScrollPos] = useState({ scrollTop: 0, scrollLeft: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 700 });
  const [mouseDragOrigin, setMouseDragOrigin] = useState(null);
  const [fillDragOrigin, setFillDragOrigin] = useState(null);

  const circularSet = useRef(new Set());
  useEffect(() => {
    circularSet.current = new Set(circularCells || []);
  }, [circularCells]);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const totalVirtualWidth = headerColWidth + colCount * defaultColWidth;
  const totalVirtualHeight = headerRowHeight + rowCount * defaultRowHeight;

  const maxScrollTop = Math.max(0, totalVirtualHeight - viewportSize.height);
  const maxScrollLeft = Math.max(0, totalVirtualWidth - viewportSize.width);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewportSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      setScrollPos((prev) => {
        const newTop = Math.max(0, Math.min(maxScrollTop, prev.scrollTop + e.deltaY));
        const newLeft = Math.max(0, Math.min(maxScrollLeft, prev.scrollLeft + e.deltaX));

        if (vScrollRef.current) {
          vScrollRef.current.scrollTop = newTop;
        }
        if (hScrollRef.current) {
          hScrollRef.current.scrollLeft = newLeft;
        }

        return { scrollTop: newTop, scrollLeft: newLeft };
      });
    },
    [maxScrollTop, maxScrollLeft]
  );

  const handleVScroll = useCallback((e) => {
    const newTop = e.target.scrollTop;
    setScrollPos((prev) => ({ ...prev, scrollTop: newTop }));
  }, []);

  const handleHScroll = useCallback((e) => {
    const newLeft = e.target.scrollLeft;
    setScrollPos((prev) => ({ ...prev, scrollLeft: newLeft }));
  }, []);

  const getCellCoordsFromPoint = useCallback(
    (clientX, clientY) => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = clientX - rect.left - headerColWidth + scrollPos.scrollLeft;
      const y = clientY - rect.top - headerRowHeight + scrollPos.scrollTop;

      if (x < 0 || y < 0) return null;

      const col = Math.floor(x / defaultColWidth);
      const row = Math.floor(y / defaultRowHeight);

      if (col >= colCount || row >= rowCount) return null;
      return { row, col };
    },
    [scrollPos, defaultColWidth, defaultRowHeight, headerColWidth, headerRowHeight, colCount, rowCount]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    const dpr = window.devicePixelRatio || 1;

    const width = viewportSize.width;
    const height = viewportSize.height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0f172a' : '#ffffff';
    const gridLineColor = isDark ? '#1e293b' : '#e2e8f0';
    const headerBgColor = isDark ? '#1e293b' : '#f8fafc';
    const headerTextColor = isDark ? '#94a3b8' : '#64748b';
    const headerHighlightBg = isDark ? '#334155' : '#e2e8f0';
    const cellTextColor = isDark ? '#f8fafc' : '#0f172a';
    const selectionBorderColor = '#10b981';
    const selectionBgColor = 'rgba(16, 185, 129, 0.12)';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const startRow = Math.max(0, Math.floor(scrollPos.scrollTop / defaultRowHeight));
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollPos.scrollTop + height) / defaultRowHeight) + 1
    );

    const startCol = Math.max(0, Math.floor(scrollPos.scrollLeft / defaultColWidth));
    const endCol = Math.min(
      colCount - 1,
      Math.ceil((scrollPos.scrollLeft + width) / defaultColWidth) + 1
    );

    ctx.font = '13px "Inter", -apple-system, sans-serif';
    ctx.textBaseline = 'middle';

    const currentCells = cellsRef.current;

    for (let c = startCol; c <= endCol; c++) {
      const cellX = headerColWidth + c * defaultColWidth - scrollPos.scrollLeft;
      if (cellX > width) break;

      ctx.strokeStyle = gridLineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cellX + defaultColWidth + 0.5, headerRowHeight);
      ctx.lineTo(cellX + defaultColWidth + 0.5, height);
      ctx.stroke();

      for (let r = startRow; r <= endRow; r++) {
        const cellY = headerRowHeight + r * defaultRowHeight - scrollPos.scrollTop;
        if (cellY > height) break;

        if (c === startCol) {
          ctx.beginPath();
          ctx.moveTo(headerColWidth, cellY + defaultRowHeight + 0.5);
          ctx.lineTo(width, cellY + defaultRowHeight + 0.5);
          ctx.stroke();
        }

        const cellId = coordsToCellId(r, c);
        const cellData = currentCells[cellId];
        const isCirc = circularSet.current.has(cellId);

        if (cellData && (cellData.value !== undefined || cellData.raw !== undefined) || isCirc) {
          const val = isCirc ? '#CIRC!' : cellData.value !== undefined ? cellData.value : cellData.raw;
          const displayStr = val === null || val === undefined ? '' : String(val);

          if (displayStr !== '') {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cellX + 2, cellY + 1, defaultColWidth - 4, defaultRowHeight - 2);
            ctx.clip();

            if (isCirc || displayStr.startsWith('#')) {
              ctx.fillStyle = isCirc ? '#ef4444' : '#f59e0b';
              ctx.font = 'bold 12px "JetBrains Mono", monospace';
              ctx.textAlign = 'left';
              ctx.fillText(displayStr, cellX + 8, cellY + defaultRowHeight / 2);
            } else if (typeof val === 'number') {
              ctx.fillStyle = cellTextColor;
              ctx.textAlign = 'right';
              ctx.fillText(displayStr, cellX + defaultColWidth - 8, cellY + defaultRowHeight / 2);
            } else if (typeof val === 'boolean') {
              ctx.fillStyle = '#8b5cf6';
              ctx.textAlign = 'center';
              ctx.fillText(displayStr, cellX + defaultColWidth / 2, cellY + defaultRowHeight / 2);
            } else {
              ctx.fillStyle = cellTextColor;
              ctx.textAlign = 'left';
              ctx.fillText(displayStr, cellX + 8, cellY + defaultRowHeight / 2);
            }
            ctx.restore();
          }
        }
      }
    }

    const selX1 = headerColWidth + selectedRange.startCol * defaultColWidth - scrollPos.scrollLeft;
    const selY1 = headerRowHeight + selectedRange.startRow * defaultRowHeight - scrollPos.scrollTop;
    const selW = (selectedRange.endCol - selectedRange.startCol + 1) * defaultColWidth;
    const selH = (selectedRange.endRow - selectedRange.startRow + 1) * defaultRowHeight;

    ctx.fillStyle = selectionBgColor;
    ctx.fillRect(selX1, selY1, selW, selH);

    ctx.strokeStyle = selectionBorderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(selX1, selY1, selW, selH);

    if (
      selectedRange.startRow !== selectedRange.endRow ||
      selectedRange.startCol !== selectedRange.endCol
    ) {
      const actX = headerColWidth + activeCell.col * defaultColWidth - scrollPos.scrollLeft;
      const actY = headerRowHeight + activeCell.row * defaultRowHeight - scrollPos.scrollTop;
      ctx.strokeStyle = selectionBorderColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(actX, actY, defaultColWidth, defaultRowHeight);
    }

    const handleSize = 6;
    const handleX = selX1 + selW - handleSize / 2;
    const handleY = selY1 + selH - handleSize / 2;

    ctx.fillStyle = selectionBorderColor;
    ctx.fillRect(handleX, handleY, handleSize, handleSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(handleX, handleY, handleSize, handleSize);

    if (isFillDragging && fillTargetRange) {
      const fX1 = headerColWidth + fillTargetRange.startCol * defaultColWidth - scrollPos.scrollLeft;
      const fY1 = headerRowHeight + fillTargetRange.startRow * defaultRowHeight - scrollPos.scrollTop;
      const fW = (fillTargetRange.endCol - fillTargetRange.startCol + 1) * defaultColWidth;
      const fH = (fillTargetRange.endRow - fillTargetRange.startRow + 1) * defaultRowHeight;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.strokeRect(fX1, fY1, fW, fH);
      ctx.restore();
    }

    ctx.fillStyle = headerBgColor;
    ctx.fillRect(0, 0, width, headerRowHeight);

    ctx.fillStyle = headerBgColor;
    ctx.fillRect(0, 0, headerColWidth, headerRowHeight);
    ctx.strokeStyle = gridLineColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, headerColWidth, headerRowHeight);

    for (let c = startCol; c <= endCol; c++) {
      const cellX = headerColWidth + c * defaultColWidth - scrollPos.scrollLeft;
      if (cellX > width) break;

      const isColSelected = c >= selectedRange.startCol && c <= selectedRange.endCol;
      ctx.fillStyle = isColSelected ? headerHighlightBg : headerBgColor;
      ctx.fillRect(cellX, 0, defaultColWidth, headerRowHeight);

      ctx.strokeStyle = gridLineColor;
      ctx.beginPath();
      ctx.moveTo(cellX + defaultColWidth + 0.5, 0);
      ctx.lineTo(cellX + defaultColWidth + 0.5, headerRowHeight);
      ctx.stroke();

      ctx.font = '600 11px "Inter", sans-serif';
      ctx.fillStyle = isColSelected ? selectionBorderColor : headerTextColor;
      ctx.textAlign = 'center';
      ctx.fillText(colIndexToName(c), cellX + defaultColWidth / 2, headerRowHeight / 2);
    }

    ctx.fillStyle = headerBgColor;
    ctx.fillRect(0, 0, headerColWidth, height);

    for (let r = startRow; r <= endRow; r++) {
      const cellY = headerRowHeight + r * defaultRowHeight - scrollPos.scrollTop;
      if (cellY > height) break;

      const isRowSelected = r >= selectedRange.startRow && r <= selectedRange.endRow;
      ctx.fillStyle = isRowSelected ? headerHighlightBg : headerBgColor;
      ctx.fillRect(0, cellY, headerColWidth, defaultRowHeight);

      ctx.strokeStyle = gridLineColor;
      ctx.beginPath();
      ctx.moveTo(0, cellY + defaultRowHeight + 0.5);
      ctx.lineTo(headerColWidth, cellY + defaultRowHeight + 0.5);
      ctx.stroke();

      ctx.font = '500 11px "Inter", sans-serif';
      ctx.fillStyle = isRowSelected ? selectionBorderColor : headerTextColor;
      ctx.textAlign = 'center';
      ctx.fillText(`${r + 1}`, headerColWidth / 2, cellY + defaultRowHeight / 2);
    }

    ctx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, headerRowHeight + 0.5);
    ctx.lineTo(width, headerRowHeight + 0.5);
    ctx.moveTo(headerColWidth + 0.5, 0);
    ctx.lineTo(headerColWidth + 0.5, height);
    ctx.stroke();
  }, [
    scrollPos,
    viewportSize,
    selectedRange,
    activeCell,
    isFillDragging,
    fillTargetRange,
    theme,
    rowCount,
    colCount,
    defaultRowHeight,
    defaultColWidth,
    headerRowHeight,
    headerColWidth,
    cells,
    circularCells,
  ]);

  const scrollCellIntoView = useCallback(
    (row, col) => {
      const cellTop = row * defaultRowHeight;
      const cellBottom = cellTop + defaultRowHeight;
      const cellLeft = col * defaultColWidth;
      const cellRight = cellLeft + defaultColWidth;

      const viewHeight = viewportSize.height - headerRowHeight - 14;
      const viewWidth = viewportSize.width - headerColWidth - 14;

      let newTop = scrollPos.scrollTop;
      let newLeft = scrollPos.scrollLeft;

      if (cellTop < scrollPos.scrollTop) {
        newTop = cellTop;
      } else if (cellBottom > scrollPos.scrollTop + viewHeight) {
        newTop = cellBottom - viewHeight;
      }

      if (cellLeft < scrollPos.scrollLeft) {
        newLeft = cellLeft;
      } else if (cellRight > scrollPos.scrollLeft + viewWidth) {
        newLeft = cellRight - viewWidth;
      }

      newTop = Math.max(0, Math.min(maxScrollTop, newTop));
      newLeft = Math.max(0, Math.min(maxScrollLeft, newLeft));

      setScrollPos({ scrollTop: newTop, scrollLeft: newLeft });
      if (vScrollRef.current) vScrollRef.current.scrollTop = newTop;
      if (hScrollRef.current) hScrollRef.current.scrollLeft = newLeft;
    },
    [defaultRowHeight, defaultColWidth, headerRowHeight, headerColWidth, viewportSize, scrollPos, maxScrollTop, maxScrollLeft]
  );

  const handleMouseDown = useCallback(
    (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const selX1 = headerColWidth + selectedRange.endCol * defaultColWidth - scrollPos.scrollLeft;
      const selY1 = headerRowHeight + selectedRange.endRow * defaultRowHeight - scrollPos.scrollTop;
      const handleX = selX1 + defaultColWidth;
      const handleY = selY1 + defaultRowHeight;

      if (Math.abs(mouseX - handleX) <= 8 && Math.abs(mouseY - handleY) <= 8) {
        setFillDragOrigin({ ...selectedRange });
        dispatch(startFillDrag());
        return;
      }

      const coords = getCellCoordsFromPoint(e.clientX, e.clientY);
      if (!coords) return;

      if (e.shiftKey) {
        dispatch(
          setSelectionRange({
            startRow: Math.min(activeCell.row, coords.row),
            startCol: Math.min(activeCell.col, coords.col),
            endRow: Math.max(activeCell.row, coords.row),
            endCol: Math.max(activeCell.col, coords.col),
          })
        );
      } else {
        dispatch(setActiveCell({ row: coords.row, col: coords.col }));
        setMouseDragOrigin(coords);
        dispatch(setIsSelecting(true));
      }
    },
    [getCellCoordsFromPoint, selectedRange, activeCell, scrollPos, defaultColWidth, defaultRowHeight, headerColWidth, headerRowHeight, dispatch]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (isFillDragging && fillDragOrigin) {
        const coords = getCellCoordsFromPoint(e.clientX, e.clientY);
        if (!coords) return;

        const target = {
          startRow: Math.min(fillDragOrigin.startRow, coords.row),
          startCol: Math.min(fillDragOrigin.startCol, coords.col),
          endRow: Math.max(fillDragOrigin.endRow, coords.row),
          endCol: Math.max(fillDragOrigin.endCol, coords.col),
        };
        dispatch(updateFillTargetRange(target));
        return;
      }

      if (mouseDragOrigin) {
        const coords = getCellCoordsFromPoint(e.clientX, e.clientY);
        if (!coords) return;

        dispatch(
          setSelectionRange({
            startRow: Math.min(mouseDragOrigin.row, coords.row),
            startCol: Math.min(mouseDragOrigin.col, coords.col),
            endRow: Math.max(mouseDragOrigin.row, coords.row),
            endCol: Math.max(mouseDragOrigin.col, coords.col),
          })
        );
      }
    },
    [isFillDragging, fillDragOrigin, mouseDragOrigin, getCellCoordsFromPoint, dispatch]
  );

  const handleMouseUp = useCallback(async () => {
    if (isFillDragging && fillTargetRange) {
      dispatch(endFillDrag());
      setFillDragOrigin(null);
      await executeFillHandle(selectedRange, fillTargetRange, cellsRef.current);
      dispatch(setSelectionRange(fillTargetRange));
      return;
    }

    if (mouseDragOrigin) {
      setMouseDragOrigin(null);
      dispatch(setIsSelecting(false));
    }
  }, [isFillDragging, fillTargetRange, selectedRange, mouseDragOrigin, dispatch]);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseUp, handleMouseMove]);

  const handleDoubleClick = useCallback(
    (e) => {
      const coords = getCellCoordsFromPoint(e.clientX, e.clientY);
      if (!coords) return;

      const cellId = coordsToCellId(coords.row, coords.col);
      const cell = cellsRef.current[cellId];
      const initialText = cell ? (cell.raw !== undefined ? cell.raw : cell.value) : '';
      dispatch(startEditing(initialText !== null && initialText !== undefined ? String(initialText) : ''));
    },
    [getCellCoordsFromPoint, dispatch]
  );

  const commitEdit = useCallback(async () => {
    if (!isEditing) return;
    const cellId = coordsToCellId(activeCell.row, activeCell.col);
    dispatch(stopEditing());
    await applyCellEdit(cellId, editValue, cellsRef.current);
  }, [isEditing, activeCell, editValue, dispatch]);

  const cancelEdit = useCallback(() => {
    dispatch(stopEditing());
  }, [dispatch]);

  const handleKeyDown = useCallback(
    async (e) => {
      if (isEditing) {
        if (e.key === 'Enter') {
          e.preventDefault();
          await commitEdit();
          const nextRow = Math.min(rowCount - 1, activeCell.row + (e.shiftKey ? -1 : 1));
          dispatch(setActiveCell({ row: Math.max(0, nextRow), col: activeCell.col }));
          scrollCellIntoView(Math.max(0, nextRow), activeCell.col);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          await commitEdit();
          const nextCol = Math.min(colCount - 1, activeCell.col + (e.shiftKey ? -1 : 1));
          dispatch(setActiveCell({ row: activeCell.row, col: Math.max(0, nextCol) }));
          scrollCellIntoView(activeCell.row, Math.max(0, nextCol));
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelEdit();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          await copyRangeToClipboard(cellsRef.current, selectedRange);
          return;
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          try {
            const clipText = await navigator.clipboard.readText();
            await pasteClipboardToGrid(clipText, activeCell.row, activeCell.col, cellsRef.current);
          } catch (err) {
          }
          return;
        } else if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault();
          if (e.shiftKey) {
            await performRedo(history);
          } else {
            await performUndo(history);
          }
          return;
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          await performRedo(history);
          return;
        }
      }

      let nextRow = activeCell.row;
      let nextCol = activeCell.col;
      let handled = false;

      if (e.key === 'ArrowUp') {
        nextRow = Math.max(0, activeCell.row - 1);
        handled = true;
      } else if (e.key === 'ArrowDown') {
        nextRow = Math.min(rowCount - 1, activeCell.row + 1);
        handled = true;
      } else if (e.key === 'ArrowLeft') {
        nextCol = Math.max(0, activeCell.col - 1);
        handled = true;
      } else if (e.key === 'ArrowRight') {
        nextCol = Math.min(colCount - 1, activeCell.col + 1);
        handled = true;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        nextCol = e.shiftKey ? Math.max(0, activeCell.col - 1) : Math.min(colCount - 1, activeCell.col + 1);
        handled = true;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        nextRow = e.shiftKey ? Math.max(0, activeCell.row - 1) : Math.min(rowCount - 1, activeCell.row + 1);
        handled = true;
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const { startRow, startCol, endRow, endCol } = selectedRange;
        for (let r = startRow; r <= endRow; r++) {
          for (let c = startCol; c <= endCol; c++) {
            const cellId = coordsToCellId(r, c);
            await applyCellEdit(cellId, '', cellsRef.current);
          }
        }
        return;
      } else if (e.key === 'F2') {
        e.preventDefault();
        const cellId = coordsToCellId(activeCell.row, activeCell.col);
        const cell = cellsRef.current[cellId];
        const val = cell ? (cell.raw !== undefined ? cell.raw : cell.value) : '';
        dispatch(startEditing(val !== null && val !== undefined ? String(val) : ''));
        return;
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        dispatch(startEditing(e.key));
        return;
      }

      if (handled) {
        e.preventDefault();
        dispatch(setActiveCell({ row: nextRow, col: nextCol, extendSelection: e.shiftKey }));
        scrollCellIntoView(nextRow, nextCol);
      }
    },
    [
      isEditing,
      activeCell,
      selectedRange,
      commitEdit,
      cancelEdit,
      rowCount,
      colCount,
      scrollCellIntoView,
      history,
      dispatch,
    ]
  );

  const editorStyle = {
    position: 'absolute',
    top: `${headerRowHeight + activeCell.row * defaultRowHeight - scrollPos.scrollTop}px`,
    left: `${headerColWidth + activeCell.col * defaultColWidth - scrollPos.scrollLeft}px`,
    width: `${defaultColWidth + 1}px`,
    height: `${defaultRowHeight + 1}px`,
    zIndex: 20,
    outline: '2px solid #10b981',
    border: 'none',
    padding: '0 8px',
    margin: 0,
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '13px',
    backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
    color: theme === 'dark' ? '#ffffff' : '#000000',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
  };

  useEffect(() => {
    if (isEditing && editorInputRef.current) {
      editorInputRef.current.focus();
    }
  }, [isEditing]);

  const activeCellId = coordsToCellId(activeCell.row, activeCell.col);
  const activeCellValue = cells[activeCellId]?.value ?? '';
  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className="grid-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      role="grid"
      aria-rowcount={rowCount}
      aria-colcount={colCount}
      aria-label="QuantumSheet Virtual Grid"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        outline: 'none',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: isFillDragging ? 'crosshair' : 'cell',
        }}
      />

      {isEditing && (
        <input
          ref={editorInputRef}
          type="text"
          value={editValue}
          onChange={(e) => dispatch(setEditValue(e.target.value))}
          onBlur={commitEdit}
          style={editorStyle}
          aria-label={`Editing ${activeCellId}`}
        />
      )}

      <div
        ref={vScrollRef}
        onScroll={handleVScroll}
        style={{
          position: 'absolute',
          top: headerRowHeight,
          right: 0,
          bottom: 14,
          width: 14,
          overflowY: 'scroll',
          overflowX: 'hidden',
          zIndex: 10,
        }}
      >
        <div style={{ width: 1, height: totalVirtualHeight - headerRowHeight }} />
      </div>

      <div
        ref={hScrollRef}
        onScroll={handleHScroll}
        style={{
          position: 'absolute',
          left: headerColWidth,
          bottom: 0,
          right: 14,
          height: 14,
          overflowX: 'scroll',
          overflowY: 'hidden',
          zIndex: 10,
        }}
      >
        <div style={{ height: 1, width: totalVirtualWidth - headerColWidth }} />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 14,
          height: 14,
          backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          borderLeft: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          zIndex: 10,
        }}
      />

      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Cell {activeCellId}, Value: {String(activeCellValue)}
      </div>
    </div>
  );
}
