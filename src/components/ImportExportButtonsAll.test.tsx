// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportCsvButton } from './ImportCsvButton';
import { ExportCsvButton } from './ExportCsvButton';
import { ImportJsonButton } from './ImportJsonButton';
import { ExportJsonButton } from './ExportJsonButton';
import type { Workbook, Sheet } from '../types';

describe('Import/Export Buttons', () => {
  describe('ExportCsvButton', () => {
    it('renders export CSV button', () => {
      const sheet: Sheet = {
        id: 's1', name: 'Test', cells: {},
        defaultColWidth: 100, defaultRowHeight: 28,
        columnWidths: {}, rowHeights: {},
        columnCount: 26, rowCount: 100,
        frozenColumns: 0, frozenRows: 0,
      };
      render(<ExportCsvButton sheet={sheet} />);
      expect(screen.getByText(/Export CSV/)).toBeInTheDocument();
    });

    it('triggers download on click', () => {
      const sheet: Sheet = {
        id: 's1', name: 'Test', cells: {},
        defaultColWidth: 100, defaultRowHeight: 28,
        columnWidths: {}, rowHeights: {},
        columnCount: 26, rowCount: 100,
        frozenColumns: 0, frozenRows: 0,
      };

      // Mock URL.createObjectURL
      URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = jest.fn();

      render(<ExportCsvButton sheet={sheet} />);
      fireEvent.click(screen.getByText(/Export CSV/));
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('ExportJsonButton', () => {
    it('renders export JSON button', () => {
      const workbook: Workbook = {
        id: 'wb', title: 'Test', sheets: [],
        activeSheetIndex: 0, lastModified: Date.now(),
      };
      render(<ExportJsonButton workbook={workbook} />);
      expect(screen.getByText(/Export JSON/)).toBeInTheDocument();
    });
  });

  describe('ImportCsvButton', () => {
    it('renders import CSV button', () => {
      render(
        <ImportCsvButton onImport={jest.fn()} onError={jest.fn()} />
      );
      expect(screen.getByText(/Import CSV/)).toBeInTheDocument();
    });

    it('opens file picker on click', () => {
      const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click');
      render(
        <ImportCsvButton onImport={jest.fn()} onError={jest.fn()} />
      );
      fireEvent.click(screen.getByText(/Import CSV/));
      expect(clickSpy).toHaveBeenCalled();
      clickSpy.mockRestore();
    });
  });

  describe('ImportJsonButton', () => {
    it('renders import JSON button', () => {
      render(
        <ImportJsonButton onImport={jest.fn()} onError={jest.fn()} />
      );
      expect(screen.getByText(/Import JSON/)).toBeInTheDocument();
    });
  });
});
