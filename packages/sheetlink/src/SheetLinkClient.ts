// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Client
 *
 * Framework-agnostic consumer client for cross-tab spreadsheet data access.
 * Import this class in any app (e.g., SimpleDocs) to read live data from
 * an open SimpleSheet tab on the same origin.
 *
 * @example
 *   const client = new SheetLinkClient();
 *   await client.connect();
 *   const data = await client.getRangeValues('Sheet1', 'A1:D10');
 *   client.subscribe('Sheet1', 'A1:D10', newData => renderTable(newData));
 */

import type {
  SheetLinkMessage,
  SheetLinkRequestArgs,
  CellData,
  CellRef,
  SheetLinkErrorCode,
} from './sheetLinkProtocol';
import { SHEETLINK_PROTOCOL_VERSION } from './sheetLinkProtocol';
import {
  BroadcastChannelTransport,
  createSheetLinkTransport,
  type SheetLinkTransport,
} from './sheetLinkTransport';
import {
  SheetLinkError,
  noProviderError,
  timeoutError,
  invalidRangeError,
  sheetNotFoundError,
  invalidRefError,
  protocolMismatchError,
  pickCancelledError,
  notAuthorizedError,
} from './SheetLinkError';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateCallback = (data: CellData[][]) => void;
export type ConnectionCallback = (connected: boolean) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: SheetLinkError) => void;
  operation: string;
  timer: ReturnType<typeof setTimeout>;
}

interface Subscription {
  sheetName: string;
  range: string;
  callback: UpdateCallback;
}

export interface SheetLinkClientOptions {
  /** BroadcastChannel name. Must match the provider's channel name. */
  channelName?: string;
  /** Request timeout in milliseconds. Default: 5000. */
  timeoutMs?: number;
  /** Transport implementation (for testing). */
  transport?: SheetLinkTransport;
}

// ─── Connection State ─────────────────────────────────────────────────────────

type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected';

// ─── Client ───────────────────────────────────────────────────────────────────

export class SheetLinkClient {
  private transport: SheetLinkTransport | null = null;
  private channelName: string;
  private timeoutMs: number;
  private tabId: string;
  private state: ConnectionState = 'disconnected';
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private unsubscribeTransport: (() => void) | null = null;
  private corrIdCounter = 0;

  constructor(options: SheetLinkClientOptions = {}) {
    this.channelName = options.channelName ?? 'simplesheets-link';
    this.timeoutMs = options.timeoutMs ?? 5000;
    this.tabId = options.transport
      ? `tab-${Math.random().toString(36).slice(2, 10)}`
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Allow injected transport for testing
    if (options.transport) {
      this.transport = options.transport;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  /**
   * Connect to a provider tab.
   * Sends HELLO and waits for WELCOME.
   * @throws SheetLinkError if no provider responds within timeout.
   */
  async connect(): Promise<void> {
    if (this.state !== 'disconnected') return;

    if (!this.transport) {
      this.transport = createSheetLinkTransport(this.channelName);
    }

    this.unsubscribeTransport = this.transport.onMessage(msg => this.handleMessage(msg));
    this.state = 'connecting';
    this.emitConnectionChange(false);

    return new Promise<void>((resolve, reject) => {
      const corrId = this.generateCorrId();

      // Set a timer for the welcome response
      const timer = setTimeout(() => {
        this.pendingRequests.delete(corrId);
        // Reset state so connect() can be retried
        this.state = 'disconnected';
        this.emitConnectionChange(false);
        reject(noProviderError());
      }, this.timeoutMs);

      this.pendingRequests.set(corrId, {
        resolve: () => {
          this.state = 'connected';
          this.emitConnectionChange(true);
          resolve();
        },
        reject: (err) => {
          this.state = 'disconnected';
          this.emitConnectionChange(false);
          reject(err);
        },
        operation: 'connect',
        timer,
      });

      this.transport!.send({
        type: 'SSL_HELLO',
        protocolVersion: SHEETLINK_PROTOCOL_VERSION,
        tabId: this.tabId,
      });
    });
  }

  /**
   * Disconnect from the provider and release resources.
   */
  disconnect(): void {
    // Clear all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(noProviderError());
    }
    this.pendingRequests.clear();

    // Clear subscriptions
    this.subscriptions.clear();

    // Unsubscribe from transport
    if (this.unsubscribeTransport) {
      this.unsubscribeTransport();
      this.unsubscribeTransport = null;
    }

    // Close transport
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }

    this.state = 'disconnected';
    this.emitConnectionChange(false);
  }

  /** Whether the client is currently connected to a provider. */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Register a callback for connection state changes.
   * @returns Unsubscribe function.
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  // ─── Data Access ─────────────────────────────────────────────────────────

