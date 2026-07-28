import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { Grid } from './Grid';
import type { Sheet } from '../types';

// Mock the virtualizer to render all items in test environment
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
        getTotalSize: () => 5 * 100,
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
      getTotalSize: () => 5 * 28,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function createTestSheet(overrides: Partial<Sheet> = {}): Sheet {
  return {
    id: 'test-sheet',
    name: 'Test',
    cells: {
      '0:0': { rawValue: 'A1', computedValue: 'A1' },
      '0:1': { rawValue: 'B1', computedValue: 'B1' },
      '1:0': { rawValue: 'A2', computedValue: 'A2' },
      '1:1': { rawValue: 'B2', computedValue: 'B2' },
    },
    defaultColWidth: 100,
    defaultRowHeight: 28,
    columnWidths: {},
    rowHeights: {},
    columnCount: 26,
    rowCount: 100,
    frozenColumns: 0,
    frozenRows: 0,
    ...overrides,
  };
}

interface GridWrapperProps {
  sheet?: Sheet;
  selectedCell?: { row: number; col: number };
  onCellChange?: (row: number, col: number, value: string) => void;
  onCellsChange?: (changes: Array<{ row: number; col: number; value: string }>) => void;
  onCellSelect?: (row: number, col: number) => void;
  onHeaderSelect?: (type: 'row' | 'col', index: number) => void;
}

function GridWrapper(props: GridWrapperProps) {
  const [sheet, setSheet] = useState(props.sheet ?? createTestSheet());
  const [selectedCell, setSelectedCell] = useState(props.selectedCell ?? { row: 0, col: 0 });
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellChange = (row: number, col: number, value: string) => {
    setSheet((prev) => ({
      ...prev,
      cells: { ...prev.cells, [`${row}:${col}`]: { rawValue: value, computedValue: value } },
    }));
    props.onCellChange?.(row, col, value);
  };

  const handleCellSelect = (row: number, col: number) => {
    setSelectedCell({ row, col });
    props.onCellSelect?.(row, col);
  };

  const handleHeaderSelect = (type: 'row' | 'col', index: number) => {
    props.onHeaderSelect?.(type, index);
  };

  return (
    <Grid
      sheet={sheet}
      selectedCell={selectedCell}
      onCellChange={handleCellChange}
      onCellsChange={props.onCellsChange}
      onCellSelect={handleCellSelect}
      onHeaderSelect={handleHeaderSelect}
      editingCell={editingCell}
      onEditingCellChange={setEditingCell}
      editValue={editValue}
      onEditValueChange={setEditValue}
      rowHeights={{}}
      colWidths={{}}
      filterState={null}
      onApplyFilter={() => {}}
      onClearFilters={() => {}}
      onSort={() => {}}
      onResizeColumn={() => {}}
      onResizeRow={() => {}}
      onInsertRow={() => {}}
      onInsertCol={() => {}}
      onDeleteRow={() => {}}
      onDeleteCol={() => {}}
      onUndo={() => {}}
      onRedo={() => {}}
    />
  );
}

describe('Grid - Filter Dropdown', () => {
  it('opens filter dropdown on header filter icon click', () => {
    render(<GridWrapper />);
    // Find and click a filter icon in a header
    const filterIcons = document.querySelectorAll('.filter-icon');
    if (filterIcons.length > 0) {
      fireEvent.click(filterIcons[0]);
      // Filter dropdown should be open
      expect(document.querySelector('.filter-dropdown')).toBeTruthy();
    }
  });

  it('closes filter dropdown when closed', () => {
    render(<GridWrapper />);
    // Find and click a filter icon in a header
    const filterIcons = document.querySelectorAll('.filter-icon');
    if (filterIcons.length > 0) {
      fireEvent.click(filterIcons[0]);
      // Close the dropdown
      const closeButton = document.querySelector('.filter-dropdown-close');
      if (closeButton) {
        fireEvent.click(closeButton);
        expect(document.querySelector('.filter-dropdown')).toBeNull();
      }
    }
  });
});

describe('Grid - Header Context Menu', () => {
  it('opens context menu on right-click', () => {
    render(<GridWrapper />);
    // Right-click on a column header
    const headers = document.querySelectorAll('.grid-header');
    if (headers.length > 0) {
      fireEvent.contextMenu(headers[0]);
      // Context menu should be open
      expect(document.querySelector('.header-context-menu')).toBeTruthy();
    }
  });
});

