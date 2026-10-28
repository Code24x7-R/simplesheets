// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * File System Access helpers.
 *
 * Provides a feature-detected native file picker (Chromium) with a graceful
 * fallback to the existing hidden `<input type=file>` flow for browsers that
 * do not implement the API.
 */

import { ACCEPT_ALL } from './fileTypes';
import type { Workbook } from '../types';

/** Whether the browser supports the File System Access API. */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export interface PickedFile {
  file: File;
  handle?: FileSystemFileHandle;
}

/** Accept map shared by the native picker. */
const PICKER_TYPES: FilePickerAcceptType[] = [
  {
    description: 'Spreadsheets and SimpleSheets documents',
    accept: {
      'application/json': ['.ssjson', '.json'],
      'text/csv': ['.csv', '.tsv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx', '.xls'],
    },
  },
];

/**
 * Open the native file picker and return the selected file (and its handle,
 * when available). Returns null when the user cancels.
 *
 * Throws for non-cancel failures (e.g. a security error).
 */
export async function pickFileWithHandle(): Promise<PickedFile | null> {
  if (!supportsFileSystemAccess()) return null;

  const handles = await window.showOpenFilePicker!({
    multiple: false,
    types: PICKER_TYPES,
  });

  const handle = handles[0];
  if (!handle) return null;

  const file = await handle.getFile();
  return { file, handle };
}

/**
 * Re-open a previously retained file handle: request read permission if
 * needed and return the current File. Returns null when permission is denied
 * or the handle is no longer valid.
 */
export async function readFileFromHandle(handle: FileSystemFileHandle): Promise<File | null> {
  try {
    let permission: PermissionState = 'prompt';
    if (handle.queryPermission) {
      permission = await handle.queryPermission({ mode: 'read' });
    }
    if (permission === 'prompt' && handle.requestPermission) {
      permission = await handle.requestPermission({ mode: 'read' });
    }
    if (permission !== 'granted') return null;
    return await handle.getFile();
  } catch {
    return null;
  }
}

/** Fallback file picker for browsers without File System Access. */
export function pickFileWithInput(onFile: (file: File) => void): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = ACCEPT_ALL;
  input.style.display = 'none';
  input.onchange = () => {
    const file = input.files?.[0];
    input.remove();
    if (file) onFile(file);
  };
  document.body.appendChild(input);
  input.click();
}

/** Whether the browser supports the native save picker. */
export function supportsSaveFilePicker(): boolean {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

/**
 * Open the native save picker and return a writable handle. Returns null when
 * the user cancels.
 */
export async function saveWithFilePicker(suggestedName: string): Promise<FileSystemFileHandle | null> {
  if (!supportsSaveFilePicker()) return null;
  try {
    return await window.showSaveFilePicker!({ suggestedName });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

/** Serialize a workbook to the pretty-printed native `.ssjson` format. */
export function serializeWorkbook(workbook: Workbook): string {
  return JSON.stringify(workbook, null, 2);
}

/**
 * Write a workbook JSON string to a retained file handle. Returns false on
 * write failure (e.g. revoked permission).
 */
export async function writeWorkbookToHandle(handle: FileSystemFileHandle, json: string): Promise<boolean> {
  try {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}
