// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Chart configuration dialog.
 * Allows users to select chart type, data range, labels, and preview.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ChartConfig, ChartType, LegendPosition, Workbook } from '../types';
import { extractChartDataFromWorkbook, generateColors, findDataRange } from '../utils/chartData';
import { ChartRenderer } from './charts/ChartRenderer';
import type { Sheet } from '../types';
import type { ChartSettings } from '../hooks/useChartSettings';

interface ChartDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (config: ChartConfig) => void;
  /** The sheet containing data. */
  sheet: Sheet;
  /** Initial data range (from selection). */
  initialRange?: string;
  /** Existing chart to edit (optional). */
  existingChart?: ChartConfig;
  /** Whether range picker mode is active. */
  isRangePickerActive?: boolean;
  /** Callback to toggle range picker mode. */
  onToggleRangePicker?: () => void;
  /** Initial settings from persistence. */
  initialSettings?: ChartSettings;
  /** Callback when settings change (for persistence). */
  onSettingsChange?: (settings: ChartSettings) => void;
  /** The workbook (for cross-sheet data references). */
  workbook?: Workbook;
}

/** Chart type metadata for the type selector. */
const CHART_TYPES: Array<{ type: ChartType; label: string; icon: string }> = [
  { type: 'bar', label: 'Bar', icon: '📊' },
  { type: 'column', label: 'Column', icon: '📶' },
  { type: 'line', label: 'Line', icon: '📈' },
  { type: 'pie', label: 'Pie', icon: '🥧' },
  { type: 'area', label: 'Area', icon: '📉' },
  { type: 'scatter', label: 'Scatter', icon: '⚬' },
];

const LEGEND_POSITIONS: Array<{ value: LegendPosition; label: string }> = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'none', label: 'None' },
];

/**
 * Dialog for creating or editing a chart.
 */
