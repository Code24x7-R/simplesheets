// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Cloud storage provider types for the Save to Cloud / Open from Cloud workflow.
 *
 * The CloudStorageModal dispatches generically to providers through these
 * interfaces — each provider (Google Drive, OneDrive, S3-compatible) implements
 * the same CloudFile[] contract.
 */

/** Supported cloud storage providers. */
export type CloudProvider = 'google' | 'onedrive' | 's3';

/** A file entry returned by a cloud provider's listFiles(). */
export interface CloudFile {
  /** Provider-specific file identifier. */
  id: string;
  /** Display filename (e.g. "Budget.ssjson"). */
  name: string;
  /** ISO 8601 timestamp of the last modification. */
  modifiedTime: string;
}

/** Result of a share operation via the Web Share API. */
export type ShareResult = 'shared' | 'cancelled' | 'fallback';
