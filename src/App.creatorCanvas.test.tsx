// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson

import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { syncCreatorCanvasToWorkbook } from './extensions/creator-canvas/sheetConverter';
import { createStarterCreatorCanvasModel } from './extensions/creator-canvas/starterSeed';
import type { Workbook } from './types';

// Mock pdfExport/excelExport to avoid ESM issues in tests
jest.mock('./services/pdfExport', () => ({
  downloadPdf: jest.fn(() => Promise.resolve()),
}));
jest.mock('./services/excelExport', () => ({
  downloadExcel: jest.fn(),
  exportExcel: jest.fn(() => new Blob()),
}));

// Mock the virtualizer
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { horizontal?: boolean }) => {
    if (options.horizontal) {
      return {
        getVirtualItems: () => {
          const items = [];
          for (let i = 0; i < 5; i++) {
            items.push({ index: i, start: i * 100, size: 100, end: (i + 1) * 100 });
          }
          return items;
        },
        getTotalSize: () => 500,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => {
        const items = [];
        for (let i = 0; i < 5; i++) {
          items.push({ index: i, start: i * 28, size: 28, end: (i + 1) * 28 });
        }
        return items;
      },
      getTotalSize: () => 140,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

describe('App Creator Canvas Integration', () => {
  it('creates a starter Creator Canvas from the Extensions menu and shows the canvas view', async () => {
    render(<App />);

    // Trigger New Creator Canvas
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Creator Canvas'));
    fireEvent.click(screen.getByText('New Creator Canvas'));

    // The Starter seed nodes and Canvas tab should be present
    expect(await screen.findByRole('button', { name: '🎨 Canvas' })).toBeInTheDocument();
    expect(await screen.findByText('Welcome to Canvas!')).toBeInTheDocument();
    expect(screen.getByText('Reference & Links')).toBeInTheDocument();
    expect(screen.getByText('Plan Next Deliverable')).toBeInTheDocument();
  });

  it('switches between worksheet and Creator Canvas tab views', async () => {
    render(<App />);

    // Create a new canvas
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Creator Canvas'));
    fireEvent.click(screen.getByText('New Creator Canvas'));
    expect(await screen.findByText('Welcome to Canvas!')).toBeInTheDocument();

    // Switch back to normal sheet tab
    const sheetTab = screen.getByRole('button', { name: 'Sheet1' });
    fireEvent.click(sheetTab);

    // Grid should be active again, canvas view hidden
    expect(screen.queryByText('Welcome to Canvas!')).not.toBeInTheDocument();
    expect(document.querySelector('[tabindex="0"]')).toBeInTheDocument();

    // Switch back to Canvas tab
    const canvasTab = screen.getByRole('button', { name: '🎨 Canvas' });
    fireEvent.click(canvasTab);
    expect(screen.getByText('Welcome to Canvas!')).toBeInTheDocument();
  });

  it('detects imported Creator Canvas workbooks and displays the Canvas tab', () => {
    const seedModel = createStarterCreatorCanvasModel('imported-canvas', 'Imported Deck');
    const baseWorkbook: Workbook = {
      id: 'wb-1',
      title: 'Imported Project',
      sheets: [{ id: 'sheet-1', name: 'Sheet1', cells: {}, columnWidths: {}, rowHeights: {}, columnCount: 26, rowCount: 1000, frozenColumns: 0, frozenRows: 0, defaultColWidth: 100, defaultRowHeight: 24 }],
      activeSheetIndex: 0,
      lastModified: Date.now(),
    };
    const workbookWithCanvas = syncCreatorCanvasToWorkbook(baseWorkbook, seedModel);

    render(<App initialWorkbook={workbookWithCanvas} />);

    // The Canvas tab should be rendered automatically
    const canvasTab = screen.getByRole('button', { name: '🎨 Canvas' });
    expect(canvasTab).toBeInTheDocument();

    // Opening the canvas tab should reveal the model title and nodes
    fireEvent.click(canvasTab);
    expect(screen.getByText('Imported Deck')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Canvas!')).toBeInTheDocument();
  });

  it('clears canvas view and hides canvas tab on New Workbook', () => {
    render(<App />);

    // Create canvas
    fireEvent.click(screen.getByText('Extensions'));
    fireEvent.click(screen.getByText('Creator Canvas'));
    fireEvent.click(screen.getByText('New Creator Canvas'));
    expect(screen.getByRole('button', { name: '🎨 Canvas' })).toBeInTheDocument();

    // Create new blank workbook
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));

    // Canvas tab and canvas view should be gone
    expect(screen.queryByRole('button', { name: '🎨 Canvas' })).not.toBeInTheDocument();
    expect(screen.queryByText('Welcome to Canvas!')).not.toBeInTheDocument();
  });
});
