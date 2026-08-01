// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Pure SVG chart rendering component.
 * Supports bar, column, line, pie, area, and scatter chart types.
 */

import type { ChartConfig } from '../../types';
import { getMinMax, getPieData } from '../../utils/chartData';

// ─── Constants ──────────────────────────────────────────────────────────────

const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 50;
const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 20;
const LEGEND_WIDTH = 100;

const CHART_COLORS = [
  '#3B82EF', '#EF4444', '#22C55E', '#EAB308', '#A855F7',
  '#EC4899', '#F97316', '#06B6D4', '#6366F1', '#14B8A6',
  '#F43F5E', '#84CC16',
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChartData {
  categories: string[];
  series: Array<{ label: string; values: (number | null)[] }>;
}

interface RenderProps {
  config: ChartConfig;
  width: number;
  height: number;
  data?: ChartData;
}

interface DrawingArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotWidth: number;
  plotHeight: number;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function getColor(index: number, cfg: ChartConfig): string {
  if (cfg.series[index]?.color) return cfg.series[index].color!;
  return CHART_COLORS[index % CHART_COLORS.length];
}

function getDrawingArea(width: number, height: number, legendPos: string): DrawingArea {
  const hasLegend = legendPos !== 'none';
  const legendSide = legendPos === 'left' || legendPos === 'right';

  let left = MARGIN_LEFT;
  const right = hasLegend && legendSide && legendPos === 'right'
    ? width - MARGIN_RIGHT - LEGEND_WIDTH
    : width - MARGIN_RIGHT;
  const top = MARGIN_TOP;
  const bottom = height - MARGIN_BOTTOM;

  if (hasLegend && legendSide && legendPos === 'left') {
    left = MARGIN_LEFT + LEGEND_WIDTH;
  }

  return { left, right, top, bottom, plotWidth: right - left, plotHeight: bottom - top };
}

function formatTickValue(val: number): string {
  if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}K`;
  if (Number.isInteger(val)) return String(val);
  return val.toFixed(1);
}

function renderTitle(width: number, title: string): JSX.Element | null {
  if (!title) return null;
  return (
    <text
      x={width / 2}
      y={20}
      textAnchor="middle"
      fill="#374151"
      fontSize="14"
      fontWeight="bold"
    >
      {title}
    </text>
  );
}

function renderLegend(
  data: ChartData,
  cfg: ChartConfig,
  legendPos: string,
  width: number,
  height: number,
): JSX.Element | null {
  if (legendPos === 'none' || data.series.length <= 1) return null;

  const items = data.series.map((s, i) => ({ label: s.label, color: getColor(i, cfg) }));
  let x: number, y: number;

  if (legendPos === 'right') {
    x = width - LEGEND_WIDTH + 10;
    y = MARGIN_TOP;
  } else if (legendPos === 'left') {
    x = 10;
    y = MARGIN_TOP;
  } else if (legendPos === 'top') {
    x = width / 2 - (items.length * 60) / 2;
    y = 35;
  } else {
    x = width / 2 - (items.length * 60) / 2;
    y = height - 15;
  }

  const isHorizontal = legendPos === 'top' || legendPos === 'bottom';

  return (
    <g>
      {items.map((item, i) => {
        const ix = isHorizontal ? x + i * 80 : x;
        const iy = isHorizontal ? y : y + i * 20;
        return (
          <g key={i}>
            <rect x={ix} y={iy - 8} width={12} height={12} fill={item.color} rx={2} />
            <text x={ix + 16} y={iy + 1} fontSize="11" fill="#4B5563">
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function renderAxes(
  data: ChartData,
  area: DrawingArea,
  minVal: number,
  maxVal: number,
): JSX.Element {
  const { left, bottom, plotWidth, plotHeight } = area;

  const yAxis = <line x1={left} y1={area.top} x2={left} y2={bottom} stroke="#D1D5DB" strokeWidth={1} />;
  const xAxis = <line x1={left} y1={bottom} x2={left + plotWidth} y2={bottom} stroke="#D1D5DB" strokeWidth={1} />;

  const yTicks = 5;
  const yTickElements: JSX.Element[] = [];
  for (let i = 0; i <= yTicks; i++) {
    const val = minVal + (maxVal - minVal) * (i / yTicks);
    const y = bottom - (plotHeight * i) / yTicks;
    yTickElements.push(
      <g key={`ytick-${i}`}>
        <line x1={left - 5} y1={y} x2={left} y2={y} stroke="#9CA3AF" strokeWidth={1} />
        <text x={left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#6B7280">
          {formatTickValue(val)}
        </text>
      </g>,
    );
  }

  const gridLines: JSX.Element[] = [];
  for (let i = 1; i <= yTicks; i++) {
    const y = bottom - (plotHeight * i) / yTicks;
    gridLines.push(
      <line key={`grid-${i}`} x1={left} y1={y} x2={left + plotWidth} y2={y} stroke="#F3F4F6" strokeWidth={1} />,
    );
  }

  const xLabels: JSX.Element[] = [];
  const categories = data.categories;
  if (categories.length > 0) {
    const step = Math.max(1, Math.ceil(categories.length / 10));
    for (let i = 0; i < categories.length; i += step) {
      const x = left + (plotWidth * (i + 0.5)) / categories.length;
      xLabels.push(
        <text key={`xlabel-${i}`} x={x} y={bottom + 16} textAnchor="middle" fontSize="10" fill="#6B7280">
          {categories[i]}
        </text>,
      );
    }
  }

  return (
    <g>
      {yAxis}
      {xAxis}
      {yTickElements}
      {gridLines}
      {xLabels}
    </g>
  );
}

function noDataMessage(area: DrawingArea): JSX.Element {
  return (
    <text x={area.left + area.plotWidth / 2} y={area.bottom - area.plotHeight / 2} textAnchor="middle" fill="#9CA3AF">
      No data
    </text>
  );
}

// ─── Chart Type Renderers ───────────────────────────────────────────────────

function renderBarChart(data: ChartData, cfg: ChartConfig, area: DrawingArea, minVal: number, maxVal: number): JSX.Element {
  const { left, bottom, plotWidth, plotHeight } = area;
  const categories = data.categories;
  const seriesCount = data.series.length;

  if (categories.length === 0 || seriesCount === 0) return noDataMessage(area);

  const groupWidth = plotWidth / categories.length;
  const barWidth = (groupWidth * 0.7) / seriesCount;
  const gap = groupWidth * 0.15;
  const range = maxVal - minVal || 1;

  const bars: JSX.Element[] = [];
  categories.forEach((_, catIdx) => {
    data.series.forEach((s, seriesIdx) => {
      const val = s.values[catIdx] ?? 0;
      const barHeight = ((val - minVal) / range) * plotHeight;
      const x = left + gap + catIdx * groupWidth + seriesIdx * barWidth;
      const y = bottom - barHeight;

      bars.push(
        <rect
          key={`bar-${catIdx}-${seriesIdx}`}
          x={x}
          y={y}
          width={Math.max(1, barWidth)}
          height={Math.max(0, barHeight)}
          fill={getColor(seriesIdx, cfg)}
          rx={2}
          opacity={0.9}
        >
          <title>{`${s.label}: ${val}`}</title>
        </rect>,
      );
    });
  });

  return <g>{bars}</g>;
}

function renderColumnChart(data: ChartData, cfg: ChartConfig, area: DrawingArea, minVal: number, maxVal: number): JSX.Element {
  const { left, top, plotWidth, plotHeight } = area;
  const categories = data.categories;
  const seriesCount = data.series.length;

  if (categories.length === 0 || seriesCount === 0) return noDataMessage(area);

  const groupHeight = plotHeight / categories.length;
  const barHeight = (groupHeight * 0.7) / seriesCount;
  const gap = groupHeight * 0.15;
  const range = maxVal - minVal || 1;

  const bars: JSX.Element[] = [];
  categories.forEach((_, catIdx) => {
    data.series.forEach((s, seriesIdx) => {
      const val = s.values[catIdx] ?? 0;
      const barWidth = ((val - minVal) / range) * plotWidth;
      const y = top + gap + catIdx * groupHeight + seriesIdx * barHeight;

      bars.push(
        <rect
          key={`col-${catIdx}-${seriesIdx}`}
          x={left}
          y={y}
          width={Math.max(0, barWidth)}
          height={Math.max(1, barHeight)}
          fill={getColor(seriesIdx, cfg)}
          rx={2}
          opacity={0.9}
        >
          <title>{`${s.label}: ${val}`}</title>
        </rect>,
      );
    });
  });

  return <g>{bars}</g>;
}

function renderLineChart(data: ChartData, cfg: ChartConfig, area: DrawingArea, minVal: number, maxVal: number): JSX.Element {
  const { left, bottom, plotWidth, plotHeight } = area;
  const categories = data.categories;

  if (categories.length === 0) return noDataMessage(area);

  const range = maxVal - minVal || 1;
  const lines: JSX.Element[] = [];

  data.series.forEach((s, seriesIdx) => {
    const points: Array<{ x: number; y: number }> = [];
    s.values.forEach((val, i) => {
      if (val !== null) {
        const x = left + (plotWidth * (i + 0.5)) / categories.length;
        const y = bottom - ((val - minVal) / range) * plotHeight;
        points.push({ x, y });
      }
    });

    if (points.length === 0) return;

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    lines.push(
      <g key={`line-${seriesIdx}`}>
        <path d={pathData} fill="none" stroke={getColor(seriesIdx, cfg)} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={`pt-${seriesIdx}-${i}`} cx={p.x} cy={p.y} r={3} fill={getColor(seriesIdx, cfg)} stroke="#fff" strokeWidth={1}>
            <title>{`${s.label}: ${s.values[i]}`}</title>
          </circle>
        ))}
      </g>,
    );
  });

  return <g>{lines}</g>;
}

function renderAreaChart(data: ChartData, cfg: ChartConfig, area: DrawingArea, minVal: number, maxVal: number): JSX.Element {
  const { left, bottom, plotWidth, plotHeight } = area;
  const categories = data.categories;

  if (categories.length === 0) return noDataMessage(area);

  const range = maxVal - minVal || 1;
  const areas: JSX.Element[] = [];

  data.series.forEach((s, seriesIdx) => {
    const points: Array<{ x: number; y: number }> = [];
    s.values.forEach((val, i) => {
      if (val !== null) {
        const x = left + (plotWidth * (i + 0.5)) / categories.length;
        const y = bottom - ((val - minVal) / range) * plotHeight;
        points.push({ x, y });
      }
    });

    if (points.length === 0) return;

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaPath = `${pathData} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;

    areas.push(
      <g key={`area-${seriesIdx}`}>
        <path d={areaPath} fill={getColor(seriesIdx, cfg)} opacity={0.2} />
        <path d={pathData} fill="none" stroke={getColor(seriesIdx, cfg)} strokeWidth={2} strokeLinecap="round" />
      </g>,
    );
  });

  return <g>{areas}</g>;
}

