// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Overlay component that renders all charts for the current sheet.
 * Charts are absolutely positioned floating SVG elements on the grid.
 * Supports z-index management, minimize/restore, and selection.
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import type { ChartConfig, Sheet, Workbook } from '../../types';
import { ChartRenderer } from './ChartRenderer';
import { extractChartDataFromWorkbook } from '../../utils/chartData';

interface ChartOverlayProps {
  /** The sheet containing charts. */
  sheet: Sheet;
  /** The workbook (for cross-sheet data references). */
  workbook: Workbook;
  /** Callback when a chart is selected. */
  onSelectChart?: (id: string | null) => void;
  /** Callback when a chart is moved. */
  onMoveChart?: (id: string, row: number, col: number) => void;
  /** Callback when a chart is resized. */
  onResizeChart?: (id: string, width: number, height: number) => void;
  /** Callback when a chart is deleted. */
  onDeleteChart?: (id: string) => void;
  /** Currently selected chart ID. */
  selectedChartId?: string | null;
}

/**
 * Overlay that renders all charts embedded in a sheet.
 */
export function ChartOverlay({
  sheet,
  workbook,
  onSelectChart,
  onMoveChart,
  onResizeChart,
  onDeleteChart,
  selectedChartId,
}: ChartOverlayProps) {
  const charts = useMemo(() => sheet.charts ?? [], [sheet.charts]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [minimizedCharts, setMinimizedCharts] = useState<Set<string>>(new Set());
  const [resizing, setResizing] = useState<{ id: string; handle: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const resizingRef = useRef(resizing);
  resizingRef.current = resizing;

  const MIN_WIDTH = 100;
  const MIN_HEIGHT = 80;

  const handleResizeStart = useCallback((e: React.MouseEvent, chartId: string, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    const chart = charts.find((c) => c.id === chartId);
    if (!chart || !onResizeChart) return;

    const resizeState = {
      id: chartId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: chart.width,
      startH: chart.height,
    };

    setResizing(resizeState);
    resizingRef.current = resizeState;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const current = resizingRef.current;
      if (!current) return;
      const dx = moveEvent.clientX - current.startX;
      const dy = moveEvent.clientY - current.startY;

      let newW = current.startW;
      let newH = current.startH;

      if (current.handle.includes('e')) newW = Math.max(MIN_WIDTH, current.startW + dx);
      if (current.handle.includes('w')) newW = Math.max(MIN_WIDTH, current.startW - dx);
      if (current.handle.includes('s')) newH = Math.max(MIN_HEIGHT, current.startH + dy);
      if (current.handle.includes('n')) newH = Math.max(MIN_HEIGHT, current.startH - dy);

      onResizeChart(current.id, newW, newH);
    };

    const handleResizeUp = () => {
      setResizing(null);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeUp);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  }, [charts, onResizeChart]);

  const handleMouseDown = useCallback((e: React.MouseEvent, chart: ChartConfig) => {
    e.stopPropagation();
    onSelectChart?.(chart.id);

    if (onMoveChart) {
      setDragging(chart.id);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [onSelectChart, onMoveChart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !onMoveChart) return;

    const gridContainer = (e.currentTarget as HTMLElement).closest('.chart-overlay-container');
    if (!gridContainer) return;

    const containerRect = gridContainer.getBoundingClientRect();
    const x = e.clientX - containerRect.left - dragOffset.x;
    const y = e.clientY - containerRect.top - dragOffset.y;

    // Convert pixel position to row/col (approximate)
    const row = Math.max(0, Math.floor(y / 28)); // default row height
    const col = Math.max(0, Math.floor(x / 100)); // default col width

    onMoveChart(dragging, row, col);
  }, [dragging, dragOffset, onMoveChart]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  const toggleMinimized = useCallback((chartId: string) => {
    setMinimizedCharts((prev) => {
      const next = new Set(prev);
      if (next.has(chartId)) {
        next.delete(chartId);
      } else {
        next.add(chartId);
      }
      return next;
    });
  }, []);

  if (charts.length === 0) return null;

  // Sort charts: selected chart renders last (on top)
  const sortedCharts = [...charts].sort((a, b) => {
    if (a.id === selectedChartId) return 1;
    if (b.id === selectedChartId) return -1;
    return 0;
  });

  return (
    <div
      className="chart-overlay-container absolute inset-0 pointer-events-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      data-testid="chart-overlay"
    >
      {sortedCharts.map((chart, index) => {
        const data = extractChartDataFromWorkbook(workbook, chart.dataRange);
        const isSelected = chart.id === selectedChartId;
        const isMinimized = minimizedCharts.has(chart.id);

        // Resize handles for selected chart
        const resizeHandles = isSelected && !isMinimized && onResizeChart ? (
          <>
            {/* Corner handles */}
            <div
              className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize bg-blue-500 rounded-sm opacity-70 hover:opacity-100"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'nw')}
              data-testid={`resize-nw-${chart.id}`}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize bg-blue-500 rounded-sm opacity-70 hover:opacity-100"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'ne')}
              data-testid={`resize-ne-${chart.id}`}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize bg-blue-500 rounded-sm opacity-70 hover:opacity-100"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'sw')}
              data-testid={`resize-sw-${chart.id}`}
            />
            <div
              className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-blue-500 rounded-sm opacity-70 hover:opacity-100"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'se')}
              data-testid={`resize-se-${chart.id}`}
            />
            {/* Edge handles */}
            <div
              className="absolute top-0 left-3 right-3 h-2 cursor-n-resize bg-blue-300 opacity-50 hover:opacity-80"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'n')}
              data-testid={`resize-n-${chart.id}`}
            />
            <div
              className="absolute bottom-0 left-3 right-3 h-2 cursor-s-resize bg-blue-300 opacity-50 hover:opacity-80"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 's')}
              data-testid={`resize-s-${chart.id}`}
            />
            <div
              className="absolute left-0 top-3 bottom-3 w-2 cursor-w-resize bg-blue-300 opacity-50 hover:opacity-80"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'w')}
              data-testid={`resize-w-${chart.id}`}
            />
            <div
              className="absolute right-0 top-3 bottom-3 w-2 cursor-e-resize bg-blue-300 opacity-50 hover:opacity-80"
              onMouseDown={(e) => handleResizeStart(e, chart.id, 'e')}
              data-testid={`resize-e-${chart.id}`}
            />
          </>
        ) : null;

        return (
          <div
            key={chart.id}
            className={`absolute pointer-events-auto ${dragging === chart.id ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              left: chart.col * 100,
              top: chart.row * 28,
              width: chart.width,
              height: isMinimized ? 28 : chart.height,
              zIndex: isSelected ? 100 : 10 + index,
            }}
            onMouseDown={(e) => handleMouseDown(e, chart)}
            data-testid={`chart-container-${chart.id}`}
          >
            <div className={`bg-white rounded-lg shadow-lg border-2 ${isSelected ? 'border-blue-500' : 'border-gray-200'} overflow-hidden relative`}>
              {/* Chart header bar for minimize/restore */}
              <div
                className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-100 cursor-pointer"
                onDoubleClick={() => toggleMinimized(chart.id)}
                data-testid={`chart-header-${chart.id}`}
              >
                <span className="text-xs font-medium text-gray-600 truncate max-w-[150px]">
                  {chart.title}
                </span>
                <button
                  className="text-gray-400 hover:text-gray-600 text-xs w-4 h-4 flex items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMinimized(chart.id);
                  }}
                  data-testid={`minimize-chart-${chart.id}`}
                >
                  {isMinimized ? '□' : '−'}
                </button>
              </div>
              {/* Chart body */}
              {!isMinimized && (
                <ChartRenderer
                  config={chart}
                  width={chart.width}
                  height={chart.height - 28}
                  data={data}
                />
              )}
              {/* Delete button */}
              {isSelected && onDeleteChart && (
                <button
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChart(chart.id);
                  }}
                  data-testid={`delete-chart-${chart.id}`}
                >
                  ×
                </button>
              )}
              {/* Resize handles */}
              {resizeHandles}
            </div>
          </div>
        );
      })}
    </div>
  );
}
