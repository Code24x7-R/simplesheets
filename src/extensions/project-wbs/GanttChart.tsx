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

import React, { useMemo, useState, useCallback } from 'react';
import type { Project, WBSTask, GanttZoom, RiskLevel } from '../types';
import { flattenToRows } from './treeOps';
import { formatDate, toISO } from './calendar';
import { rollUpRiskExposure } from './rollups';
import { getRiskLevel } from './risks';

// ─── Helper: Get resource info for a task ───────────────────────────────
interface ResourceInfo {
  name: string;
  color: string;
}

function getResourceInfo(task: WBSTask, project: Project): ResourceInfo | null {
  if (!task.responsibleResourceId) return null;
  const resource = project.resources.find((r) => r.id === task.responsibleResourceId);
  if (!resource) return null;
  return { name: resource.name, color: resource.color };
}

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
  onTaskToggleCollapse?: (taskId: string) => void;
  width?: number;
  height?: number;
  containerRef?: React.RefObject<HTMLDivElement>;
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
  showDependencies = true,
  showRiskHeatmap = false,
  showTodayMarker = true,
  selectedTaskId = null,
  criticalPath = [],
  onTaskSelect,
  onTaskDoubleClick,
  onTaskToggleCollapse,
  width: _width = 900,
  height: _height = 500,
  containerRef,
}: GanttChartProps) {
  const flatTasks = useMemo(() => {
    const all = flattenToRows(project.wbs);
    // Filter out children of collapsed summary tasks
    const result: WBSTask[] = [];
    let skipLevel = -1;
    for (const task of all) {
      if (skipLevel >= 0 && task.level > skipLevel) {
        continue; // Skip children of collapsed task
      }
      skipLevel = -1;
      result.push(task);
      if (task.isSummary && task.collapsed) {
        skipLevel = task.level;
      }
    }
    return result;
  }, [project.wbs]);
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

  // Hover state for resource popup
  const [hoveredBar, setHoveredBar] = useState<{
    task: WBSTask;
    x: number;
    y: number;
    resource: ResourceInfo | null;
  } | null>(null);

  const handleBarMouseEnter = useCallback((task: WBSTask, x: number, y: number) => {
    const resource = getResourceInfo(task, project);
    setHoveredBar({ task, x, y, resource });
  }, [project]);

  const handleBarMouseLeave = useCallback(() => {
    setHoveredBar(null);
  }, []);

  return (
    <div ref={containerRef} className="overflow-auto max-w-full border border-gray-200 rounded bg-white" data-testid="gantt-chart">
      <svg width={svgWidth} height={svgHeight} className="select-none">
        {/* Arrowhead marker for dependency lines */}
        <defs>
          <marker
            id="gantt-arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF" />
          </marker>
        </defs>

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
            const barX = MARGIN_LEFT + layout.x;

            return (
              <g key={task.id} onClick={() => onTaskSelect?.(task.id)} onDoubleClick={() => onTaskDoubleClick?.(task.id)} onMouseEnter={() => handleBarMouseEnter(task, barX, y)} onMouseLeave={handleBarMouseLeave} className="cursor-pointer">
                {/* Tooltip with task info */}
                {(() => {
                  const resourceInfo = getResourceInfo(task, project);
                  const tooltipText = [
                    task.name,
                    resourceInfo ? `Resource: ${resourceInfo.name}` : null,
                    `Progress: ${task.progress}%`,
                    `Dates: ${task.startDate} to ${task.endDate}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                  return <title>{tooltipText}</title>;
                })()}

                {/* Collapse/expand button for summary tasks */}
                {task.isSummary && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      onTaskToggleCollapse?.(task.id);
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      x={2 + task.level * 12}
                      y={MARGIN_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2 - 6}
                      width={12}
                      height={12}
                      rx={2}
                      fill="#e5e7eb"
                      stroke="#9ca3af"
                      strokeWidth={1}
                    />
                    <text
                      x={8 + task.level * 12}
                      y={MARGIN_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 3}
                      fontSize={10}
                      fill="#374151"
                      textAnchor="middle"
                    >
                      {task.collapsed ? '+' : '-'}
                    </text>
                  </g>
                )}

                {/* Status icon */}
                <text
                  x={2}
                  y={MARGIN_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
                  fontSize={10}
                  fill={task.status === 'done' ? '#22C55E' :
                        task.status === 'in_progress' ? '#3B82F6' :
                        task.status === 'waiting' ? '#F59E0B' :
                        task.status === 'on_hold' ? '#EF4444' :
                        task.status === 'ready' ? '#8B5CF6' : '#9CA3AF'}
                >
                  {task.status === 'done' ? '✓' :
                   task.status === 'in_progress' ? '►' :
                   task.status === 'waiting' ? '⏳' :
                   task.status === 'on_hold' ? '⏸' :
                   task.status === 'ready' ? '●' : '○'}
                </text>

                {/* Task name */}
                <text
                  x={14}
                  y={MARGIN_TOP + index * ROW_HEIGHT + ROW_HEIGHT / 2 + 4}
                  fontSize={12}
                  fill={isSelected ? '#2563eb' : task.status === 'done' ? '#9CA3AF' : '#374151'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                  textDecoration={task.status === 'done' ? 'line-through' : 'none'}
                >
                  {task.level > 0 && (
                    <tspan dx={task.level * 10}> </tspan>
                  )}
                  {task.name.length > 16 ? task.name.slice(0, 16) + '...' : task.name}
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

                {/* Task bar - use resource color if assigned */}
                {(() => {
                  const resourceInfo = getResourceInfo(task, project);
                  const barColor = resourceInfo ? resourceInfo.color : task.color;
                  const fillColor = showRiskHeatmap && layout.riskLevel ? RISK_COLORS[layout.riskLevel] : barColor;
                  return task.isMilestone ? (
                    <polygon
                      points={`${MARGIN_LEFT + layout.x},${y + BAR_HEIGHT / 2} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE},${y} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE * 2},${y + BAR_HEIGHT / 2} ${MARGIN_LEFT + layout.x + MILESTONE_SIZE},${y + BAR_HEIGHT}`}
                      fill={fillColor}
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
                      fill={fillColor}
                      opacity={task.isSummary ? 0.7 : 0.9}
                      stroke={isCritical ? '#DC2626' : 'none'}
                      strokeWidth={isCritical ? 2 : 0}
                    />
                  );
                })()}

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

                {/* Status indicator (waiting/blocked tasks) */}
                {task.status === 'waiting' && (
                  <text
                    x={MARGIN_LEFT + layout.x + 2}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize={10}
                    fill="#F59E0B"
                  >
                    ⏳
                  </text>
                )}
                {task.status === 'on_hold' && (
                  <text
                    x={MARGIN_LEFT + layout.x + 2}
                    y={y + BAR_HEIGHT / 2 + 4}
                    fontSize={10}
                    fill="#EF4444"
                  >
                    ⏸
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

        {/* Dependency lines */}
        {showDependencies && (
          <g className="gantt-dependencies">
            {renderDependencyLines(flatTasks, barLayouts, projectStart, dayWidth)}
          </g>
        )}

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

        {/* Hover popup showing resource info */}
        {hoveredBar && (() => {
          const lines = [hoveredBar.task.name];
          if (hoveredBar.resource) {
            lines.push(`Resource: ${hoveredBar.resource.name}`);
          } else {
            lines.push('No resource assigned');
          }
          lines.push(`Progress: ${hoveredBar.task.progress}%`);
          lines.push(`${hoveredBar.task.startDate} → ${hoveredBar.task.endDate}`);

          const popupWidth = 180;
          const lineHeight = 14;
          const padding = 6;
          const popupHeight = lines.length * lineHeight + padding * 2;
          const popupX = Math.min(Math.max(hoveredBar.x, 0), svgWidth - popupWidth);
          const popupY = Math.max(hoveredBar.y - popupHeight - 4, 0);

          return (
            <g className="gantt-hover-popup" pointerEvents="none">
              <rect x={popupX + 2} y={popupY + 2} width={popupWidth} height={popupHeight} rx={4} fill="rgba(0,0,0,0.15)" />
              <rect x={popupX} y={popupY} width={popupWidth} height={popupHeight} rx={4} fill="#1f2937" stroke="#374151" strokeWidth={1} />
              {lines.map((text, i) => (
                <text
                  key={i}
                  x={popupX + padding}
                  y={popupY + padding + (i + 1) * lineHeight - 3}
                  fontSize={10}
                  fill={i === 0 ? '#f9fafb' : '#d1d5db'}
                  fontWeight={i === 0 ? 'bold' : 'normal'}
                >
                  {text}
                </text>
              ))}
              {hoveredBar.resource && (
                <circle cx={popupX + popupWidth - padding - 6} cy={popupY + padding + lineHeight - 3} r={4} fill={hoveredBar.resource.color} />
              )}
            </g>
          );
        })()}
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
      const iso = toISO(date);
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
      const iso = toISO(date);
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
      const iso = toISO(current);
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

// ─── Dependency Line Rendering ────────────────────────────────────────────

/**
 * Render dependency lines between tasks.
 * Draws arrows from predecessor to successor based on dependency type.
 */
function renderDependencyLines(
  flatTasks: WBSTask[],
  barLayouts: BarLayout[],
  _projectStart: string,
  _dayWidth: number,
): React.ReactNode[] {
  const lines: React.ReactNode[] = [];
  const taskIndexMap = new Map<string, number>();
  flatTasks.forEach((task, index) => taskIndexMap.set(task.id, index));

  flatTasks.forEach((task, taskIdx) => {
    task.dependencies.forEach((dep, depIdx) => {
      const predIdx = taskIndexMap.get(dep.predecessorId);
      if (predIdx === undefined) return;

      const predLayout = barLayouts[predIdx];
      const succLayout = barLayouts[taskIdx];
      const predRowY = MARGIN_TOP + predIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const succRowY = MARGIN_TOP + taskIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      // Calculate connection points based on dependency type
      let x1: number, y1: number, x2: number, y2: number;

      switch (dep.type) {
        case 'FS': // Finish-to-Start
          x1 = MARGIN_LEFT + predLayout.x + predLayout.width;
          y1 = predRowY;
          x2 = MARGIN_LEFT + succLayout.x;
          y2 = succRowY;
          break;
        case 'SS': // Start-to-Start
          x1 = MARGIN_LEFT + predLayout.x;
          y1 = predRowY;
          x2 = MARGIN_LEFT + succLayout.x;
          y2 = succRowY;
          break;
        case 'FF': // Finish-to-Finish
          x1 = MARGIN_LEFT + predLayout.x + predLayout.width;
          y1 = predRowY;
          x2 = MARGIN_LEFT + succLayout.x + succLayout.width;
          y2 = succRowY;
          break;
        case 'SF': // Start-to-Finish
          x1 = MARGIN_LEFT + predLayout.x;
          y1 = predRowY;
          x2 = MARGIN_LEFT + succLayout.x + succLayout.width;
          y2 = succRowY;
          break;
        default:
          return;
      }

      // Create path with elbow
      const midX = Math.max(x1, x2) + 10;
      const path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;

      lines.push(
        <g key={`${task.id}-dep-${depIdx}`}>
          <path
            d={path}
            fill="none"
            stroke="#9CA3AF"
            strokeWidth={1.5}
            markerEnd="url(#gantt-arrowhead)"
          />
        </g>,
      );
    });
  });

  return lines;
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


