// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { renderHook, act } from '@testing-library/react';
import { useMRU } from './useMRU';
import { loadMRU } from '../utils/mru';

describe('useMRU', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with an empty list when no MRU exists', () => {
    const { result } = renderHook(() => useMRU());
    expect(result.current.entries).toEqual([]);
  });

  it('starts with existing entries from storage', () => {
    // Pre-populate storage directly
    localStorage.setItem('simplesheets:mru', JSON.stringify([
      { id: 'pre-existing', name: 'Existing.ssjson', size: 100, timestamp: 5000, source: 'local' },
    ]));

    // New hook instance should load the pre-populated entry
    const { result } = renderHook(() => useMRU());
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe('Existing.ssjson');
  });

  it('recordOpen adds an entry', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordOpen('Opened.ssjson', 2048, 'local');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe('Opened.ssjson');
    expect(result.current.entries[0].size).toBe(2048);
    expect(result.current.entries[0].source).toBe('local');
  });

  it('recordOpen with cloud provider metadata', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordOpen('CloudDoc.ssjson', 0, 'cloud', {
        provider: 'google',
        cloudFileId: 'drive-123',
      });
    });

    expect(result.current.entries[0].source).toBe('cloud');
    expect(result.current.entries[0].provider).toBe('google');
    expect(result.current.entries[0].cloudFileId).toBe('drive-123');
  });

  it('recordSave adds an entry', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordSave('Saved.ssjson', 4096, 'local');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe('Saved.ssjson');
    expect(result.current.entries[0].source).toBe('local');
  });

  it('recordSave with cloud provider metadata', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordSave('S3Doc.ssjson', 0, 'cloud', {
        provider: 's3',
        cloudFileId: 's3-key-456',
        path: 'documents/S3Doc.ssjson',
      });
    });

    expect(result.current.entries[0].source).toBe('cloud');
    expect(result.current.entries[0].provider).toBe('s3');
    expect(result.current.entries[0].path).toBe('documents/S3Doc.ssjson');
  });

  it('deduplicates entries with same name and source', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordOpen('Budget.ssjson', 100, 'local');
    });
    act(() => {
      result.current.recordOpen('Budget.ssjson', 200, 'local');
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].size).toBe(200);
  });

  it('remove deletes an entry by id', () => {
    const { result } = renderHook(() => useMRU());

    // Add two entries
    act(() => {
      result.current.recordOpen('Keep.ssjson', 100, 'local');
      result.current.recordOpen('Remove.ssjson', 200, 'local');
    });

    // After act, React has committed — read the fresh state
    const entriesAfterAdd = result.current.entries;
    expect(entriesAfterAdd).toHaveLength(2);
    const idToRemove = entriesAfterAdd.find((e) => e.name === 'Remove.ssjson')!.id;

    // Remove it
    act(() => {
      result.current.remove(idToRemove);
    });

    // Verify removal
    const entriesAfterRemove = result.current.entries;
    expect(entriesAfterRemove).toHaveLength(1);
    expect(entriesAfterRemove[0].name).toBe('Keep.ssjson');
  });

  it('clear removes all entries', () => {
    const { result } = renderHook(() => useMRU());

    act(() => {
      result.current.recordOpen('A.ssjson', 100, 'local');
    });
    act(() => {
      result.current.recordOpen('B.ssjson', 200, 'local');
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.entries).toEqual([]);
    expect(loadMRU()).toEqual([]);
  });

  it('refresh reloads from storage', () => {
    const { result } = renderHook(() => useMRU());

    // Mutate storage directly (simulating another tab)
    act(() => {
      result.current.recordOpen('First.ssjson', 100, 'local');
    });

    // Direct write to localStorage (bypassing the hook)
    localStorage.setItem('simplesheets:mru', JSON.stringify([
      { id: 'external', name: 'External.ssjson', size: 999, timestamp: 9999, source: 'cloud', provider: 'onedrive' },
    ]));

    act(() => {
      result.current.refresh();
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].name).toBe('External.ssjson');
    expect(result.current.entries[0].provider).toBe('onedrive');
  });

  it('registers a storage event listener on mount', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    renderHook(() => useMRU());

    // Verify the hook registered a 'storage' listener for cross-tab sync
    expect(addEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    addEventListenerSpy.mockRestore();
  });

  it('removes the storage event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useMRU());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
