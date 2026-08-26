// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * File I/O Helpers for Cloud Open Workflow
 *
 * Provides utilities for reading files from the native file picker.
 * The download side lives in webShare.ts (shared between Save to File and
 * the Web Share API fallback).
 */

import type { Workbook } from '../types';
import { importJson } from '../services/jsonService';

/**
 * Read a File object and return its text contents.
 *
 * @param file - The File to read (from an <input type="file">).
 * @returns Promise resolving to the file's text content.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text === 'string') {
        resolve(text);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsText(file);
  });
}

/**
 * Read a File and parse it as a Workbook.
 * Validates the structure using the existing importJson validator.
 *
 * @param file - The File to read.
 * @returns Promise resolving to the parsed Workbook.
 * @throws Error if the file is not valid JSON or not a valid workbook.
 */
export async function readWorkbookFile(file: File): Promise<Workbook> {
  const text = await readFileAsText(file);
  const result = importJson(text);
  if (!result.success || !result.workbook) {
    throw new Error(result.error ?? 'Invalid workbook file');
  }
  return result.workbook;
}

/**
 * Accepted file extensions for the open file picker.
 * Includes .ssjson (SimpleSheets native) and generic .json.
 */
export const ACCEPTED_FILE_TYPES = '.ssjson,.json,application/json';
