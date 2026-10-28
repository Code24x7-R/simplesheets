// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { storeFileHandle, loadFileHandle, deleteFileHandle } from './handleStore';

/** Minimal in-memory IndexedDB shim for exercising the store. */
function installFakeIndexedDB() {
  class FakeRequest {
    result: unknown = undefined;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onblocked: (() => void) | null = null;
    onupgradeneeded: (() => void) | null = null;
  }

  class FakeObjectStore {
    data = new Map<string, unknown>();
    put(value: unknown, key: string): void { this.data.set(key, value); }
    get(key: string): FakeRequest {
      const req = new FakeRequest();
      req.result = this.data.get(key);
      queueMicrotask(() => req.onsuccess?.());
      return req;
    }
    delete(key: string): void { this.data.delete(key); }
  }

  class FakeTransaction {
    store: FakeObjectStore;
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    constructor(store: FakeObjectStore) { this.store = store; }
    objectStore(): FakeObjectStore { return this.store; }
  }

  class FakeDatabase {
    stores = new Map<string, FakeObjectStore>();
    objectStoreNames = {
      contains: (name: string) => this.stores.has(name),
    };
    createObjectStore(name: string): void {
      this.stores.set(name, new FakeObjectStore());
    }
    transaction(name: string): FakeTransaction {
      const store = this.stores.get(name) ?? new FakeObjectStore();
      const tx = new FakeTransaction(store);
      queueMicrotask(() => tx.oncomplete?.());
      return tx;
    }
  }

  const db = new FakeDatabase();
  const indexedDB = {
    open: () => {
      const req = new FakeRequest();
      req.result = db;
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).indexedDB = indexedDB;
  return db;
}

const fakeHandle = { getFile: jest.fn() } as unknown as FileSystemFileHandle;

describe('handleStore', () => {
  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).indexedDB;
  });

  it('degrades gracefully when IndexedDB is unavailable', async () => {
    expect(await storeFileHandle('h1', fakeHandle)).toBe(false);
    expect(await loadFileHandle('h1')).toBeNull();
    await expect(deleteFileHandle('h1')).resolves.toBeUndefined();
  });

  it('stores and loads a file handle', async () => {
    const db = installFakeIndexedDB();
    expect(await storeFileHandle('h1', fakeHandle)).toBe(true);
    expect(await loadFileHandle('h1')).toBe(fakeHandle);
    expect(db.stores.get('file-handles')?.data.has('h1')).toBe(true);
  });

  it('returns null for a missing handle', async () => {
    installFakeIndexedDB();
    expect(await loadFileHandle('missing')).toBeNull();
  });

  it('deletes a stored handle', async () => {
    const db = installFakeIndexedDB();
    await storeFileHandle('h1', fakeHandle);
    await deleteFileHandle('h1');
    expect(await loadFileHandle('h1')).toBeNull();
    expect(db.stores.get('file-handles')?.data.has('h1')).toBe(false);
  });
});
