// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { detectPattern, generateSeries, computeFillSeries } from './fillSeries';
import type { Cell } from '../types';

function makeCell(value: string): Cell {
  return { rawValue: value, computedValue: value };
}

describe('fillSeries', () => {
  describe('detectPattern', () => {
    describe('arithmetic series', () => {
      it('detects simple increment by 1', () => {
        const cells = [makeCell('1'), makeCell('2'), makeCell('3')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('arithmetic');
        expect(pattern.step).toBe(1);
      });

      it('detects increment by 2', () => {
        const cells = [makeCell('2'), makeCell('4'), makeCell('6')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('arithmetic');
        expect(pattern.step).toBe(2);
      });

      it('detects negative step', () => {
        const cells = [makeCell('10'), makeCell('8'), makeCell('6')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('arithmetic');
        expect(pattern.step).toBe(-2);
      });

      it('detects decimal step', () => {
        const cells = [makeCell('0.5'), makeCell('1.0'), makeCell('1.5')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('arithmetic');
        expect(pattern.step).toBe(0.5);
      });

      it('detects geometric series (2, 4, 8) even if differences vary', () => {
        const cells = [makeCell('2'), makeCell('4'), makeCell('8')];
        const pattern = detectPattern(cells);
        // 2, 4, 8 is geometric with ratio 2 (even though diffs are 2 and 4)
        expect(pattern.type).toBe('geometric');
        expect(pattern.ratio).toBe(2);
      });

      it('returns unknown for non-constant differences', () => {
        const cells = [makeCell('1'), makeCell('2'), makeCell('5')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('unknown');
      });
    });

    describe('geometric series', () => {
      it('detects ratio of 2', () => {
        const cells = [makeCell('1'), makeCell('2'), makeCell('4')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('geometric');
        expect(pattern.ratio).toBe(2);
      });

      it('detects ratio of 3', () => {
        const cells = [makeCell('3'), makeCell('9'), makeCell('27')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('geometric');
        expect(pattern.ratio).toBe(3);
      });

      it('detects ratio of 0.5', () => {
        const cells = [makeCell('16'), makeCell('8'), makeCell('4')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('geometric');
        expect(pattern.ratio).toBe(0.5);
      });

      it('returns unknown for zero values', () => {
        const cells = [makeCell('0'), makeCell('0'), makeCell('0')];
        const pattern = detectPattern(cells);
        // All zeros: arithmetic with step 0 (not geometric)
        expect(pattern.type).toBe('arithmetic');
      });

      it('returns unknown when some values are zero (geometric requires non-zero)', () => {
        const cells = [makeCell('0'), makeCell('1'), makeCell('2')];
        const pattern = detectPattern(cells);
        // Has zero so geometric is skipped, arithmetic diffs are 1,1
        expect(pattern.type).toBe('arithmetic');
        expect(pattern.step).toBe(1);
      });

      it('returns unknown for geometric with zero mixed in', () => {
        const cells = [makeCell('1'), makeCell('0'), makeCell('3')];
        const pattern = detectPattern(cells);
        // Zero present skips geometric, diffs are -1 and 3 (not constant)
        expect(pattern.type).toBe('unknown');
      });
    });

    describe('date series', () => {
      it('detects daily increment', () => {
        const cells = [makeCell('2024-01-01'), makeCell('2024-01-02'), makeCell('2024-01-03')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('date');
        expect(pattern.dateInterval).toBe(24 * 60 * 60 * 1000); // 1 day
      });

      it('detects weekly increment', () => {
        const cells = [makeCell('2024-01-01'), makeCell('2024-01-08'), makeCell('2024-01-15')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('date');
        expect(pattern.dateInterval).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
      });

      it('returns unknown for dates with zero interval', () => {
        const cells = [makeCell('2024-01-01'), makeCell('2024-01-01'), makeCell('2024-01-01')];
        const pattern = detectPattern(cells);
        // Zero interval is not a valid date pattern
        expect(pattern.type).toBe('unknown');
      });

      it('returns unknown for dates with inconsistent intervals', () => {
        const cells = [makeCell('2024-01-01'), makeCell('2024-01-02'), makeCell('2024-01-04')];
        const pattern = detectPattern(cells);
        // Intervals are 1 day and 2 days (not same)
        expect(pattern.type).toBe('unknown');
      });
    });

    describe('day of week pattern', () => {
      it('detects day sequence', () => {
        const cells = [makeCell('Mon'), makeCell('Tue'), makeCell('Wed')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('dayOfWeek');
      });

      it('detects full day names', () => {
        const cells = [makeCell('Monday'), makeCell('Tuesday'), makeCell('Wednesday')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('dayOfWeek');
      });

      it('wraps around Saturday to Sunday', () => {
        const cells = [makeCell('Fri'), makeCell('Sat'), makeCell('Sun')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('dayOfWeek');
      });

      it('returns unknown for non-sequential days', () => {
        const cells = [makeCell('Mon'), makeCell('Wed'), makeCell('Fri')];
        const pattern = detectPattern(cells);
        // Days don't increment by 1
        expect(pattern.type).toBe('unknown');
      });
    });

    describe('month of year pattern', () => {
      it('detects month sequence', () => {
        const cells = [makeCell('Jan'), makeCell('Feb'), makeCell('Mar')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('monthOfYear');
      });

      it('detects full month names', () => {
        const cells = [makeCell('January'), makeCell('February'), makeCell('March')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('monthOfYear');
      });

      it('wraps around December to January', () => {
        const cells = [makeCell('Nov'), makeCell('Dec'), makeCell('Jan')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('monthOfYear');
      });
    });

    describe('quarter pattern', () => {
      it('detects quarter sequence', () => {
        const cells = [makeCell('Q1'), makeCell('Q2'), makeCell('Q3')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('textSequence');
      });

      it('wraps around Q4 to Q1', () => {
        const cells = [makeCell('Q3'), makeCell('Q4'), makeCell('Q1')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('textSequence');
      });
    });

    describe('edge cases', () => {
      it('returns unknown for fewer than 3 cells', () => {
        const cells = [makeCell('1'), makeCell('2')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('unknown');
      });

      it('returns unknown for empty cells', () => {
        const cells: Cell[] = [];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('unknown');
      });

      it('returns unknown for mixed types', () => {
        const cells = [makeCell('1'), makeCell('hello'), makeCell('3')];
        const pattern = detectPattern(cells);
        expect(pattern.type).toBe('unknown');
      });
    });
  });

  describe('generateSeries', () => {
    it('generates arithmetic series', () => {
      const pattern = { type: 'arithmetic' as const, step: 2, originalValues: [1, 3, 5] };
      const result = generateSeries(pattern, 3);
      expect(result).toEqual(['7', '9', '11']);
    });

    it('generates geometric series', () => {
      const pattern = { type: 'geometric' as const, ratio: 2, originalValues: [3, 6, 12] };
      const result = generateSeries(pattern, 3);
      expect(result).toEqual(['24', '48', '96']);
    });

    it('generates date series', () => {
      const pattern = {
        type: 'date' as const,
        dateInterval: 24 * 60 * 60 * 1000,
        originalValues: ['2024-01-01', '2024-01-02', '2024-01-03'],
      };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['2024-01-04', '2024-01-05']);
    });

    it('generates day of week series', () => {
      const pattern = {
        type: 'dayOfWeek' as const,
        textSequence: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        textIndices: [1, 2, 3],
        originalValues: ['Mon', 'Tue', 'Wed'],
      };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['Thursday', 'Friday']);
    });

    it('wraps around day of week', () => {
      const pattern = {
        type: 'dayOfWeek' as const,
        textSequence: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        textIndices: [5, 6, 0],
        originalValues: ['Fri', 'Sat', 'Sun'],
      };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['Monday', 'Tuesday']);
    });

    it('returns empty array for count 0', () => {
      const pattern = { type: 'arithmetic' as const, step: 1, originalValues: [1, 2, 3] };
      const result = generateSeries(pattern, 0);
      expect(result).toEqual([]);
    });

    it('repeats last value for unknown pattern', () => {
      const pattern = { type: 'unknown' as const, originalValues: ['foo', 'bar', 'baz'] };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['baz', 'baz']);
    });

    it('generates month of year series', () => {
      const pattern = {
        type: 'monthOfYear' as const,
        textSequence: ['january', 'february', 'march', 'april', 'may', 'june',
          'july', 'august', 'september', 'october', 'november', 'december'],
        textIndices: [10, 11, 0],
        originalValues: ['Nov', 'Dec', 'Jan'],
      };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['February', 'March']);
    });

    it('generates text sequence series (quarters)', () => {
      const pattern = {
        type: 'textSequence' as const,
        textSequence: ['q1', 'q2', 'q3', 'q4'],
        textIndices: [2, 3, 0],
        originalValues: ['Q3', 'Q4', 'Q1'],
      };
      const result = generateSeries(pattern, 2);
      expect(result).toEqual(['q2', 'q3']);
    });

    it('returns empty array for negative count', () => {
      const pattern = { type: 'arithmetic' as const, step: 1, originalValues: [1, 2, 3] };
      const result = generateSeries(pattern, -1);
      expect(result).toEqual([]);
    });
  });

  describe('computeFillSeries', () => {
    it('returns null for fewer than 3 cells', () => {
      const cells = [makeCell('1'), makeCell('2')];
      const result = computeFillSeries(cells, 3);
      expect(result).toBeNull();
    });

    it('returns null for unknown pattern', () => {
      const cells = [makeCell('foo'), makeCell('bar'), makeCell('baz')];
      const result = computeFillSeries(cells, 3);
      expect(result).toBeNull();
    });

    it('computes arithmetic fill', () => {
      const cells = [makeCell('1'), makeCell('2'), makeCell('3')];
      const result = computeFillSeries(cells, 3);
      expect(result).toEqual(['4', '5', '6']);
    });

    it('computes geometric fill', () => {
      const cells = [makeCell('2'), makeCell('4'), makeCell('8')];
      const result = computeFillSeries(cells, 2);
      expect(result).toEqual(['16', '32']);
    });
  });
});