function renderPieChart(data: ChartData, cfg: ChartConfig, width: number, height: number, legendPos: string): JSX.Element {
  const pieData = getPieData(data);

  if (pieData.length === 0 || pieData.every((s) => s.value <= 0)) {
    return <text x={width / 2} y={height / 2} textAnchor="middle" fill="#9CA3AF">No data</text>;
  }

  const hasLegend = legendPos !== 'none';
  const radius = Math.min(width - 40, height - 80) / 2;
  const cx = hasLegend && legendPos === 'left' ? width / 2 + LEGEND_WIDTH / 2 : width / 2;
  const cy = height / 2;
  const total = pieData.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) return <text x={width / 2} y={height / 2} textAnchor="middle" fill="#9CA3AF">No data</text>;

  let currentAngle = -Math.PI / 2;
  const slices: JSX.Element[] = [];

  pieData.forEach((slice, i) => {
    if (slice.value <= 0) return;

    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(currentAngle);
    const y1 = cy + radius * Math.sin(currentAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;
    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    slices.push(
      <path key={`slice-${i}`} d={pathData} fill={getColor(i, cfg)} stroke="#fff" strokeWidth={2} opacity={0.9}>
        <title>{`${slice.label}: ${slice.value} (${slice.percent.toFixed(1)}%)`}</title>
      </path>,
    );

    currentAngle = endAngle;
  });

  return <g>{slices}</g>;
}

