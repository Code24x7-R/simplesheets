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
        getVirtualItems: () => [{ index: 0, start: 0, size: 100, end: 100 }],
        getTotalSize: () => 100,
        scrollToIndex: jest.fn(),
        measure: jest.fn(),
      };
    }
    return {
      getVirtualItems: () => [{ index: 0, start: 0, size: 28, end: 28 }],
      getTotalSize: () => 28,
      scrollToIndex: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

function makeDirty(): void {
  const cell = document.querySelector('.grid-cell') as HTMLElement | null;
  if (cell) fireEvent.mouseDown(cell);
  const input = screen.getByPlaceholderText(/Enter a value or formula/);
  fireEvent.change(input, { target: { value: '123' } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('App save state & destructive-action confirm', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
    // jsdom does not implement URL.createObjectURL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = originalCreateObjectURL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = originalRevokeObjectURL;
  });

  it('shows "Not saved" on first load', () => {
    render(<App />);
    expect(screen.getByTestId('save-state').textContent).toBe('Not saved');
  });

  it('shows "Unsaved changes" after an edit', () => {
    render(<App />);
    makeDirty();
    expect(screen.getByTestId('save-state').textContent).toBe('Unsaved changes');
  });

  it('shows a saved timestamp after Save', async () => {
    render(<App />);
    // File → Save triggers an immediate .ssjson download and marks clean.
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('Save'));

    // Save marks the workbook clean and records a timestamp
    const saveState = await screen.findByTestId('save-state');
    expect(saveState.textContent).toContain('Saved ·');
  });

  it('does NOT prompt when creating a new workbook with no unsaved changes', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');
    render(<App />);
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('status-message').textContent).toContain('Created new workbook');
  });

  it('cancelling the confirm keeps the dirty workbook', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<App />);
    makeDirty();

    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByTestId('status-message').textContent).not.toContain('Created new workbook');
    expect(screen.getByTestId('save-state').textContent).toBe('Unsaved changes');
  });

  it('accepting the confirm discards and marks the new workbook clean', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);
    makeDirty();

    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByTestId('status-message').textContent).toContain('Created new workbook');
    expect(screen.getByTestId('save-state').textContent).toBe('Not saved');
  });

  it('snapshots the discarded session and restores it on next launch', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');

    // First app: edit, then discard via New (snapshot happens here).
    confirmSpy.mockReturnValueOnce(true);
    const first = render(<App />);
    makeDirty();
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));
    first.unmount();

    // Second app: the mount effect offers to restore the snapshot.
    confirmSpy.mockReturnValueOnce(true);
    render(<App />);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Restore your last session'));
    expect(screen.getByTestId('status-message').textContent).toContain('Restored previous session');
  });

  it('declining the restore clears the snapshot and keeps the current workbook', () => {
    const confirmSpy = jest.spyOn(window, 'confirm');

    // First app: discard a dirty workbook.
    confirmSpy.mockReturnValueOnce(true);
    const first = render(<App />);
    makeDirty();
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('New'));
    first.unmount();

    // Second app: decline the restore prompt.
    confirmSpy.mockReturnValueOnce(false);
    render(<App />);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Restore your last session'));
    expect(screen.getByTestId('status-message').textContent).not.toContain('Restored previous session');
  });
});
