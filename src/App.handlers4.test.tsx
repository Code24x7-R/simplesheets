import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

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

describe('App - Clipboard Menu Actions', () => {
  it('Edit → Copy dispatches copy event', () => {
    render(<App />);
    // First select a cell to ensure selection is not null
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const handler = jest.fn();
    window.addEventListener('simplesheets:copy', handler);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Copy'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:copy', handler);
  });

  it('Edit → Cut dispatches cut event', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const handler = jest.fn();
    window.addEventListener('simplesheets:cut', handler);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Cut'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:cut', handler);
  });

  it('Edit → Paste dispatches paste event', () => {
    render(<App />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    const handler = jest.fn();
    window.addEventListener('simplesheets:paste', handler);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Paste'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:paste', handler);
  });
});



describe('App - Export Menu Actions', () => {
  it('File → Export → Excel dispatches export excel event', () => {
    render(<App />);
    const handler = jest.fn();
    window.addEventListener('simplesheets:export-excel', handler);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('Excel (.xlsx)'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:export-excel', handler);
  });

  it('File → Export → CSV dispatches export csv event', () => {
    render(<App />);
    const handler = jest.fn();
    window.addEventListener('simplesheets:export-csv', handler);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('CSV (.csv)'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:export-csv', handler);
  });

  it('File → Export → JSON dispatches export json event', () => {
    render(<App />);
    const handler = jest.fn();
    window.addEventListener('simplesheets:export-json', handler);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('JSON (.json)'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:export-json', handler);
  });

  it('File → Export → PDF dispatches export pdf event', () => {
    render(<App />);
    const handler = jest.fn();
    window.addEventListener('simplesheets:export-pdf', handler);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByText('PDF (.pdf)'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:export-pdf', handler);
  });
});

describe('App - Import Menu Actions', () => {
  it('File → Import → JSON dispatches import json event', () => {
    render(<App />);
    const handler = jest.fn();
    window.addEventListener('simplesheets:import-json', handler);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Import'));
    fireEvent.click(screen.getByText('JSON (.json)'));
    expect(handler).toHaveBeenCalled();
    window.removeEventListener('simplesheets:import-json', handler);
  });
});



describe('App - Find & Replace', () => {
  it('Edit → Find & Replace opens search/replace modal', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Find & Replace…'));
    expect(screen.getByText('Find & Replace')).toBeInTheDocument();
  });
});

describe('App - Load Demo', () => {
  it('File → Load Demo loads demo data', () => {
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Load Demo'));
    // Should load demo data (no error thrown)
    expect(screen.getByText('File')).toBeInTheDocument();
  });
});
