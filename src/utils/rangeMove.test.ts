// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { computeRangeMove } from './rangeMove';
import type { Selection } from '../types';

describe('computeRangeMove', () => {
  describe('basic move', () => {
    it('computes move for a single cell', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 0, endCol: 0,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, 2, 3);
      expect(result.sourceRow).toBe(0);
      expect(result.sourceCol).toBe(0);
      expect(result.targetRow).toBe(2);
      expect(result.targetCol).toBe(3);
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(1);
    });

    it('computes move for a 2x2 range', () => {
      const selection: Selection = {
        startRow: 1, startCol: 1, endRow: 2, endCol: 2,
        anchorRow: 1, anchorCol: 1, type: 'cell',
      };
      const result = computeRangeMove(selection, 5, 5);
      expect(result.sourceRow).toBe(1);
      expect(result.sourceCol).toBe(1);
      expect(result.targetRow).toBe(5);
      expect(result.targetCol).toBe(5);
      expect(result.rowCount).toBe(2);
      expect(result.colCount).toBe(2);
    });

    it('computes move for a 1x3 row', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 0, endCol: 2,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, 10, 0);
      expect(result.sourceRow).toBe(0);
      expect(result.sourceCol).toBe(0);
      expect(result.targetRow).toBe(10);
      expect(result.targetCol).toBe(0);
      expect(result.rowCount).toBe(1);
      expect(result.colCount).toBe(3);
    });

    it('computes move for a 3x1 column', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 2, endCol: 0,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, 0, 5);
      expect(result.sourceRow).toBe(0);
      expect(result.sourceCol).toBe(0);
      expect(result.targetRow).toBe(0);
      expect(result.targetCol).toBe(5);
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(1);
    });
  });

  describe('move with reversed selection', () => {
    it('handles selection where start > end (reversed)', () => {
      const selection: Selection = {
        startRow: 5, startCol: 5, endRow: 3, endCol: 3,
        anchorRow: 5, anchorCol: 5, type: 'cell',
      };
      const result = computeRangeMove(selection, 0, 0);
      expect(result.sourceRow).toBe(3);
      expect(result.sourceCol).toBe(3);
      expect(result.targetRow).toBe(0);
      expect(result.targetCol).toBe(0);
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(3);
    });
  });

  describe('move with negative offset', () => {
    it('moves range up and left', () => {
      const selection: Selection = {
        startRow: 5, startCol: 5, endRow: 7, endCol: 7,
        anchorRow: 5, anchorCol: 5, type: 'cell',
      };
      const result = computeRangeMove(selection, 0, 0);
      expect(result.sourceRow).toBe(5);
      expect(result.sourceCol).toBe(5);
      expect(result.targetRow).toBe(0);
      expect(result.targetCol).toBe(0);
    });
  });

  describe('move in place', () => {
    it('returns same source and target when dropped on same cell', () => {
      const selection: Selection = {
        startRow: 2, startCol: 2, endRow: 4, endCol: 4,
        anchorRow: 2, anchorCol: 2, type: 'cell',
      };
      const result = computeRangeMove(selection, 2, 2);
      expect(result.sourceRow).toBe(2);
      expect(result.sourceCol).toBe(2);
      expect(result.targetRow).toBe(2);
      expect(result.targetCol).toBe(2);
    });
  });

  describe('row/column selection types', () => {
    it('handles row selection', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 2, endCol: 25,
        anchorRow: 0, anchorCol: 0, type: 'row',
      };
      const result = computeRangeMove(selection, 10, 0);
      expect(result.sourceRow).toBe(0);
      expect(result.sourceCol).toBe(0);
      expect(result.targetRow).toBe(10);
      expect(result.targetCol).toBe(0);
      expect(result.rowCount).toBe(3);
      expect(result.colCount).toBe(26);
    });

    it('handles column selection', () => {
      const selection: Selection = {
        startRow: 0, startCol: 1, endRow: 999, endCol: 3,
        anchorRow: 0, anchorCol: 1, type: 'col',
      };
      const result = computeRangeMove(selection, 0, 10);
      expect(result.sourceRow).toBe(0);
      expect(result.sourceCol).toBe(1);
      expect(result.targetRow).toBe(0);
      expect(result.targetCol).toBe(10);
      expect(result.rowCount).toBe(1000);
      expect(result.colCount).toBe(3);
    });
  });

  describe('bounds validation', () => {
    it('clamps target to non-negative', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, -5, -5);
      expect(result.targetRow).toBe(0);
      expect(result.targetCol).toBe(0);
    });
  });

  describe('cell key generation', () => {
    it('generates correct source cell keys', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, 5, 5);
      expect(result.sourceKeys).toEqual(['0:0', '0:1', '1:0', '1:1']);
    });

    it('generates correct target cell keys', () => {
      const selection: Selection = {
        startRow: 0, startCol: 0, endRow: 1, endCol: 1,
        anchorRow: 0, anchorCol: 0, type: 'cell',
      };
      const result = computeRangeMove(selection, 5, 5);
      expect(result.targetKeys).toEqual(['5:5', '5:6', '6:5', '6:6']);
    });

    it('generates matching source and target keys', () => {
      const selection: Selection = {
        startRow: 2, startCol: 3, endRow: 3, endCol: 4,
        anchorRow: 2, anchorCol: 3, type: 'cell',
      };
      const result = computeRangeMove(selection, 10, 10);
      expect(result.sourceKeys.length).toBe(result.targetKeys.length);
      expect(result.sourceKeys.length).toBe(4); // 2x2 range
    });
  });

  describe('offset calculation', () => {
    it('computes correct row and col offsets', () => {
      const selection: Selection = {
        startRow: 5, startCol: 5, endRow: 7, endCol: 7,
        anchorRow: 5, anchorCol: 5, type: 'cell',
      };
      const result = computeRangeMove(selection, 10, 12);
      expect(result.rowOffset).toBe(5);
      expect(result.colOffset).toBe(7);
    });

    it('computes negative offsets', () => {
      const selection: Selection = {
        startRow: 10, startCol: 10, endRow: 12, endCol: 12,
        anchorRow: 10, anchorCol: 10, type: 'cell',
      };
      const result = computeRangeMove(selection, 5, 5);
      expect(result.rowOffset).toBe(-5);
      expect(result.colOffset).toBe(-5);
    });
  });
});