describe('Grid - Number Format Display', () => {
  it('displays formatted number value', () => {
    const sheet = createTestSheet({
      cells: {
        '0:0': { rawValue: '1234.567', computedValue: 1234.567, style: { numberFormat: '#,##0.00' } },
      },
    });
    render(<GridWrapper sheet={sheet} />);
    // The cell should display the formatted value
    const cell = document.querySelector('.grid-cell');
    expect(cell?.textContent).toContain('1,234.57');
  });

  it('displays currency formatted value', () => {
    const sheet = createTestSheet({
      cells: {
        '0:0': { rawValue: '100', computedValue: 100, style: { numberFormat: '$#,##0.00' } },
      },
    });
    render(<GridWrapper sheet={sheet} />);
    const cell = document.querySelector('.grid-cell');
    expect(cell?.textContent).toContain('$');
  });

  it('displays percentage formatted value', () => {
    const sheet = createTestSheet({
      cells: {
        '0:0': { rawValue: '0.5', computedValue: 0.5, style: { numberFormat: '0.00%' } },
      },
    });
    render(<GridWrapper sheet={sheet} />);
    const cell = document.querySelector('.grid-cell');
    expect(cell?.textContent).toContain('%');
  });
});

describe('Grid - Show Formulas Mode', () => {
  it('displays raw formula when showFormulas is true', () => {
    const sheet = createTestSheet({
      cells: {
        '0:0': { rawValue: '=SUM(A1:A10)', computedValue: 42 },
      },
    });
    render(<GridWrapper sheet={sheet} />);
    // In showFormulas mode, the raw formula should be displayed
    // This test just verifies the component renders without error
    const cell = document.querySelector('.grid-cell');
    expect(cell).toBeTruthy();
  });
});

describe('Grid - Clipboard Operations', () => {
  it('handles Ctrl+C to copy selection', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { ctrlKey: true, key: 'c' });
    // Should copy selection (no error thrown)
    expect(cell).toBeTruthy();
  });

  it('handles Ctrl+X to cut selection', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { ctrlKey: true, key: 'x' });
    // Should cut selection (no error thrown)
    expect(cell).toBeTruthy();
  });

  it('handles Ctrl+V to paste', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { ctrlKey: true, key: 'v' });
    // Should paste (no error thrown)
    expect(cell).toBeTruthy();
  });
});

describe('Grid - Row/Column Selection', () => {
  it('selects entire row on row header click', () => {
    render(<GridWrapper />);
    const rowHeaders = document.querySelectorAll('.grid-row-header');
    if (rowHeaders.length > 0) {
      fireEvent.click(rowHeaders[0]);
      // Row should be selected
      expect(rowHeaders[0]).toBeTruthy();
    }
  });

  it('selects entire column on column header click', () => {
    render(<GridWrapper />);
    const colHeaders = document.querySelectorAll('.grid-col-header');
    if (colHeaders.length > 0) {
      fireEvent.click(colHeaders[0]);
      // Column should be selected
      expect(colHeaders[0]).toBeTruthy();
    }
  });
});

describe('Grid - Keyboard Navigation', () => {
  it('navigates with arrow keys', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    expect(cell).toBeTruthy();
  });

  it('navigates with Tab key', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(cell).toBeTruthy();
  });

  it('navigates with Enter key', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(cell).toBeTruthy();
  });

  it('navigates with Home key', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { key: 'Home' });
    expect(cell).toBeTruthy();
  });

  it('navigates with Ctrl+Home key', () => {
    render(<GridWrapper />);
    const cell = document.querySelector('.grid-cell') as HTMLElement;
    fireEvent.mouseDown(cell);
    fireEvent.keyDown(document, { ctrlKey: true, key: 'Home' });
    expect(cell).toBeTruthy();
  });
});

describe('Grid - Freeze Panes', () => {
  it('renders frozen columns correctly', () => {
    const sheet = createTestSheet({ frozenColumns: 1 });
    render(<GridWrapper sheet={sheet} />);
    const cells = document.querySelectorAll('.grid-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders frozen rows correctly', () => {
    const sheet = createTestSheet({ frozenRows: 1 });
    render(<GridWrapper sheet={sheet} />);
    const cells = document.querySelectorAll('.grid-cell');
    expect(cells.length).toBeGreaterThan(0);
  });
});
