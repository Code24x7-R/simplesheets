// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Gantt Chart Renderer
 *
 * Pure SVG Gantt chart component. Renders WBS tasks as horizontal bars
 * on a timeline. Supports:
 * - Day/week/month zoom levels
 * - Task bars, summary bars, milestones
 * - Dependency arrows
 * - Progress overlay
 * - Critical path highlighting
 * - Today marker
 * - Risk indicators and heatmap
 */

import { useMemo } from 'react';
import type { Project, WBSTask, GanttZoom, RiskLevel } from '../types';
import { flattenToRows } from './treeOps';
import { formatDate } from './calendar';
import { rollUpRiskExposure } from './rollups';
import { getRiskLevel } from './risks';

// ─── Constants ──────────────────────────────────────────────────────────────

const MARGIN_LEFT = 160; // Width of task name column
const MARGIN_TOP = 40;   // Height of timeline header
const BAR_HEIGHT = 24;
const ROW_HEIGHT = 32;
const MILESTONE_SIZE = 10;

const ZOOM_DAY_WIDTH = 40;
const ZOOM_WEEK_WIDTH = 14;
const ZOOM_MONTH_WIDTH = 4;

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface GanttChartProps {
  project: Project;
  zoom?: GanttZoom;
  showCriticalPath?: boolean;
  showProgress?: boolean;
  showDependencies?: boolean;
  showRiskHeatmap?: boolean;
  showTodayMarker?: boolean;
  selectedTaskId?: string | null;
  criticalPath?: string[];
  onTaskSelect?: (taskId: string) => void;
  onTaskDoubleClick?: (taskId: string) => void;
  width?: number;
  height?: number;
}