function renderScatterChart(data: ChartData, cfg: ChartConfig, area: DrawingArea, minVal: number, maxVal: number): JSX.Element {
  const { left, bottom, plotWidth, plotHeight } = area;

  if (data.series.length < 2) {
    return <text x={left + plotWidth / 2} y={bottom - plotHeight / 2} textAnchor="middle" fill="#9CA3AF">Need 2+ series</text>;
  }

  const range = maxVal - minVal || 1;
  const xValues = data.series[0].values;
  const points: JSX.Element[] = [];

  data.series.slice(1).forEach((s, sIdx) => {
    s.values.forEach((val, i) => {
      if (val !== null && xValues[i] !== null) {
        const x = left + ((xValues[i]! - minVal) / range) * plotWidth;
        const y = bottom - ((val - minVal) / range) * plotHeight;
        points.push(
          <circle key={`scatter-${sIdx}-${i}`} cx={x} cy={y} r={5} fill={getColor(sIdx + 1, cfg)} opacity={0.7} stroke="#fff" strokeWidth={1}>
            <title>{`(${xValues[i]}, ${val})`}</title>
          </circle>,
        );
      }
    });
  });

  return <g>{points}</g>;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function ChartRenderer({ config, width, height, data: providedData }: RenderProps) {
  const data = providedData ?? { categories: [], series: [] };
  const area = getDrawingArea(width, height, config.legendPosition);
  const { min: minVal, max: maxVal } = getMinMax(data);

  const renderChart = (): JSX.Element => {
    switch (config.type) {
      case 'bar': return renderBarChart(data, config, area, minVal, maxVal);
      case 'column': return renderColumnChart(data, config, area, minVal, maxVal);
      case 'line': return renderLineChart(data, config, area, minVal, maxVal);
      case 'area': return renderAreaChart(data, config, area, minVal, maxVal);
      case 'pie': return renderPieChart(data, config, width, height, config.legendPosition);
      case 'scatter': return renderScatterChart(data, config, area, minVal, maxVal);
      default: return <text x={width / 2} y={height / 2} textAnchor="middle" fill="#9CA3AF">Unknown chart type</text>;
    }
  };

  const xAxisLabel = config.xAxisLabel ? (
    <text x={area.left + area.plotWidth / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#6B7280">
      {config.xAxisLabel}
    </text>
  ) : null;

  const yAxisLabel = config.yAxisLabel ? (
    <text x={12} y={area.top + area.plotHeight / 2} textAnchor="middle" fontSize="11" fill="#6B7280" transform={`rotate(-90, 12, ${area.top + area.plotHeight / 2})`}>
      {config.yAxisLabel}
    </text>
  ) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="chart-renderer"
      data-testid={`chart-${config.id}`}
    >
      {renderTitle(width, config.title)}
      {config.type !== 'pie' && config.type !== 'scatter' && renderAxes(data, area, minVal, maxVal)}
      {renderChart()}
      {xAxisLabel}
      {yAxisLabel}
      {renderLegend(data, config, config.legendPosition, width, height)}
    </svg>
  );
}
