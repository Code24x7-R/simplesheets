// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Protocol — Cross-Tab Communication Contract
 *
 * Defines all message types, operations, and error codes used for
 * same-origin browser tab-to-tab communication between SimpleSheets
 * (provider) and any consumer app (e.g., SimpleDocs).
 *
 * Transport: BroadcastChannel (same-origin).
 * Channel name: "simplesheets-link".
 */

// ─── Protocol Version ────────────────────────────────────────────────────────

export const SHEETLINK_PROTOCOL_VERSION = 1;

// ─── Cell Data ───────────────────────────────────────────────────────────────

/**
 * Represents a single cell's data as exposed to consumers.
 * Mirrors the internal Cell structure but only exposes safe, read-only fields.
 */
export interface CellData {
  /** The raw user input (e.g., "=SUM(A1:A3)" or "42" or "hello"). */
  rawValue: string;
  /** The computed/display value after formula evaluation. */
  computedValue: string | number | boolean | null;
  /** Whether this cell contains a formula (rawValue starts with "="). */
  isFormula: boolean;
}

/**
 * A cell reference identifying a specific cell.
 */
export interface CellRef {
  /** Zero-based row index. */
  row: number;
  /** Zero-based column index. */
  col: number;
  /** Whether the column is absolute ($A). */
  absoluteCol: boolean;
  /** Whether the row is absolute ($1). */
  absoluteRow: boolean;
  /** Sheet name qualifier, if this is a cross-sheet reference. */
  sheetName?: string;
}

// ─── Operations ────────────────────────────────────────────────────────────--

export type SheetLinkOperation =
  | 'getCellValue'
  | 'getRangeValues'
  | 'getFormula'
  | 'getFormulas'
  | 'listSheets'
  | 'getUsedRange'
  | 'getDependencies';

// ─── Errors ────────────────────────────────────────────────────────────────--

export type SheetLinkErrorCode =
  | 'NO_PROVIDER'
  | 'TIMEOUT'
  | 'INVALID_RANGE'
  | 'SHEET_NOT_FOUND'
  | 'INVALID_REF'
  | 'PROTOCOL_MISMATCH'
  | 'PICK_CANCELLED'
  | 'NOT_AUTHORIZED';

// ─── Messages ────────────────────────────────────────────────────────────────

/** Sent by client to discover/verify a provider tab. */
export interface SheetLinkHelloMessage {
  type: 'SSL_HELLO';
  protocolVersion: number;
  tabId: string;
}

/** Sent by provider in response to HELLO. */
export interface SheetLinkWelcomeMessage {
  type: 'SSL_WELCOME';
  protocolVersion: number;
  tabId: string;
}

/** Sent by client to request data or an action. */
export interface SheetLinkRequestMessage {
  type: 'SSL_REQUEST';
  corrId: string;
  operation: SheetLinkOperation;
  args: SheetLinkRequestArgs;
}

/** Sent by provider with the result of a request. */
export interface SheetLinkSuccessResponseMessage {
  type: 'SSL_RESPONSE';
  corrId: string;
  ok: true;
  result: unknown;
}

/** Sent by provider when a request fails. */
export interface SheetLinkErrorResponseMessage {
  type: 'SSL_RESPONSE';
  corrId: string;
  ok: false;
  error: SheetLinkErrorPayload;
}

/** Sent by client to subscribe to live range updates. */
export interface SheetLinkSubscribeMessage {
  type: 'SSL_SUBSCRIBE';
  subscriptionId: string;
  sheetName: string;
  range: string;
}

/** Sent by client to unsubscribe from live updates. */
export interface SheetLinkUnsubscribeMessage {
  type: 'SSL_UNSUBSCRIBE';
  subscriptionId: string;
}

/** Sent by provider with updated data for a subscription. */
export interface SheetLinkUpdateMessage {
  type: 'SSL_UPDATE';
  subscriptionId: string;
  data: CellData[][];
}

/** Sent by client to request range selection in the provider tab. */
export interface SheetLinkPickRangeRequestMessage {
  type: 'SSL_PICK_RANGE_REQUEST';
  corrId: string;
  prompt?: string;
}

/** Sent by provider with the user-selected range. */
export interface SheetLinkPickRangeResultMessage {
  type: 'SSL_PICK_RANGE_RESULT';
  corrId: string;
  range: string;
}

/** Sent by provider when the user cancels the range picker. */
export interface SheetLinkPickRangeCancelMessage {
  type: 'SSL_PICK_RANGE_CANCEL';
  corrId: string;
}

export type SheetLinkMessage =
  | SheetLinkHelloMessage
  | SheetLinkWelcomeMessage
  | SheetLinkRequestMessage
  | SheetLinkSuccessResponseMessage
  | SheetLinkErrorResponseMessage
  | SheetLinkSubscribeMessage
  | SheetLinkUnsubscribeMessage
  | SheetLinkUpdateMessage
  | SheetLinkPickRangeRequestMessage
  | SheetLinkPickRangeResultMessage
  | SheetLinkPickRangeCancelMessage;

// ─── Request Args ────────────────────────────────────────────────────────────

export type SheetLinkRequestArgs =
  | { sheetName: string; ref: string }       // getCellValue, getFormula, getDependencies
  | { sheetName: string; range: string }     // getRangeValues, getFormulas
  | { sheetName: string }                    // getUsedRange
  | Record<string, never>;                   // listSheets (no args)

// ─── Error Payload ───────────────────────────────────────────────────────────

export interface SheetLinkErrorPayload {
  code: SheetLinkErrorCode;
  message: string;
  recoverable: boolean;
}
