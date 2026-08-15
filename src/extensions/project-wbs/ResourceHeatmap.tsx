// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Resource Heatmap View
 *
 * Calendar-style view showing resource allocation over time.
 * Each row is a resource, each column is a day.
 * Color intensity indicates allocation percentage.
 */

import { useMemo, useState, useCallback } from 'react';
import type { Project, Resource, WBSTask } from '../types';
import { isWorkingDay } from './calendar';

interface ResourceHeatmapProps {
  project: Project;
}

interface ResourceAllocation {
  resource: Resource;
  allocations: Map<string, number>; // date string → percentage allocated
}

// Helper to convert ISO date string to Date object
function isoToDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

// Helper to convert Date object to ISO date string
function dateToIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Number of days to show at once
const DAYS_PER_VIEW = 30;

export function ResourceHeatmap({ project }: ResourceHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ resourceId: string; date: string } | null>(null);
  const [viewStartDate, setViewStartDate] = useState<string>(project.startDate);

  // Helper function to check task allocation
  // Returns the resource's availability as the allocation amount
  // (e.g., 50% availability = 50% allocation when assigned to a task)
  const checkTaskAllocation = useCallback(
    (task: WBSTask, resource: Resource, dateStr: string): number => {
      let allocation = 0;
      if (task.responsibleResourceId === resource.id) {
        if (task.startDate <= dateStr && dateStr <= task.endDate) {
          // Use resource availability as the allocation percentage
          allocation += resource.availability;
        }
      }
      for (const child of task.children) {
        allocation += checkTaskAllocation(child, resource, dateStr);
      }
      return allocation;
    },
    []
  );

  // Calculate visible date range based on viewStartDate
  const visibleDateRange = useMemo(() => {
    const startDate = isoToDate(viewStartDate);
    const dates: string[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < DAYS_PER_VIEW; i++) {
      dates.push(dateToIso(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [viewStartDate]);

  // Calculate allocation for each resource on each visible date
  const allocations = useMemo((): ResourceAllocation[] => {
    return project.resources.map((resource) => {
      const allocationMap = new Map<string, number>();

      for (const dateStr of visibleDateRange) {
        if (!isWorkingDay(dateStr, project.calendar)) continue;

        let totalAllocation = 0;

        // Sum allocation from all tasks assigned to this resource
        for (const task of project.wbs) {
          totalAllocation += checkTaskAllocation(task, resource, dateStr);
        }

        // Cap at 150% to show over-allocation
        allocationMap.set(dateStr, Math.min(totalAllocation, 150));
      }

      return { resource, allocations: allocationMap };
    });
  }, [project, visibleDateRange, checkTaskAllocation]);

  // Navigation handlers
  const navigatePrevious = useCallback(() => {
    const newDate = isoToDate(viewStartDate);
    newDate.setDate(newDate.getDate() - DAYS_PER_VIEW);
    setViewStartDate(dateToIso(newDate));
  }, [viewStartDate]);

  const navigateNext = useCallback(() => {
    const newDate = isoToDate(viewStartDate);
    newDate.setDate(newDate.getDate() + DAYS_PER_VIEW);
    setViewStartDate(dateToIso(newDate));
  }, [viewStartDate]);

  const navigateToday = useCallback(() => {
    setViewStartDate(project.startDate);
  }, [project.startDate]);

  const jumpToMonth = useCallback((months: number) => {
    const newDate = isoToDate(viewStartDate);
    newDate.setMonth(newDate.getMonth() + months);
    setViewStartDate(dateToIso(newDate));
  }, [viewStartDate]);

  // Get color based on allocation percentage
  function getAllocationColor(percentage: number): string {
    if (percentage === 0) return 'bg-gray-50';
    if (percentage <= 25) return 'bg-green-100';
    if (percentage <= 50) return 'bg-green-200';
    if (percentage <= 75) return 'bg-yellow-200';
    if (percentage <= 100) return 'bg-orange-200';
    return 'bg-red-300'; // Over-allocated
  }

  // Get day of week for a date string (0=Sun, 6=Sat)
  function getDayOfWeek(dateStr: string): number {
    return isoToDate(dateStr).getDay();
  }

  // Check if date is a weekend
  function isWeekend(dateStr: string): boolean {
    const day = getDayOfWeek(dateStr);
    return day === 0 || day === 6;
  }

  // Get month labels for the header
  const monthLabels = useMemo(() => {
    const labels: { month: string; colSpan: number }[] = [];
    let currentMonth = '';
    let count = 0;

    for (const dateStr of visibleDateRange) {
      const date = isoToDate(dateStr);
      const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      if (month !== currentMonth) {
        if (count > 0) labels[labels.length - 1].colSpan = count;
        labels.push({ month, colSpan: 1 });
        currentMonth = month;
        count = 1;
      } else {
        count++;
      }
    }
    if (count > 0 && labels.length > 0) labels[labels.length - 1].colSpan = count;

    return labels;
  }, [visibleDateRange]);

  // Format view range for display
  const viewRangeLabel = useMemo(() => {
    const start = isoToDate(visibleDateRange[0]);
    const end = isoToDate(visibleDateRange[visibleDateRange.length - 1]);
    const startStr = start.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} — ${endStr}`;
  }, [visibleDateRange]);

  if (project.resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-lg font-medium">No Resources Defined</p>
        <p className="text-sm mt-2">Add resources to see allocation heatmap</p>
      </div>
    );
  }

  if (visibleDateRange.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-4xl mb-4">📅</div>
        <p className="text-lg font-medium">No Date Range</p>
        <p className="text-sm mt-2">Set project start and end dates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto bg-white">
      {/* Navigation Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Navigation controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => jumpToMonth(-1)}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              title="Previous month"
            >
              ◀
            </button>
            <button
              onClick={navigatePrevious}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              title="Previous 30 days"
            >
              ‹
            </button>
            <button
              onClick={navigateToday}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 font-medium"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              title="Next 30 days"
            >
              ›
            </button>
            <button
              onClick={() => jumpToMonth(1)}
              className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              title="Next month"
            >
              ▶
            </button>
          </div>
          <div className="text-sm font-medium text-gray-700">{viewRangeLabel}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => jumpToMonth(-3)}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
              title="Previous quarter"
            >
              -3M
            </button>
            <button
              onClick={() => jumpToMonth(3)}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
              title="Next quarter"
            >
              +3M
            </button>
          </div>
        </div>

        {/* Month labels */}
        <div className="flex">
          <div className="w-40 flex-shrink-0 border-r border-gray-200 bg-gray-50" />
          <div className="flex">
            {monthLabels.map((label, idx) => (
              <div
                key={idx}
                className="text-xs text-gray-600 font-medium border-r border-gray-100 text-center"
                style={{ width: `${label.colSpan * 28}px` }}
              >
                {label.month}
              </div>
            ))}
          </div>
        </div>

        {/* Day numbers */}
        <div className="flex">
          <div className="w-40 flex-shrink-0 border-r border-gray-200 bg-gray-50" />
          <div className="flex">
            {visibleDateRange.map((dateStr, idx) => {
              const weekend = isWeekend(dateStr);
              const isWorking = isWorkingDay(dateStr, project.calendar);
              return (
                <div
                  key={idx}
                  className={`w-7 text-[10px] text-center border-r border-gray-100 py-1 ${
                    weekend ? 'bg-gray-100 text-gray-400' : isWorking ? 'text-gray-600' : 'bg-gray-50 text-gray-400'
                  }`}
                >
                  <div>{isoToDate(dateStr).getDate()}</div>
                  <div className="text-[8px] text-gray-400">{['S', 'M', 'T', 'W', 'T', 'F', 'S'][getDayOfWeek(dateStr)]}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource rows */}
      <div className="flex-1 overflow-x-auto">
        {allocations.map(({ resource, allocations: allocationMap }) => (
          <div key={resource.id} className="flex hover:bg-gray-50">
            {/* Resource name */}
            <div className="w-40 flex-shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2 sticky left-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: resource.color }}
                />
                <span className="text-sm font-medium text-gray-800 truncate">
                  {resource.name}
                </span>
              </div>
              <div className="text-xs text-gray-500">{resource.role} ({resource.availability}%)</div>
            </div>

            {/* Allocation cells */}
            <div className="flex">
              {visibleDateRange.map((dateStr, idx) => {
                const pct = allocationMap.get(dateStr) ?? 0;
                const weekend = isWeekend(dateStr);
                const isWorking = isWorkingDay(dateStr, project.calendar);
                const isHovered =
                  hoveredCell?.resourceId === resource.id && hoveredCell?.date === dateStr;

                return (
                  <div
                    key={idx}
                    className={`w-7 h-10 border-r border-gray-100 cursor-pointer transition-colors flex items-center justify-center ${
                      getAllocationColor(pct)
                    } ${weekend ? 'opacity-60' : ''} ${!isWorking && !weekend ? 'opacity-80' : ''} ${
                      isHovered ? 'ring-2 ring-blue-400 z-10' : ''
                    }`}
                    onMouseEnter={() => setHoveredCell({ resourceId: resource.id, date: dateStr })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${resource.name} - ${dateStr}: ${pct}% allocated`}
                  >
                    {pct > 0 && (
                      <span className="text-[9px] font-medium text-gray-700">{pct}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span className="font-medium">Allocation:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-50 border border-gray-200" />
            <span>0%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-100" />
            <span>1-25%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-green-200" />
            <span>26-50%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-yellow-200" />
            <span>51-75%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-orange-200" />
            <span>76-100%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-red-300" />
            <span>Over-allocated</span>
          </div>
          {hoveredCell && (() => {
            const resourceAlloc = allocations.find((a) => a.resource.id === hoveredCell.resourceId);
            const pct = resourceAlloc?.allocations.get(hoveredCell.date) ?? 0;
            return (
              <span className="ml-4 text-blue-600">
                {resourceAlloc?.resource.name} — {hoveredCell.date}: {pct}% allocated
              </span>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