interface TimelineTick {
  date: string;
  x: number;
  label: string;
  isWeekend: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function GanttChart({
  project,
  zoom = 'week',
  showCriticalPath = true,
  showProgress = true,
  showDependencies: _showDependencies = true,
  showRiskHeatmap = false,
  showTodayMarker = true,
  selectedTaskId = null,
  criticalPath = [],
  onTaskSelect,
  onTaskDoubleClick,
  width: _width = 900,
  height: _height = 500,
}: GanttChartProps) {
  const flatTasks = useMemo(() => flattenToRows(project.wbs), [project.wbs]);
  const projectStart = project.startDate;
  const projectEnd = project.endDate;

  const dayWidth = zoom === 'day' ? ZOOM_DAY_WIDTH : zoom === 'week' ? ZOOM_WEEK_WIDTH : ZOOM_MONTH_WIDTH;
  const totalDays = Math.max(1, getDaysBetween(projectStart, projectEnd) + 1);
  const chartWidth = totalDays * dayWidth;
  const svgWidth = MARGIN_LEFT + chartWidth;
  const svgHeight = MARGIN_TOP + flatTasks.length * ROW_HEIGHT;

  // Compute timeline ticks
  const ticks = useMemo(() => computeTimelineTicks(projectStart, totalDays, dayWidth, zoom), [projectStart, totalDays, dayWidth, zoom]);

  // Compute task bar layouts
  const barLayouts = useMemo(
    () => flatTasks.map((task) => computeBarLayout(task, projectStart, project.risks, dayWidth, showRiskHeatmap)),
    [flatTasks, projectStart, project.risks, dayWidth, showRiskHeatmap],
  );

  const todayX = showTodayMarker ? computeTodayPosition(projectStart, new Date().toISOString().slice(0, 10), dayWidth) : null;

  return (
    <div className="overflow-auto border border-gray-200 rounded bg-white" data-testid="gantt-chart">
      <svg width={svgWidth} height={svgHeight} className="select-none">
        {/* Timeline header */}
        <g className="gantt-header">
          <rect x={0} y={0} width={svgWidth} height={MARGIN_TOP} fill="#f8f9fa" />
          {ticks.map((tick) => (
            <g key={tick.date}>
              <line
                x1={MARGIN_LEFT + tick.x}
                y1={0}
                x2={MARGIN_LEFT + tick.x}
                y2={MARGIN_TOP}
                stroke={tick.isWeekend ? '#e5e7eb' : '#d1d5db'}
                strokeWidth={1}
              />
              <text
                x={MARGIN_LEFT + tick.x + 2}
                y={MARGIN_TOP - 8}
                fontSize={10}
                fill="#6b7280"
              >
                {tick.label}
              </text>
            </g>
          ))}
        </g>

        {/* Task rows */}
        <g className="gantt-rows">
          {flatTasks.map((task, index) => {
            const layout = barLayouts[index];
            const y = MARGIN_TOP + index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
            const isSelected = task.id === selectedTaskId;
            const isCritical = showCriticalPath && criticalPath.includes(task.id);

            return (
              <g key={task.id} onClick={() => onTaskSelect?.(task.id)} onDoubleClick={() => onTaskDoubleClick?.(task.id)} className="cursor-pointer">
                {/* Task name */}
                <text
                  x={8}
                  y={MARGIN_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
                  fontSize={12}
                  fill={isSelected ? '#2563eb' : '#374151'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {task.level > 0 && (
                    <tspan dx={task.level * 12}> </tspan>
                  )}
                  {task.name.length > 18 ? task.name.slice(0, 18) + '...' : task.name}
                </text>

                {/* Weekend shading */}
                {ticks.filter((t) => t.isWeekend).map((tick) => (
                  <rect
                    key={`wk-${tick.date}-${task.id}`}
                    x={MARGIN_LEFT + tick.x}
                    y={MARGIN_TOP + index * ROW_HEIGHT}
                    width={dayWidth}
                    height={ROW_HEIGHT}
                    fill="#f9fafb"
                  />
                ))}

                {/* Task bar */}
                {task.isMilestone ? (
                  <polygon
                    points={`${MARGIN_LEFT + layout.x},${y + BAR_HEIGHT / 2} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE},${y} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE * 2},${y + BAR_HEIGHT / 2} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE},${y + BAR_HEIGHT}`}
                    fill={showRiskHeatmap && layout.riskLevel ? RISK_COLORS[layout.riskLevel] : task.color}
                    stroke={isCritical ? '#DC2626' : 'none'}
                    strokeWidth={isCritical ? 2 : 0}
                  />
                ) : (
                  <rect
                    x={MARGIN_LEFT + layout.x}
                    y={y}
                    width={Math.max(layout.width, 4)}
                    height={BAR_HEIGHT}
                    rx={3}
                    fill={showRiskHeatmap && layout.riskLevel ? RISK_COLORS[layout.riskLevel] : task.color}
                    opacity={task.isSummary ? 0.7 : 0.9}
                    stroke={isCritical ? '#DC2626' : 'none'}
                    strokeWidth={isCritical ? 2 : 0}
                  />
                )}

                {/* Progress overlay */}
                {showProgress && !task.isMilestone && task.progress > 0 && (
                  <rect
                    x={MARGIN_LEFT + layout.x}
                    y={y}
                    width={Math.max((layout.width * task.progress) / 100, 4)}
                    height={BAR_HEIGHT}
                    rx={3}
                    fill="rgba(0,0,0,0.2)"
                  />
                )}

                {/* Risk indicator */}
                {layout.hasRisk && !showRiskHeatmap && (
                  <text
                    x={MARGIN_LEFT + layout.x + Math.max(layout.width, 4) - 8}
                    y={y - 2}
                    fontSize={12}
                    fill="#F97316"
                  >
                    ⚠
                  </text>
                )}

                {/* Row hover effect */}
                <rect
                  x={0}
                  y={MARGIN_TOP + index * ROW_HEIGHT}
                  width={svgWidth}
                  height={ROW_HEIGHT}
                  fill="transparent"
                  stroke={isSelected ? '#2563eb' : 'none'}
                  strokeWidth={isSelected ? 1 : 0}
                />
              </g>
            );
          })}
        </g>

        {/* Today marker */}
        {todayX !== null && todayX >= 0 && todayX <= chartWidth && (
          <line
            x1={MARGIN_LEFT + todayX}
            y1={0}
            x2={MARGIN_LEFT + todayX}
            y2={svgHeight}
            stroke="#EF4444"
            strokeWidth={1}
            strokeDasharray="4,2"
          />
        )}

        {/* Separator line */}
        <line x1={MARGIN_LEFT} y1={0} x2={MARGIN_LEFT} y2={svgHeight} stroke="#d1d5db" strokeWidth={1} />
      </svg>
    </div>
  );
}

// ─── Layout computation ─────────────────────────────────────────────────────

interface BarLayout {
  x: number;
  width: number;
  hasRisk: boolean;
  riskLevel: RiskLevel | null;
}

function computeBarLayout(task: WBSTask, projectStart: string, projectRisk: import('../types').Risk[], dayWidth: number, showRiskHeatmap: boolean): BarLayout {
  const startOffset = getDaysBetween(projectStart, task.startDate);
  const taskDays = Math.max(1, getDaysBetween(task.startDate, task.endDate) + 1);

  const hasRisk = task.riskIds.length > 0;
  let riskLevel: RiskLevel | null = null;

  if (showRiskHeatmap && hasRisk) {
    const exposure = rollUpRiskExposure(task, projectRisk);
    riskLevel = getRiskLevel(exposure);
  }

  return {
    x: startOffset * dayWidth,
    width: (taskDays - 1) * dayWidth,
    hasRisk,
    riskLevel,
  };
}

// ─── Timeline computation ───────────────────────────────────────────────────

function computeTimelineTicks(projectStart: string, totalDays: number, dayWidth: number, zoom: GanttZoom): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const start = new Date(projectStart + 'T00:00:00');

  if (zoom === 'day') {
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const iso = toISODate(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      ticks.push({
        date: iso,
        x: i * dayWidth,
        label: String(date.getDate()),
        isWeekend,
      });
    }
  } else if (zoom === 'week') {
    for (let i = 0; i < totalDays; i += 7) {
      const date = new Date(start);
      date.setDate(date.getDate() + i);
      const iso = toISODate(date);
      ticks.push({
        date: iso,
        x: i * dayWidth,
        label: formatDate(iso, 'short'),
        isWeekend: false,
      });
    }
  } else {
    // Month view
    for (let monthOffset = 0; monthOffset * 30 < totalDays; monthOffset++) {
      const current = new Date(start);
      current.setMonth(current.getMonth() + monthOffset);
      const iso = toISODate(current);
      const dayOffset = getDaysBetween(projectStart, iso);
      ticks.push({
        date: iso,
        x: dayOffset * dayWidth,
        label: formatDate(iso, 'long').split(' ').slice(0, 2).join(' '),
        isWeekend: false,
      });
    }
  }

  return ticks;
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function getDaysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
}

function computeTodayPosition(projectStart: string, today: string, dayWidth: number): number {
  return getDaysBetween(projectStart, today) * dayWidth;
}

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
