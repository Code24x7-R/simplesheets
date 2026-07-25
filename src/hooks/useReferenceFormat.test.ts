import { renderHook, act } from '@testing-library/react';
import { useReferenceFormat, toR1C1, formatCellRef } from './useReferenceFormat';

describe('useReferenceFormat', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to A1 format', () => {
    const { result } = renderHook(() => useReferenceFormat());
    expect(result.current.format).toBe('A1');
  });

  it('toggles between A1 and R1C1', () => {
    const { result } = renderHook(() => useReferenceFormat());
    expect(result.current.format).toBe('A1');
    act(() => result.current.toggle());
    expect(result.current.format).toBe('R1C1');
    act(() => result.current.toggle());
    expect(result.current.format).toBe('A1');
  });

  it('persists format to localStorage', () => {
    const { result } = renderHook(() => useReferenceFormat());
    act(() => result.current.toggle());
    expect(localStorage.getItem('simplesheets-reference-format')).toBe('R1C1');
  });

  it('restores format from localStorage', () => {
    localStorage.setItem('simplesheets-reference-format', 'R1C1');
    const { result } = renderHook(() => useReferenceFormat());
    expect(result.current.format).toBe('R1C1');
  });
});

describe('toR1C1', () => {
  it('converts origin correctly', () => {
    expect(toR1C1(0, 0)).toBe('R1C1');
  });

  it('converts arbitrary positions', () => {
    expect(toR1C1(2, 2)).toBe('R3C3');
    expect(toR1C1(0, 25)).toBe('R1C26');
    expect(toR1C1(99, 0)).toBe('R100C1');
  });
});

describe('formatCellRef', () => {
  it('formats in A1 mode', () => {
    expect(formatCellRef(0, 0, 'A1')).toBe('A1');
    expect(formatCellRef(1, 1, 'A1')).toBe('B2');
    expect(formatCellRef(0, 25, 'A1')).toBe('Z1');
    expect(formatCellRef(0, 26, 'A1')).toBe('AA1');
  });

  it('formats in R1C1 mode', () => {
    expect(formatCellRef(0, 0, 'R1C1')).toBe('R1C1');
    expect(formatCellRef(1, 1, 'R1C1')).toBe('R2C2');
    expect(formatCellRef(0, 25, 'R1C1')).toBe('R1C26');
    expect(formatCellRef(0, 26, 'R1C1')).toBe('R1C27');
  });
});
