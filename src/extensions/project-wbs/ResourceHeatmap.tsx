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

export function ResourceHeatmap({ project }: ResourceHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ resourceId: string; date: string } | null>(null);

  // Generate date range for the heatmap
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    let earliest = project.startDate;
    let latest = project.endDate;

    // Extend range to cover all tasks
    function findTaskDates(tasks: WBSTask[]) {
      for (const task of tasks) {
        if (task.startDate < earliest) earliest = task.startDate;
        if (task.endDate > latest) latest = task.endDate;
        findTaskDates(task.children);
      }
    }
    findTaskDates(project.wbs);

    // Generate all dates in range
    const start = isoToDate(earliest);
    const end = isoToDate(latest);
    const current = new Date(start);

    while (current <= end) {
      dates.push(dateToIso(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [project]);

  // Helper function to check task allocation
  const checkTaskAllocation = useCallback(
    (task: WBSTask, resourceId: string, dateStr: string): number => {
      let allocation = 0;
      if (task.responsibleResourceId === resourceId) {
        if (task.startDate <= dateStr && dateStr <= task.endDate) {
          allocation += 100;
        }
      }
      for (const child of task.children) {
        allocation += checkTaskAllocation(child, resourceId, dateStr);
      }
      return allocation;
    },
    []
  );

  // Calculate allocation for each resource on each date
  const allocations = useMemo((): ResourceAllocation[] => {
    return project.resources.map((resource) => {
      const allocationMap = new Map<string, number>();

      for (const dateStr of dateRange) {
        if (!isWorkingDay(dateStr, project.calendar)) continue;

        let totalAllocation = 0;

        // Sum allocation from all tasks assigned to this resource
        for (const task of project.wbs) {
          totalAllocation += checkTaskAllocation(task, resource.id, dateStr);
        }

        // Cap at 100% (resource can't be more than fully allocated)
        allocationMap.set(dateStr, Math.min(totalAllocation, 100));
      }

      return { resource, allocations: allocationMap };
    });
  }, [project, dateRange, checkTaskAllocation]);

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

    for (const dateStr of dateRange) {
      const date = isoToDate(dateStr);
      const month = date.toLocaleString('default', { month: 'short' });
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
  }, [dateRange]);

  if (project.resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <div className="text-4xl mb-4">📊</div>
        <p className="text-lg font-medium">No Resources Defined</p>
        <p className="text-sm mt-2">Add resources to see allocation heatmap</p>
      </div>
    );
  }

  if (dateRange.length === 0) {
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        {/* Month labels */}
        <div className="flex">
          <div className="w-40 flex-shrink-0 border-r border-gray-200 bg-gray-50" />
          <div className="flex">
            {monthLabels.map((label, idx) => (
              <div
                key={idx}
                className="text-xs text-gray-600 font-medium border-r border-gray-100 text-center"
                style={{ width: `${label.colSpan * 20}px` }}
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
            {dateRange.map((dateStr, idx) => {
              const weekend = isWeekend(dateStr);
              return (
                <div
                  key={idx}
                  className={`w-5 text-[10px] text-center border-r border-gray-100 ${
                    weekend ? 'bg-gray-100 text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {isoToDate(dateStr).getDate()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resource rows */}
      <div className="flex-1">
        {allocations.map(({ resource, allocations: allocationMap }) => (
          <div key={resource.id} className="flex hover:bg-gray-50">
            {/* Resource name */}
            <div className="w-40 flex-shrink-0 border-r border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: resource.color }}
                />
                <span className="text-sm font-medium text-gray-800 truncate">
                  {resource.name}
                </span>
              </div>
              <div className="text-xs text-gray-500">{resource.role}</div>
            </div>

            {/* Allocation cells */}
            <div className="flex">
              {dateRange.map((dateStr, idx) => {
                const pct = allocationMap.get(dateStr) ?? 0;
                const weekend = isWeekend(dateStr);
                const isHovered =
                  hoveredCell?.resourceId === resource.id && hoveredCell?.date === dateStr;

                return (
                  <div
                    key={idx}
                    className={`w-5 h-8 border-r border-gray-100 cursor-pointer transition-colors ${getAllocationColor(pct)} ${
                      weekend ? 'opacity-50' : ''
                    } ${isHovered ? 'ring-2 ring-blue-400' : ''}`}
                    onMouseEnter={() => setHoveredCell({ resourceId: resource.id, date: dateStr })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={`${resource.name} - ${dateStr}: ${pct}% allocated`}
                  />
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
          {hoveredCell && (
            <span className="ml-4 text-blue-600">
              {allocations.find((a) => a.resource.id === hoveredCell.resourceId)?.resource.name} —{' '}
              {hoveredCell.date}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
