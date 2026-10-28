// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * IndexedDB storage for retained File System Access handles.
 *
 * All operations degrade gracefully: when IndexedDB is unavailable (private
 * mode, some WebViews) they return null / false rather than throwing, so the
 * caller can fall back to a plain file picker.
 */

const DB_NAME = 'simplesheets';
const DB_VERSION = 1;
const STORE_NAME = 'file-handles';

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Persist a file handle under a unique id. */
export async function storeFileHandle(id: string, handle: FileSystemFileHandle): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(handle, id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Load a previously persisted file handle, or null. */
export async function loadFileHandle(id: string): Promise<FileSystemFileHandle | null> {
  const db = await openDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as FileSystemFileHandle | undefined) ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Delete a persisted file handle (best-effort). */
export async function deleteFileHandle(id: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch {
    // ignore
  }
}