  /**
   * Get a single cell's data.
   * @param sheet - Sheet name (e.g., "Sheet1").
   * @param ref - A1-style cell reference (e.g., "B3").
   * @throws SheetLinkError on failure.
   */
  async getCellValue(sheet: string, ref: string): Promise<CellData> {
    return this.request<CellData>('getCellValue', { sheetName: sheet, ref });
  }

  /**
   * Get a range of cell data as a 2D array (row-major).
   * @param sheet - Sheet name (e.g., "Sheet1").
   * @param range - A1-style range (e.g., "A1:D10").
   * @throws SheetLinkError on failure.
   */
  async getRangeValues(sheet: string, range: string): Promise<CellData[][]> {
    return this.request<CellData[][]>('getRangeValues', { sheetName: sheet, range });
  }

  /**
   * Get the raw formula for a cell (or null if it's a literal).
   * @param sheet - Sheet name.
   * @param ref - A1-style cell reference.
   * @throws SheetLinkError on failure.
   */
  async getFormula(sheet: string, ref: string): Promise<string | null> {
    return this.request<string | null>('getFormula', { sheetName: sheet, ref });
  }

  /**
   * Get raw formulas for a range as a 2D array.
   * Cells without formulas have null.
   * @param sheet - Sheet name.
   * @param range - A1-style range.
   * @throws SheetLinkError on failure.
   */
  async getFormulas(sheet: string, range: string): Promise<(string | null)[][]> {
    return this.request<(string | null)[][]>('getFormulas', { sheetName: sheet, range });
  }

  /**
   * List all sheet names in the workbook.
   * @throws SheetLinkError on failure.
   */
  async listSheets(): Promise<string[]> {
    return this.request<string[]>('listSheets', {});
  }

  /**
   * Get the used range of a sheet as an A1-style range string.
   * Returns "" if the sheet is empty.
   * @param sheet - Sheet name.
   * @throws SheetLinkError on failure.
   */
  async getUsedRange(sheet: string): Promise<string> {
    return this.request<string>('getUsedRange', { sheetName: sheet });
  }

  /**
   * Get the cells that a formula references.
   * Returns an empty array for non-formula cells.
   * @param sheet - Sheet name.
   * @param ref - A1-style cell reference.
   * @throws SheetLinkError on failure.
   */
  async getDependencies(sheet: string, ref: string): Promise<CellRef[]> {
    return this.request<CellRef[]>('getDependencies', { sheetName: sheet, ref });
  }

  // ─── Subscriptions (Live Updates) ───────────────────────────────────────

  /**
   * Subscribe to live updates for a range.
   * The callback is invoked whenever the data in the range changes.
   * @param sheet - Sheet name.
   * @param range - A1-style range.
   * @param callback - Called with new data on changes.
   * @returns Unsubscribe function.
   */
  subscribe(sheet: string, range: string, callback: UpdateCallback): () => void {
    const subscriptionId = `sub-${++this.corrIdCounter}`;
    this.subscriptions.set(subscriptionId, { sheetName: sheet, range, callback });

    if (this.isConnected()) {
      this.transport!.send({
        type: 'SSL_SUBSCRIBE',
        subscriptionId,
        sheetName: sheet,
        range,
      });
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(subscriptionId);
      if (this.isConnected()) {
        this.transport!.send({
          type: 'SSL_UNSUBSCRIBE',
          subscriptionId,
        });
      }
    };
  }

  // ─── Range Picker ────────────────────────────────────────────────────────

  /**
   * Open the range picker in the provider tab and wait for the user to select.
   * The provider tab shows a modal dialog for visual range selection.
   * @param prompt - Optional prompt text shown in the picker dialog.
   * @returns The selected range string (e.g., "Sheet1!A1:D10").
   * @throws SheetLinkError if cancelled or timed out.
   */
  async pickRange(prompt?: string): Promise<string> {
    return this.request<string>('__pickRange', {} as SheetLinkRequestArgs, prompt);
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  /**
   * Send a request and wait for the response.
   */
  private request<T>(
    operation: string,
    args: SheetLinkRequestArgs,
    prompt?: string,
  ): Promise<T> {
    if (!this.transport || !this.isConnected()) {
      return Promise.reject(noProviderError());
    }

    const corrId = this.generateCorrId();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(corrId);
        reject(timeoutError(operation));
      }, this.timeoutMs);

