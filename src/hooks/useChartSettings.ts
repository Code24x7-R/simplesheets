// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Hook for persisting chart settings across sessions.
 * Stores last-used chart configuration in localStorage.
 */

import { useState, useCallback } from 'react';
import type { ChartType, LegendPosition } from '../types';

/**
 * Chart settings that persist between dialog sessions.
 */
export interface ChartSettings {
  /** Last used chart type. */
  type: ChartType;
  /** Last used legend position. */
  legendPosition: LegendPosition;
  /** Last used chart title (template). */
  title: string;
  /** Last used x-axis label. */
  xAxisLabel: string;
  /** Last used y-axis label. */
  yAxisLabel: string;
  /** Last used chart width. */
  width: number;
  /** Last used chart height. */
  height: number;
}

const STORAGE_KEY = 'simplesheets:chart-settings';

const DEFAULT_SETTINGS: ChartSettings = {
  type: 'bar',
  legendPosition: 'bottom',
  title: 'Chart Title',
  xAxisLabel: '',
  yAxisLabel: '',
  width: 400,
  height: 300,
};

/**
 * Loads chart settings from localStorage.
 */
function loadSettings(): ChartSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Saves chart settings to localStorage.
 */
function saveSettings(settings: ChartSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Hook for managing persistent chart settings.
 */
export function useChartSettings() {
  const [settings, setSettings] = useState<ChartSettings>(loadSettings);

  const updateSettings = useCallback((partial: Partial<ChartSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
