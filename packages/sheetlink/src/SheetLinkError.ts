// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Error Hierarchy
 *
 * Typed errors for all SheetLink failure modes.
 */

import type { SheetLinkErrorCode } from './sheetLinkProtocol';

/**
 * Error class for SheetLink operations.
 * All SheetLink client rejections use this type.
 */
export class SheetLinkError extends Error {
  readonly code: SheetLinkErrorCode;
  readonly recoverable: boolean;

  constructor(code: SheetLinkErrorCode, message: string, recoverable: boolean) {
    super(message);
    this.name = 'SheetLinkError';
    this.code = code;
    this.recoverable = recoverable;

    // Maintains proper stack trace in V8 (Node/Chrome)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SheetLinkError);
    }
  }
}

// ─── Convenience Constructors ─────────────────────────────────────────────────

/** No provider tab is open. */
export function noProviderError(): SheetLinkError {
  return new SheetLinkError(
    'NO_PROVIDER',
    'No SimpleSheet tab is open. Please open a spreadsheet tab and try again.',
    true,
  );
}

/** Request timed out. */
export function timeoutError(operation: string): SheetLinkError {
  return new SheetLinkError(
    'TIMEOUT',
    `Request "${operation}" timed out. The provider tab may be unresponsive.`,
    true,
  );
}

/** Invalid cell range string. */
export function invalidRangeError(range: string): SheetLinkError {
  return new SheetLinkError(
    'INVALID_RANGE',
    `Invalid cell range: "${range}". Use A1 notation (e.g., "A1:B10").`,
    true,
  );
}

/** Sheet not found. */
export function sheetNotFoundError(sheetName: string): SheetLinkError {
  return new SheetLinkError(
    'SHEET_NOT_FOUND',
    `Sheet "${sheetName}" not found. Use listSheets() to see available sheets.`,
    true,
  );
}

/** Invalid cell reference. */
export function invalidRefError(ref: string): SheetLinkError {
  return new SheetLinkError(
    'INVALID_REF',
    `Invalid cell reference: "${ref}". Use A1 notation (e.g., "B3").`,
    true,
  );
}

/** Protocol version mismatch. */
export function protocolMismatchError(clientVersion: number, serverVersion: number): SheetLinkError {
  return new SheetLinkError(
    'PROTOCOL_MISMATCH',
    `Protocol version mismatch: client v${clientVersion}, server v${serverVersion}. Please refresh the provider tab.`,
    false,
  );
}

/** User cancelled the range picker. */
export function pickCancelledError(): SheetLinkError {
  return new SheetLinkError(
    'PICK_CANCELLED',
    'Range selection was cancelled.',
    true,
  );
}

/** Consumer tab was not authorized. */
export function notAuthorizedError(): SheetLinkError {
  return new SheetLinkError(
    'NOT_AUTHORIZED',
    'This tab was not authorized to access spreadsheet data. Click "Allow" when prompted in the SimpleSheet tab.',
    true,
  );
}
