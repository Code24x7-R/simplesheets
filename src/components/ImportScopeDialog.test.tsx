// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportScopeDialog } from './ImportScopeDialog';
import type { IncomingImport } from '../utils/importScope';
import type { Workbook } from '../types';

function makeImport(kind: IncomingImport['kind'], overrides: Partial<IncomingImport> = {}): IncomingImport {
  const workbook: Workbook = {
    id: 'wb-1',
    title: 'Imported',
    sheets: [
      {
        id: 's1',
        name: 'Sheet1',
        cells: { '0:0': { rawValue: 'a' }, '0:1': { rawValue: 'b' } },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 100,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: 1000,
  };
  return { workbook, fileName: 'data.csv', kind, detectedDelimiter: ',', ...overrides };
}

describe('ImportScopeDialog', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <ImportScopeDialog isOpen={false} imported={makeImport('csv')} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders scope options and summary', () => {
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('excel')} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.getByText('Replace workbook')).toBeInTheDocument();
    expect(screen.getByText('Add as new sheet(s)')).toBeInTheDocument();
    expect(screen.getByText('Insert at active cell')).toBeInTheDocument();
    expect(screen.getByText(/1 sheet · 2 cells/)).toBeInTheDocument();
  });

  it('shows CSV options only for CSV imports', () => {
    const { rerender } = render(
      <ImportScopeDialog isOpen={true} imported={makeImport('csv')} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.getByText('Delimiter')).toBeInTheDocument();
    expect(screen.getByText('First row is a header')).toBeInTheDocument();

    rerender(
      <ImportScopeDialog isOpen={true} imported={makeImport('json')} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.queryByText('Delimiter')).not.toBeInTheDocument();
  });

  it('confirms with default replace scope', () => {
    const onConfirm = jest.fn();
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('csv')} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith({ scope: 'replace', hasHeader: false, delimiter: ',' });
  });

  it('confirms add-as-new-sheets scope', () => {
    const onConfirm = jest.fn();
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('excel')} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(/Add as new sheet/));
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ scope: 'new-sheets' }));
  });

  it('confirms insert scope with active-cell default', () => {
    const onConfirm = jest.fn();
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('json')} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    fireEvent.click(screen.getByLabelText(/Insert at active cell/));
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ scope: 'insert' }));
  });

  it('passes CSV header and delimiter choices through', () => {
    const onConfirm = jest.fn();
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('csv', { detectedDelimiter: ',' })} onConfirm={onConfirm} onCancel={jest.fn()} />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: ';' } });
    fireEvent.click(screen.getByLabelText('First row is a header'));
    fireEvent.click(screen.getByText('Import'));
    expect(onConfirm).toHaveBeenCalledWith({ scope: 'replace', hasHeader: true, delimiter: ';' });
  });

  it('cancels via Escape and Cancel button', () => {
    const onCancel = jest.fn();
    render(
      <ImportScopeDialog isOpen={true} imported={makeImport('csv')} onConfirm={jest.fn()} onCancel={onCancel} />,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
