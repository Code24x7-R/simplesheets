// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Overlay component that renders all charts for the current sheet.
 * Charts are absolutely positioned floating SVG elements on the grid.
 */

import { useCallback, useState } from 'react';
import type { ChartConfig, Sheet } from '../../types';
import { ChartRenderer } from './ChartRenderer';
import { extractChartData } from '../../utils/chartData';

interface ChartOverlayProps {
  /** The sheet containing charts. */
  sheet: Sheet;
  /** Callback when a chart is selected. */
  onSelectChart?: (id: string | null) => void;
  /** Callback when a chart is moved. */
  onMoveChart?: (id: string, row: number, col: number) => void;
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
  onSelectChart,
  onMoveChart,
  onDeleteChart,
  selectedChartId,
}: ChartOverlayProps) {
  const charts = sheet.charts ?? [];
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  if (charts.length === 0) return null;

  return (
    <div
      className="chart-overlay-container absolute inset-0 pointer-events-none overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      data-testid="chart-overlay"
    >
      {charts.map((chart) => {
        const data = extractChartData(sheet, chart.dataRange);
        const isSelected = chart.id === selectedChartId;

        return (
          <div
            key={chart.id}
            className={`absolute pointer-events-auto ${dragging === chart.id ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              left: chart.col * 100,
              top: chart.row * 28,
              width: chart.width,
              height: chart.height,
            }}
            onMouseDown={(e) => handleMouseDown(e, chart)}
            data-testid={`chart-container-${chart.id}`}
          >
            <div className={`bg-white rounded-lg shadow-lg border-2 ${isSelected ? 'border-blue-500' : 'border-gray-200'} overflow-hidden`}>
              <ChartRenderer
                config={chart}
                width={chart.width}
                height={chart.height}
                data={data}
              />
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
