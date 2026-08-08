// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * @simplesheets/sheetlink
 *
 * Cross-tab data bridge for SimpleSheet.
 * Import SheetLinkClient in any same-origin app to read live spreadsheet data.
 */

export { SheetLinkClient } from './SheetLinkClient';
export type { UpdateCallback, ConnectionCallback, SheetLinkClientOptions } from './SheetLinkClient';

export { SheetLinkError } from './SheetLinkError';
export {
  noProviderError,
  timeoutError,
  invalidRangeError,
  sheetNotFoundError,
  invalidRefError,
  protocolMismatchError,
  pickCancelledError,
  notAuthorizedError,
} from './SheetLinkError';

export type {
  SheetLinkMessage,
  CellData,
  CellRef,
  SheetLinkOperation,
  SheetLinkErrorCode,
  SheetLinkErrorPayload,
} from './sheetLinkProtocol';

export { SHEETLINK_PROTOCOL_VERSION } from './sheetLinkProtocol';

export { BroadcastChannelTransport, createSheetLinkTransport } from './sheetLinkTransport';
export type { SheetLinkTransport } from './sheetLinkTransport';
