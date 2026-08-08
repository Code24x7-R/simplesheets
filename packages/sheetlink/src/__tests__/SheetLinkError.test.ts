// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLinkError hierarchy.
 */

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
} from '../SheetLinkError';

describe('SheetLinkError', () => {
  it('creates an error with code, message, and recoverable flag', () => {
    const err = new SheetLinkError('TIMEOUT', 'Request timed out', true);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(SheetLinkError);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toBe('Request timed out');
    expect(err.recoverable).toBe(true);
    expect(err.name).toBe('SheetLinkError');
  });

  it('has a stack trace', () => {
    const err = noProviderError();
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('SheetLinkError');
  });
});

describe('error constructors', () => {
  it('noProviderError creates recoverable NO_PROVIDER error', () => {
    const err = noProviderError();
    expect(err.code).toBe('NO_PROVIDER');
    expect(err.recoverable).toBe(true);
    expect(err.message).toContain('SimpleSheet');
  });

  it('timeoutError includes operation name', () => {
    const err = timeoutError('getCellValue');
    expect(err.code).toBe('TIMEOUT');
    expect(err.recoverable).toBe(true);
    expect(err.message).toContain('getCellValue');
  });

  it('invalidRangeError includes the range', () => {
    const err = invalidRangeError('bad range');
    expect(err.code).toBe('INVALID_RANGE');
    expect(err.message).toContain('bad range');
  });

  it('sheetNotFoundError includes the sheet name', () => {
    const err = sheetNotFoundError('MissingSheet');
    expect(err.code).toBe('SHEET_NOT_FOUND');
    expect(err.message).toContain('MissingSheet');
  });

  it('invalidRefError includes the ref', () => {
    const err = invalidRefError('bad ref');
    expect(err.code).toBe('INVALID_REF');
    expect(err.message).toContain('bad ref');
  });

  it('protocolMismatchError includes versions', () => {
    const err = protocolMismatchError(1, 2);
    expect(err.code).toBe('PROTOCOL_MISMATCH');
    expect(err.recoverable).toBe(false);
    expect(err.message).toContain('v1');
    expect(err.message).toContain('v2');
  });

  it('pickCancelledError creates recoverable PICK_CANCELLED error', () => {
    const err = pickCancelledError();
    expect(err.code).toBe('PICK_CANCELLED');
    expect(err.recoverable).toBe(true);
  });

  it('notAuthorizedError creates recoverable NOT_AUTHORIZED error', () => {
    const err = notAuthorizedError();
    expect(err.code).toBe('NOT_AUTHORIZED');
    expect(err.recoverable).toBe(true);
  });
});
