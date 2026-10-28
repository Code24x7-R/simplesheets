// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Ambient declarations for the File System Access API, which is not yet
 * declared in TypeScript's lib.dom. Only the parts SimpleSheets uses are
 * declared here (open picker + handle permission helpers).
 */

interface FileSystemFileHandle {
  /** Query the current read/write permission state. */
  queryPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  /** Prompt the user for read/write permission. */
  requestPermission?(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface OpenFilePickerOptions {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

interface Window {
  /** Open the native file picker and return writable file handles. */
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>;
}
