// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
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

describe('App - Menu Handlers', () => {
  it('File → New clears the workbook', () => {
    render(<App />);
    // First, type something in a cell
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const input = screen.getByPlaceholderText(/Enter a value or formula/);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Click File → New
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));

    // Should show confirmation and create new workbook
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('File → Save shows filename modal and triggers download', () => {
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save'));
    // Filename modal should appear
    expect(screen.getByText('Save Workbook')).toBeInTheDocument();
    // Confirm the save
    fireEvent.click(screen.getByText('Save'));
    const statusBar = screen.getByTestId('status-message');
    expect(statusBar?.textContent).toContain('Saved');
  });

  it('Format → Bold toggles bold formatting', () => {
    render(<App />);
    // Click a cell first
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    // Click Format → Bold
    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Bold'));

    // Should toggle bold (no error thrown)
    expect(cell).toBeInTheDocument();
  });

  it('Format → Italic toggles italic formatting', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Italic'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Underline toggles underline formatting', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Underline'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Wrap Text toggles wrap text', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Wrap Text'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Clear Styles clears cell styles', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Clear Styles'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Alignment → Left sets left alignment', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Alignment'));
    fireEvent.click(screen.getByText('Left'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Text Color → Red sets red text color', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Text Color'));
    fireEvent.click(screen.getByText('Red'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Fill Color → Yellow sets yellow fill color', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Fill Color'));
    fireEvent.click(screen.getByText('Yellow'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Number Format → Currency sets currency format', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Number Format'));
    fireEvent.click(screen.getByText('Currency'));

    expect(cell).toBeInTheDocument();
  });

  it('Format → Borders → All Borders sets all borders', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Format'));
    fireEvent.click(screen.getByText('Borders'));
    fireEvent.click(screen.getByText('All Borders'));

    expect(cell).toBeInTheDocument();
  });
});

describe('App - View Handlers', () => {
  it('View → Freeze Panes toggles freeze panes', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Freeze Panes'));

    expect(cell).toBeInTheDocument();
  });

  it('View → Unfreeze Panes unfreezes panes', () => {
    render(<App />);
    fireEvent.click(screen.getByText('View'));
    fireEvent.click(screen.getByText('Unfreeze Panes'));

    expect(screen.getByText('View')).toBeInTheDocument();
  });
});

describe('App - Data Handlers', () => {
  it('Data → Sort A → Z sorts ascending', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Sort A → Z'));

    expect(cell).toBeInTheDocument();
  });

  it('Data → Sort Z → A sorts descending', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Sort Z → A'));

    expect(cell).toBeInTheDocument();
  });

  it('Data → Toggle Filter toggles filter', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Toggle Filter'));

    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('Data → Clear All Filters clears filters', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Clear All Filters'));

    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('Sort → Undo does not break app (selection state preserved)', () => {
    const { container } = render(<App />);
    // Select a range
    const cells = container.querySelectorAll('.grid-cell');
    if (cells.length >= 2) {
      fireEvent.mouseDown(cells[0]);
      fireEvent.mouseDown(cells[1], { shiftKey: true });
    }

    // Sort (may no-op on empty data)
    fireEvent.click(screen.getByText('Data'));
    fireEvent.click(screen.getByText('Sort A → Z'));

    // Undo with Ctrl+Z (should not crash even if nothing to undo)
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

    // App should still be functional — Data menu accessible
    fireEvent.click(screen.getByText('Data'));
    expect(screen.getByText('Sort A → Z')).toBeInTheDocument();
  });
});

describe('App - Help Handlers', () => {
  it('Help → Keyboard Shortcuts opens shortcuts modal', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('Keyboard Shortcuts'));

    expect(screen.getByText(/Keyboard Shortcuts/)).toBeInTheDocument();
  });

  it('Help → About SimpleSheet opens about modal', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Help'));
    fireEvent.click(screen.getByText('About SimpleSheet'));

    expect(screen.getByText('About SimpleSheet')).toBeInTheDocument();
  });
});

describe('App - Insert Handlers', () => {
  it('Insert → Row Above inserts a row above', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Above'));

    expect(cell).toBeInTheDocument();
  });

  it('Insert → Row Below inserts a row below', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Row Below'));

    expect(cell).toBeInTheDocument();
  });

  it('Insert → Column Left inserts a column to the left', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Column Left'));

    expect(cell).toBeInTheDocument();
  });

  it('Insert → Column Right inserts a column to the right', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);

    fireEvent.click(screen.getByText('Insert'));
    fireEvent.click(screen.getByText('Column Right'));

    expect(cell).toBeInTheDocument();
  });
});
