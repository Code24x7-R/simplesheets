// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Page orientation options.
 */
export type PageOrientation = 'portrait' | 'landscape';

/**
 * Page size presets.
 */
export type PageSize = 'A4' | 'Letter' | 'Legal';

/**
 * Scaling options for print output.
 */
export type PrintScaling = 'fit-to-page' | 'actual-size' | 'fit-to-width';

/**
 * Inclusive, zero-based cell bounds describing the range to print.
 */
export interface PrintRange {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

/**
 * Page setup configuration.
 */
export interface PrintSetup {
  /** Page orientation. */
  orientation: PageOrientation;
  /** Paper size. */
  pageSize: PageSize;
  /** Scaling mode. */
  scaling: PrintScaling;
  /** Margins in millimeters. */
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  /**
   * Whether to print row/column headings. Defaults to false so the output
   * contains only the sheet data (no A/B/C column letters or 1/2/3 row numbers).
   */
  showHeaders: boolean;
  /**
   * Explicit range of cells to print. `null` means the sheet's used range.
   * Borders come from the cells' own styles (a "table style" is cell borders),
   * so no generic grid pattern is drawn unless a range has borders applied.
   */
  range: PrintRange | null;
  /**
   * Footer text printed at the bottom of every page. Supports `{page}` and
   * `{total}` placeholders. An empty string disables the footer.
   */
  footer: string;
}

const DEFAULT_SETUP: PrintSetup = {
  orientation: 'portrait',
  pageSize: 'A4',
  // Fit-to-width renders at the sheet's natural size and flows across pages,
  // which keeps the text readable. Fit-to-page would shrink tall sheets until
  // the text is only a few pixels tall.
  scaling: 'fit-to-width',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
  showHeaders: false,
  range: null,
  footer: 'Page {page} of {total}',
};

interface PrintSetupContextValue {
  setup: PrintSetup;
  updateSetup: (updates: Partial<PrintSetup>) => void;
  updateMargins: (margins: Partial<PrintSetup['margins']>) => void;
  resetSetup: () => void;
}

const PrintSetupContext = createContext<PrintSetupContextValue | null>(null);

/**
 * Provider for page setup settings that affect PDF export and print preview.
 */
export function PrintSetupProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<PrintSetup>(DEFAULT_SETUP);

  const updateSetup = useCallback((updates: Partial<PrintSetup>) => {
    setSetup((prev) => ({ ...prev, ...updates }));
  }, []);

  const updateMargins = useCallback((margins: Partial<PrintSetup['margins']>) => {
    setSetup((prev) => ({
      ...prev,
      margins: { ...prev.margins, ...margins },
    }));
  }, []);

  const resetSetup = useCallback(() => {
    setSetup(DEFAULT_SETUP);
  }, []);

  return (
    <PrintSetupContext.Provider value={{ setup, updateSetup, updateMargins, resetSetup }}>
      {children}
    </PrintSetupContext.Provider>
  );
}

/**
 * Hook to access print setup context.
 */
export function usePrintSetup(): PrintSetupContextValue {
  const ctx = useContext(PrintSetupContext);
  if (!ctx) throw new Error('usePrintSetup must be used within PrintSetupProvider');
  return ctx;
}