      this.pendingRequests.set(corrId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        operation,
        timer,
      });

      // For range picker, send a special message type
      if (operation === '__pickRange') {
        this.transport!.send({
          type: 'SSL_PICK_RANGE_REQUEST',
          corrId,
          prompt,
        });
      } else {
        this.transport!.send({
          type: 'SSL_REQUEST',
          corrId,
          operation: operation as SheetLinkRequestArgs extends never ? never : any,
          args,
        });
      }
    });
  }

  /**
   * Handle incoming messages from the transport.
   */
  private handleMessage(message: SheetLinkMessage): void {
    switch (message.type) {
      case 'SSL_WELCOME':
        this.handleWelcome(message);
        break;
      case 'SSL_RESPONSE':
        this.handleResponse(message);
        break;
      case 'SSL_UPDATE':
        this.handleUpdate(message);
        break;
      case 'SSL_PICK_RANGE_RESULT':
        this.handlePickRangeResult(message);
        break;
      case 'SSL_PICK_RANGE_CANCEL':
        this.handlePickRangeCancel(message);
        break;
      // Ignore HELLO and SUBSCRIBE/UNSUBSCRIBE from other clients (client doesn't act as provider)
      default:
        break;
    }
  }

  /**
   * Handle WELCOME message (response to HELLO).
   */
  private handleWelcome(message: SheetLinkMessage & { type: 'SSL_WELCOME' }): void {
    // Check protocol version compatibility
    if (message.protocolVersion !== SHEETLINK_PROTOCOL_VERSION) {
      const pending = this.findPending('connect');
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(this.findPendingCorrId('connect'));
        pending.reject(protocolMismatchError(SHEETLINK_PROTOCOL_VERSION, message.protocolVersion));
      }
      return;
    }

    const pending = this.findPending('connect');
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingRequests.delete(this.findPendingCorrId('connect'));
      pending.resolve(undefined);

      // Re-send any subscriptions that were made before connection
      for (const [subscriptionId, sub] of this.subscriptions) {
        this.transport!.send({
          type: 'SSL_SUBSCRIBE',
          subscriptionId,
          sheetName: sub.sheetName,
          range: sub.range,
        });
      }
    }
  }

  /**
   * Handle RESPONSE message (success or error).
   */
  private handleResponse(message: SheetLinkSuccessResponseMessage | SheetLinkErrorResponseMessage): void {
    const pending = this.pendingRequests.get(message.corrId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.corrId);

    if (message.ok) {
      pending.resolve(message.result);
    } else {
      pending.reject(this.errorPayloadToError(message.error));
    }
  }

  /**
   * Handle UPDATE message (subscription data push).
   */
  private handleUpdate(message: SheetLinkUpdateMessage): void {
    const sub = this.subscriptions.get(message.subscriptionId);
    if (sub) {
      sub.callback(message.data);
    }
  }

  /**
   * Handle range picker result.
   */
  private handlePickRangeResult(message: SheetLinkPickRangeResultMessage): void {
    const pending = this.pendingRequests.get(message.corrId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.corrId);
    pending.resolve(message.range);
  }

  /**
   * Handle range picker cancel.
   */
  private handlePickRangeCancel(message: SheetLinkPickRangeCancelMessage): void {
    const pending = this.pendingRequests.get(message.corrId);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(message.corrId);
    pending.reject(pickCancelledError());
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private generateCorrId(): string {
    return `corr-${++this.corrIdCounter}-${Date.now()}`;
  }

  private findPending(operation: string): PendingRequest | undefined {
    for (const [, pending] of this.pendingRequests) {
      if (pending.operation === operation) return pending;
    }
    return undefined;
  }

  private findPendingCorrId(operation: string): string | undefined {
    for (const [corrId, pending] of this.pendingRequests) {
      if (pending.operation === operation) return corrId;
    }
    return undefined;
  }

  private errorPayloadToError(payload: { code: SheetLinkErrorCode; message: string; recoverable: boolean }): SheetLinkError {
    // Map known error codes to typed constructors
    switch (payload.code) {
      case 'NO_PROVIDER':
        return noProviderError();
      case 'TIMEOUT':
        return timeoutError('unknown');
      case 'INVALID_RANGE':
        return invalidRangeError('unknown');
      case 'SHEET_NOT_FOUND':
        return sheetNotFoundError('unknown');
      case 'INVALID_REF':
        return invalidRefError('unknown');
      case 'PROTOCOL_MISMATCH':
        return protocolMismatchError(SHEETLINK_PROTOCOL_VERSION, -1);
      case 'PICK_CANCELLED':
        return pickCancelledError();
      case 'NOT_AUTHORIZED':
        return notAuthorizedError();
      default:
        return new SheetLinkError(payload.code, payload.message, payload.recoverable);
    }
  }

  private emitConnectionChange(connected: boolean): void {
    for (const cb of this.connectionCallbacks) {
      cb(connected);
    }
  }
}

// ─── Default Export ───────────────────────────────────────────────────────────

export default SheetLinkClient;
