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
}

const DEFAULT_SETUP: PrintSetup = {
  orientation: 'portrait',
  pageSize: 'A4',
  scaling: 'fit-to-page',
  margins: { top: 10, right: 10, bottom: 10, left: 10 },
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
