// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { renderHook, act } from '@testing-library/react';
import { useChartSettings } from './useChartSettings';

describe('useChartSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when nothing is stored', () => {
    const { result } = renderHook(() => useChartSettings());
    expect(result.current.settings.type).toBe('bar');
    expect(result.current.settings.legendPosition).toBe('bottom');
    expect(result.current.settings.width).toBe(400);
    expect(result.current.settings.height).toBe(300);
  });

  it('loads settings from localStorage', () => {
    localStorage.setItem('simplesheets:chart-settings', JSON.stringify({
      type: 'line',
      legendPosition: 'right',
      title: 'My Chart',
      width: 500,
      height: 350,
    }));

    const { result } = renderHook(() => useChartSettings());
    expect(result.current.settings.type).toBe('line');
    expect(result.current.settings.legendPosition).toBe('right');
    expect(result.current.settings.title).toBe('My Chart');
    expect(result.current.settings.width).toBe(500);
    expect(result.current.settings.height).toBe(350);
  });

  it('updates settings and persists to localStorage', () => {
    const { result } = renderHook(() => useChartSettings());

    act(() => {
      result.current.updateSettings({ type: 'pie', legendPosition: 'none' });
    });

    expect(result.current.settings.type).toBe('pie');
    expect(result.current.settings.legendPosition).toBe('none');

    // Check localStorage
    const stored = JSON.parse(localStorage.getItem('simplesheets:chart-settings') || '{}');
    expect(stored.type).toBe('pie');
    expect(stored.legendPosition).toBe('none');
  });

  it('preserves unmodified fields when updating', () => {
    const { result } = renderHook(() => useChartSettings());

    act(() => {
      result.current.updateSettings({ type: 'area' });
    });

    // Other fields should remain at defaults
    expect(result.current.settings.type).toBe('area');
    expect(result.current.settings.legendPosition).toBe('bottom');
    expect(result.current.settings.width).toBe(400);
  });

  it('resets settings to defaults', () => {
    const { result } = renderHook(() => useChartSettings());

    act(() => {
      result.current.updateSettings({ type: 'scatter', width: 800 });
    });

    expect(result.current.settings.type).toBe('scatter');

    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings.type).toBe('bar');
    expect(result.current.settings.width).toBe(400);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('simplesheets:chart-settings', 'not valid json');

    const { result } = renderHook(() => useChartSettings());
    expect(result.current.settings.type).toBe('bar');
    expect(result.current.settings.legendPosition).toBe('bottom');
  });

  it('handles partial localStorage data', () => {
    localStorage.setItem('simplesheets:chart-settings', JSON.stringify({
      type: 'column',
    }));

    const { result } = renderHook(() => useChartSettings());
    expect(result.current.settings.type).toBe('column');
    // Missing fields should use defaults
    expect(result.current.settings.legendPosition).toBe('bottom');
    expect(result.current.settings.width).toBe(400);
  });
});