export function ChartDialog({ isOpen, onClose, onApply, sheet, initialRange, existingChart, isRangePickerActive, onToggleRangePicker, initialSettings, onSettingsChange, workbook }: ChartDialogProps) {
  const defaultRange = initialRange || findDataRange(sheet) || 'A1:B5';
  const settings = initialSettings;

  const [chartType, setChartType] = useState<ChartType>(existingChart?.type || settings?.type || 'bar');
  const [dataRange, setDataRange] = useState(existingChart?.dataRange || defaultRange);
  const [title, setTitle] = useState(existingChart?.title || settings?.title || 'Chart Title');
  const [xAxisLabel, setXAxisLabel] = useState(existingChart?.xAxisLabel || settings?.xAxisLabel || '');
  const [yAxisLabel, setYAxisLabel] = useState(existingChart?.yAxisLabel || settings?.yAxisLabel || '');
  const [legendPosition, setLegendPosition] = useState<LegendPosition>(existingChart?.legendPosition || settings?.legendPosition || 'bottom');

  // Listen for chart range selection events from the grid
  useEffect(() => {
    const handleRangeSelected = (e: Event) => {
      const customEvent = e as CustomEvent<{ range: string }>;
      setDataRange(customEvent.detail.range);
    };
    window.addEventListener('simplesheets:chartRangeSelected', handleRangeSelected);
    return () => window.removeEventListener('simplesheets:chartRangeSelected', handleRangeSelected);
  }, []);

  // Extract data for preview (supports cross-sheet references via workbook)
  const previewData = useMemo(() => {
    try {
      if (workbook) {
        return extractChartDataFromWorkbook(workbook, dataRange);
      }
      // Fallback: extract from active sheet only
      return extractChartDataFromWorkbook(
        { id: 'temp', title: 'Temp', sheets: [sheet], activeSheetIndex: 0, lastModified: 0 },
        dataRange
      );
    } catch {
      return { categories: [], series: [] };
    }
  }, [sheet, workbook, dataRange]);

  // Generate preview config
  const previewConfig = useMemo<ChartConfig>(() => {
    const series = previewData.series.map((s, i) => ({
      label: s.label,
      dataRange: '',
      color: generateColors(previewData.series.length)[i],
    }));

    return {
      id: existingChart?.id || 'preview-chart',
      type: chartType,
      title,
      dataRange,
      series,
      xAxisLabel: xAxisLabel || undefined,
      yAxisLabel: yAxisLabel || undefined,
      legendPosition,
      width: 380,
      height: 240,
      row: existingChart?.row || 0,
      col: existingChart?.col || 0,
    };
  }, [chartType, title, dataRange, xAxisLabel, yAxisLabel, legendPosition, previewData, existingChart]);

  const handleApply = useCallback(() => {
    const width = existingChart?.width || settings?.width || 400;
    const height = existingChart?.height || settings?.height || 300;

    const config: ChartConfig = {
      id: existingChart?.id || `chart-${Date.now()}`,
      type: chartType,
      title,
      dataRange,
      series: previewData.series.map((s, i) => ({
        label: s.label,
        dataRange: '',
        color: generateColors(previewData.series.length)[i],
      })),
      xAxisLabel: xAxisLabel || undefined,
      yAxisLabel: yAxisLabel || undefined,
      legendPosition,
      width,
      height,
      row: existingChart?.row || 0,
      col: existingChart?.col || 0,
    };

    // Persist settings for next time
    onSettingsChange?.({
      type: chartType,
      legendPosition,
      title,
      xAxisLabel,
      yAxisLabel,
      width,
      height,
    });

    onApply(config);
    onClose();
  }, [chartType, title, dataRange, xAxisLabel, yAxisLabel, legendPosition, previewData, existingChart, onApply, onClose, settings, onSettingsChange]);

  if (!isOpen) return null;

  // When range picker is active, minimize dialog to top of screen
  if (isRangePickerActive) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-lg shadow-xl border border-blue-300 w-[500px]">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium text-blue-700">📊 Select a data range on the grid</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Press Enter to accept, Esc to cancel</span>
            <button
              onClick={onToggleRangePicker}
              className="text-gray-400 hover:text-gray-600 text-sm"
              aria-label="Cancel range selection"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[700px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold">{existingChart ? 'Edit Chart' : 'Insert Chart'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Chart Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Chart Type</label>
            <div className="grid grid-cols-6 gap-2">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.type}
                  className={`flex flex-col items-center py-2 px-1 rounded border text-xs ${
                    chartType === ct.type
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setChartType(ct.type)}
                  data-testid={`chart-type-${ct.type}`}
                >
                  <span className="text-lg">{ct.icon}</span>
                  <span>{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Range */}
          <div>
            <label className="block text-sm font-medium mb-1">Data Range</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm"
                value={dataRange}
                onChange={(e) => setDataRange(e.target.value)}
                placeholder="e.g., A1:C10"
                data-testid="chart-data-range"
              />
              <button
                className={`px-3 py-2 rounded border text-sm whitespace-nowrap ${
                  isRangePickerActive
                    ? 'bg-blue-100 border-blue-500 text-blue-700'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={onToggleRangePicker}
                title="Select range on grid"
                data-testid="chart-range-picker"
              >
                {isRangePickerActive ? '✓ Selecting...' : '📎 Pick Range'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {isRangePickerActive
                ? 'Click and drag on the grid to select a range, then press Enter.'
                : `${previewData.categories.length} categories, ${previewData.series.length} series detected`}
            </p>
          </div>

          {/* Title and Labels */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Chart Title</label>
              <input
                type="text"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="chart-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">X-Axis Label</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={xAxisLabel}
                  onChange={(e) => setXAxisLabel(e.target.value)}
                  data-testid="chart-x-axis"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Y-Axis Label</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  value={yAxisLabel}
                  onChange={(e) => setYAxisLabel(e.target.value)}
                  data-testid="chart-y-axis"
                />
              </div>
            </div>
          </div>

          {/* Legend Position */}
          <div>
            <label className="block text-sm font-medium mb-1">Legend Position</label>
            <div className="flex gap-2">
              {LEGEND_POSITIONS.map((lp) => (
                <button
                  key={lp.value}
                  className={`px-3 py-1.5 rounded border text-xs ${
                    legendPosition === lp.value
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setLegendPosition(lp.value)}
                  data-testid={`legend-${lp.value}`}
                >
                  {lp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 flex justify-center" data-testid="chart-preview">
              <ChartRenderer
                config={previewConfig}
                width={380}
                height={240}
                data={previewData}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-3 border-t border-gray-200">
          <button
            className="px-4 py-2 rounded border border-gray-200 hover:bg-gray-50 text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            onClick={handleApply}
            data-testid="chart-apply"
          >
            {existingChart ? 'Update Chart' : 'Insert Chart'}
          </button>
        </div>
      </div>
    </div>
  );
}
