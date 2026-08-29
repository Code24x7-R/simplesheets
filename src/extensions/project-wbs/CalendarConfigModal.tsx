// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Calendar Configuration Modal
 *
 * Modal dialog for configuring the project working calendar:
 * - Working days (Mon-Fri, Mon-Sat, etc.)
 * - Holiday dates
 * - Hours per day
 */

import { useState, useEffect } from 'react';
import type { WorkingCalendar } from '../types';

interface CalendarConfigModalProps {
  calendar: WorkingCalendar;
  onClose: () => void;
  onSave: (calendar: WorkingCalendar) => void;
}

const DAYS_OF_WEEK = [
  { id: 0, name: 'Sunday', short: 'Sun' },
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
];

const PRESETS = [
  { name: 'Monday–Friday', days: [1, 2, 3, 4, 5], hours: 8 },
  { name: 'Monday–Saturday', days: [1, 2, 3, 4, 5, 6], hours: 8 },
  { name: 'Sunday–Thursday', days: [0, 1, 2, 3, 4], hours: 8 },
  { name: '7 Days', days: [0, 1, 2, 3, 4, 5, 6], hours: 8 },
  { name: 'Shift Work (12h)', days: [1, 2, 3, 4, 5], hours: 12 },
];

export function CalendarConfigModal({ calendar, onClose, onSave }: CalendarConfigModalProps) {
  const [workingDays, setWorkingDays] = useState<number[]>(
    calendar.workingDays ? Array.from(calendar.workingDays) : [1, 2, 3, 4, 5]
  );
  const [holidays, setHolidays] = useState<string[]>(
    calendar.holidays ? Array.from(calendar.holidays) : []
  );
  const [hoursPerDay, setHoursPerDay] = useState(calendar.hoursPerDay ?? 8);
  const [newHoliday, setNewHoliday] = useState('');

  // Sync local state when the calendar prop changes (e.g. parent re-reads
  // the workbook and passes a fresh calendar object).
  useEffect(() => {
    setWorkingDays(calendar.workingDays ? Array.from(calendar.workingDays) : [1, 2, 3, 4, 5]);
    setHolidays(calendar.holidays ? Array.from(calendar.holidays) : []);
    setHoursPerDay(calendar.hoursPerDay ?? 8);
  }, [calendar]);

  useEffect(() => {
    // Set default date for new holiday on mount
    const today = new Date();
    setNewHoliday(today.toISOString().slice(0, 10));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDay(day: number) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    setWorkingDays(preset.days);
    setHoursPerDay(preset.hours);
  }

  function addHoliday() {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays((prev) => [...prev, newHoliday].sort());
      setNewHoliday('');
    }
  }

  function removeHoliday(date: string) {
    setHolidays((prev) => prev.filter((h) => h !== date));
  }

  function handleSave() {
    onSave({
      workingDays: new Set(workingDays),
      holidays: new Set(holidays),
      hoursPerDay,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" data-testid="calendar-config-modal">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Calendar Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Working Days */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Working Days
            </label>
            <div className="flex gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                    workingDays.includes(day.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={day.name}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>

          {/* Presets */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Hours per Day */}
          <div>
            <label htmlFor="hours-per-day" className="block text-sm font-medium text-gray-700 mb-2">
              Hours per Day: {hoursPerDay}
            </label>
            <input
              id="hours-per-day"
              type="range"
              min="1"
              max="24"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400">
              <span>1h</span>
              <span>12h</span>
              <span>24h</span>
            </div>
          </div>

          {/* Holidays */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Holidays
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={addHoliday}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Add
              </button>
            </div>
            {holidays.length > 0 && (
              <div className="max-h-32 overflow-auto border border-gray-200 rounded">
                {holidays.map((date) => (
                  <div
                    key={date}
                    className="flex items-center justify-between px-3 py-1 text-sm border-b border-gray-100 last:border-b-0"
                  >
                    <span>{date}</span>
                    <button
                      onClick={() => removeHoliday(date)}
                      className="text-red-500 hover:text-red-700 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {holidays.length === 0 && (
              <p className="text-sm text-gray-400">No holidays defined</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            Save Calendar
          </button>
        </div>
      </div>
    </div>
  );
}
