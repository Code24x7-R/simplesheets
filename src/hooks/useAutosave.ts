// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { useEffect, useRef } from 'react';
import type { Workbook } from '../types';
import { autosaveWorkbook } from '../services/storageService';

// Debounce delay in ms — avoids flooding localStorage on rapid changes
const AUTOSAVE_DEBOUNCE_MS = 500;

/**
 * Automatically persists the workbook to localStorage whenever it changes.
 * The save is debounced to avoid excessive writes during rapid editing.
 *
 * @param workbook - The workbook state to auto-save.
 */
export function useAutosave(workbook: Workbook): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip the first render to avoid saving the initial demo workbook unnecessarily
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Clear any pending debounce timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Debounce the save
    timerRef.current = setTimeout(() => {
      autosaveWorkbook(workbook);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [workbook]);
}
