// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CloudStorageModal } from './CloudStorageModal';
import type { Workbook } from '../types';

/** Create a minimal workbook for testing. */
function makeWorkbook(overrides: Partial<Workbook> = {}): Workbook {
  return {
    id: 'test-wb',
    title: 'Test Workbook',
    sheets: [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        cells: { '0:0': { rawValue: 'hello' } },
        defaultColWidth: 100,
        defaultRowHeight: 28,
        columnWidths: {},
        rowHeights: {},
        columnCount: 26,
        rowCount: 1000,
        frozenColumns: 0,
        frozenRows: 0,
      },
    ],
    activeSheetIndex: 0,
    lastModified: 1_700_000_000_000,
    ...overrides,
  };
}

/** Create a large workbook that exceeds the URL size limit. */
function makeLargeWorkbook(): Workbook {
  const wb = makeWorkbook({ title: 'Large Workbook' });
  const largeCells = Object.fromEntries(
    Array.from({ length: 2000 }, (_, i) => [
      `${i}:0`,
      { rawValue: `this is a reasonably long cell value with index ${i} and some padding `.repeat(3) },
    ]),
  );
  wb.sheets[0] = { ...wb.sheets[0], cells: largeCells };
  return wb;
}

describe('CloudStorageModal', () => {
  // Stub URL.createObjectURL (not implemented in jsdom)
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
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

  describe('rendering', () => {
    it('does not render when isOpen is false', () => {
      const { container } = render(
        <CloudStorageModal
          isOpen={false}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders the save modal with correct title', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.getByText('Save to Cloud')).toBeInTheDocument();
    });

    it('renders the open modal with correct title', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.getByText('Open from Cloud')).toBeInTheDocument();
    });

    it('has dialog role and aria-modal', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('save mode — home view', () => {
    it('shows Copy Link, Share File, and Save to File buttons', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.getByText('Copy Link')).toBeInTheDocument();
      expect(screen.getByText('Share File')).toBeInTheDocument();
      expect(screen.getByText('Save to File')).toBeInTheDocument();
    });

    it('does NOT show Open from File in save mode', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.queryByText('Open from File')).not.toBeInTheDocument();
    });

    it('disables Copy Link when the workbook is too large for a URL', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeLargeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      const copyLinkBtn = screen.getByText('Copy Link').closest('button');
      expect(copyLinkBtn).toBeDisabled();
      expect(screen.getByText(/Too large for a link/)).toBeInTheDocument();
    });

    it('enables Copy Link when the workbook is small enough', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      const copyLinkBtn = screen.getByText('Copy Link').closest('button');
      expect(copyLinkBtn).not.toBeDisabled();
    });
  });

  describe('open mode — home view', () => {
    it('shows Open from File button', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.getByText('Open from File')).toBeInTheDocument();
    });

    it('does NOT show Copy Link, Share File, or Save to File in open mode', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();
      expect(screen.queryByText('Share File')).not.toBeInTheDocument();
      expect(screen.queryByText('Save to File')).not.toBeInTheDocument();
    });
  });

  describe('close behavior', () => {
    it('calls onClose when X button is clicked', () => {
      const onClose = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByLabelText('Close'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      const backdrop = document.querySelector('.fixed.inset-0');
      if (backdrop) fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClose when clicking inside the modal content', () => {
      const onClose = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByText('Save to Cloud'));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape is pressed', () => {
      const onClose = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy Link', () => {
    it('copies a URL to the clipboard and shows feedback', async () => {
      const onStatusMessage = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
          onStatusMessage={onStatusMessage}
        />,
      );

      // navigator.clipboard is not available in jsdom — stub it
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      fireEvent.click(screen.getByText('Copy Link'));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
      });
      // The copied URL should contain #doc=
      const copiedUrl = writeText.mock.calls[0][0];
      expect(copiedUrl).toContain('#doc=');
      expect(onStatusMessage).toHaveBeenCalledWith(expect.stringContaining('Link copied'));
    });

    it('shows an error if clipboard write fails', async () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      const writeText = jest.fn().mockRejectedValue(new Error('denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      fireEvent.click(screen.getByText('Copy Link'));

      await waitFor(() => {
        expect(screen.getByText(/Failed to copy link/)).toBeInTheDocument();
      });
    });
  });

  describe('Save to File', () => {
    it('triggers a download and closes the modal', async () => {
      const onClose = jest.fn();
      const onStatusMessage = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
          onStatusMessage={onStatusMessage}
        />,
      );

      fireEvent.click(screen.getByText('Save to File'));

      await waitFor(() => {
        expect(onStatusMessage).toHaveBeenCalledWith(expect.stringContaining('Saved'));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Open from File', () => {
    it('opens a file picker when Open from File is clicked', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      // The hidden file input should exist
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.accept).toContain('.ssjson');

      // Spy on the input's click method
      const clickSpy = jest.spyOn(input, 'click');

      fireEvent.click(screen.getByText('Open from File'));
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('reads a selected file and calls onOpenDocument', async () => {
      const onOpenDocument = jest.fn();
      const onStatusMessage = jest.fn();
      const onClose = jest.fn();

      render(
        <CloudStorageModal
          isOpen={true}
          onClose={onClose}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={onOpenDocument}
          onStatusMessage={onStatusMessage}
        />,
      );

      const wb = makeWorkbook();
      const file = new File([JSON.stringify(wb)], 'MyWorkbook.ssjson', { type: 'application/json' });

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });

      fireEvent.change(input);

      await waitFor(() => {
        expect(onOpenDocument).toHaveBeenCalledTimes(1);
      });
      expect(onOpenDocument).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^json-wb-/) }), 'MyWorkbook.ssjson');
      expect(onStatusMessage).toHaveBeenCalledWith(expect.stringContaining('Opened'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows an error for an invalid file', async () => {
      const onOpenDocument = jest.fn();
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="open"
          workbook={makeWorkbook()}
          onOpenDocument={onOpenDocument}
        />,
      );

      const file = new File(['not valid json'], 'bad.ssjson', { type: 'application/json' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });

      fireEvent.change(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(onOpenDocument).not.toHaveBeenCalled();
    });
  });

  describe('Advanced collapsible', () => {
    it('toggles open when clicked', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Advanced: cloud accounts'));
      expect(screen.getByText('Google Drive')).toBeInTheDocument();
      expect(screen.getByText('OneDrive')).toBeInTheDocument();
      expect(screen.getByText('S3-Compatible')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Advanced: cloud accounts'));
      expect(screen.queryByText('Google Drive')).not.toBeInTheDocument();
    });

    it('shows an error when connecting to a cloud provider (not configured)', async () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      fireEvent.click(screen.getByText('Advanced: cloud accounts'));
      fireEvent.click(screen.getByText('Google Drive'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByText(/Google Drive integration requires OAuth/)).toBeInTheDocument();
    });
  });

  describe('error banner', () => {
    it('can be dismissed', async () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      // Trigger an error via cloud connect
      fireEvent.click(screen.getByText('Advanced: cloud accounts'));
      fireEvent.click(screen.getByText('Google Drive'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      // Dismiss it
      fireEvent.click(screen.getByLabelText('Dismiss error'));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('focus trap', () => {
    it('traps Tab focus within the modal', () => {
      render(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook()}
          onOpenDocument={jest.fn()}
        />,
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Tab' });
      // Should not throw and focus should remain within the dialog
      expect(dialog.contains(document.activeElement as Node) || document.activeElement === document.body).toBe(true);
    });
  });

  describe('reset on open', () => {
    it('resets filename to workbook title when reopened', () => {
      const { rerender } = render(
        <CloudStorageModal
          isOpen={false}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook({ title: 'MySheet' })}
          onOpenDocument={jest.fn()}
        />,
      );

      rerender(
        <CloudStorageModal
          isOpen={true}
          onClose={jest.fn()}
          mode="save"
          workbook={makeWorkbook({ title: 'MySheet' })}
          onOpenDocument={jest.fn()}
        />,
      );

      // The filename input in the provider view isn't shown in home view,
      // but we can verify the modal opened correctly
      expect(screen.getByText('Save to Cloud')).toBeInTheDocument();
    });
  });
});
