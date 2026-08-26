// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { canShareFiles, downloadDocument, shareDocument, SSJSON_EXT } from './webShare';
import type { Workbook } from '../types';

/** Create a minimal workbook for testing. */
function makeWorkbook(): Workbook {
  return {
    id: 'test-wb',
    title: 'Test',
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
  };
}

describe('webShare', () => {
  // Keep track of any stubs we set so we can restore them.
  const originalShare = navigator.share;
  const originalCanShare = navigator.canShare;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    // jsdom doesn't implement URL.createObjectURL — stub it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    // Restore navigator methods
    Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: originalCanShare, configurable: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).createObjectURL = originalCreateObjectURL;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (URL as any).revokeObjectURL = originalRevokeObjectURL;
  });

  describe('canShareFiles', () => {
    it('returns false when navigator.share is undefined', () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      expect(canShareFiles()).toBe(false);
    });

    it('returns false when navigator.canShare is undefined', () => {
      Object.defineProperty(navigator, 'share', { value: jest.fn(), configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
      expect(canShareFiles()).toBe(false);
    });

    it('returns true when canShare reports file sharing is supported', () => {
      Object.defineProperty(navigator, 'share', { value: jest.fn(), configurable: true });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });
      expect(canShareFiles()).toBe(true);
    });

    it('returns false when canShare reports file sharing is not supported', () => {
      Object.defineProperty(navigator, 'share', { value: jest.fn(), configurable: true });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(false),
        configurable: true,
      });
      expect(canShareFiles()).toBe(false);
    });

    it('returns false when canShare throws', () => {
      Object.defineProperty(navigator, 'share', { value: jest.fn(), configurable: true });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockImplementation(() => { throw new Error('fail'); }),
        configurable: true,
      });
      expect(canShareFiles()).toBe(false);
    });
  });

  describe('downloadDocument', () => {
    it('creates an anchor element with the correct download attribute', () => {
      const wb = makeWorkbook();
      // createElement is called for the anchor; we spy on it
      const createSpy = jest.spyOn(document, 'createElement');
      downloadDocument(wb, 'MyBudget');

      // Find the anchor creation call
      const anchorInstance = createSpy.mock.results.find(
        (r) => r.type === 'return' && r.value.tagName === 'A',
      )?.value as HTMLAnchorElement | undefined;

      expect(anchorInstance).toBeDefined();
      expect(anchorInstance!.download).toBe(`MyBudget${SSJSON_EXT}`);
      createSpy.mockRestore();
    });

    it('appends .ssjson extension when not present', () => {
      const wb = makeWorkbook();
      const createSpy = jest.spyOn(document, 'createElement');
      downloadDocument(wb, 'Report');

      const anchorInstance = createSpy.mock.results.find(
        (r) => r.type === 'return' && r.value.tagName === 'A',
      )?.value as HTMLAnchorElement | undefined;

      expect(anchorInstance!.download).toBe(`Report${SSJSON_EXT}`);
      createSpy.mockRestore();
    });

    it('does not double the .ssjson extension when already present', () => {
      const wb = makeWorkbook();
      const createSpy = jest.spyOn(document, 'createElement');
      downloadDocument(wb, 'Report.ssjson');

      const anchorInstance = createSpy.mock.results.find(
        (r) => r.type === 'return' && r.value.tagName === 'A',
      )?.value as HTMLAnchorElement | undefined;

      expect(anchorInstance!.download).toBe('Report.ssjson');
      createSpy.mockRestore();
    });
  });

  describe('shareDocument', () => {
    it('returns "fallback" and triggers download when file sharing is not supported', async () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });

      const wb = makeWorkbook();
      const downloadSpy = jest.spyOn(document, 'createElement');

      const result = await shareDocument(wb, 'TestDoc');
      expect(result).toBe('fallback');
      // downloadDocument creates an anchor
      expect(downloadSpy).toHaveBeenCalledWith('a');
      downloadSpy.mockRestore();
    });

    it('returns "shared" when navigator.share resolves', async () => {
      Object.defineProperty(navigator, 'share', {
        value: jest.fn().mockResolvedValue(undefined),
        configurable: true,
      });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });

      const wb = makeWorkbook();
      const result = await shareDocument(wb, 'TestDoc');
      expect(result).toBe('shared');
      expect(navigator.share).toHaveBeenCalledWith(
        expect.objectContaining({ files: expect.any(Array), title: 'TestDoc' }),
      );
    });

    it('returns "cancelled" when navigator.share throws AbortError', async () => {
      Object.defineProperty(navigator, 'share', {
        value: jest.fn().mockRejectedValue(new DOMException('user cancelled', 'AbortError')),
        configurable: true,
      });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });

      const wb = makeWorkbook();
      const result = await shareDocument(wb, 'TestDoc');
      expect(result).toBe('cancelled');
    });

    it('re-throws non-AbortError errors', async () => {
      Object.defineProperty(navigator, 'share', {
        value: jest.fn().mockRejectedValue(new Error('network error')),
        configurable: true,
      });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });

      const wb = makeWorkbook();
      await expect(shareDocument(wb, 'TestDoc')).rejects.toThrow('network error');
    });

    it('uses the title as filename with .ssjson extension', async () => {
      Object.defineProperty(navigator, 'share', {
        value: jest.fn().mockResolvedValue(undefined),
        configurable: true,
      });
      Object.defineProperty(navigator, 'canShare', {
        value: jest.fn().mockReturnValue(true),
        configurable: true,
      });

      const wb = makeWorkbook();
      await shareDocument(wb, 'MyBudget');

      const shareCall = (navigator.share as jest.Mock).mock.calls[0][0];
      expect(shareCall.files[0].name).toBe(`MyBudget${SSJSON_EXT}`);
    });
  });
});
