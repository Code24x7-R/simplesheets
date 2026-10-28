// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  supportsFileSystemAccess,
  pickFileWithHandle,
  readFileFromHandle,
  pickFileWithInput,
} from './fileHandles';

function makeHandle(file: File, permission: PermissionState = 'granted'): FileSystemFileHandle {
  return {
    getFile: jest.fn().mockResolvedValue(file),
    queryPermission: jest.fn().mockResolvedValue(permission),
    requestPermission: jest.fn().mockResolvedValue(permission),
  } as unknown as FileSystemFileHandle;
}

describe('supportsFileSystemAccess', () => {
  afterEach(() => {
    delete (window as Partial<Window>).showOpenFilePicker;
  });

  it('returns false when showOpenFilePicker is missing', () => {
    expect(supportsFileSystemAccess()).toBe(false);
  });

  it('returns true when showOpenFilePicker exists', () => {
    (window as Partial<Window>).showOpenFilePicker = jest.fn();
    expect(supportsFileSystemAccess()).toBe(true);
  });
});

describe('pickFileWithHandle', () => {
  afterEach(() => {
    delete (window as Partial<Window>).showOpenFilePicker;
  });

  it('returns null when File System Access is unsupported', async () => {
    await expect(pickFileWithHandle()).resolves.toBeNull();
  });

  it('returns the picked file and handle', async () => {
    const file = new File(['{}'], 'budget.ssjson');
    const handle = makeHandle(file);
    (window as Partial<Window>).showOpenFilePicker = jest.fn().mockResolvedValue([handle]);

    const picked = await pickFileWithHandle();
    expect(picked?.file).toBe(file);
    expect(picked?.handle).toBe(handle);
  });

  it('returns null when no handle is returned', async () => {
    (window as Partial<Window>).showOpenFilePicker = jest.fn().mockResolvedValue([]);
    await expect(pickFileWithHandle()).resolves.toBeNull();
  });
});

describe('readFileFromHandle', () => {
  it('returns the file when permission is granted', async () => {
    const file = new File(['{}'], 'budget.ssjson');
    const handle = makeHandle(file, 'granted');
    await expect(readFileFromHandle(handle)).resolves.toBe(file);
  });

  it('requests permission when it is prompt, then returns the file', async () => {
    const file = new File(['{}'], 'budget.ssjson');
    const handle = makeHandle(file, 'granted');
    (handle.queryPermission as jest.Mock).mockResolvedValue('prompt');
    (handle.requestPermission as jest.Mock).mockResolvedValue('granted');

    await expect(readFileFromHandle(handle)).resolves.toBe(file);
    expect(handle.requestPermission).toHaveBeenCalled();
  });

  it('returns null when permission is denied', async () => {
    const file = new File(['{}'], 'budget.ssjson');
    const handle = makeHandle(file, 'denied');
    await expect(readFileFromHandle(handle)).resolves.toBeNull();
  });

  it('returns null when getFile throws', async () => {
    const handle = {
      getFile: jest.fn().mockRejectedValue(new Error('invalid state')),
      queryPermission: jest.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    await expect(readFileFromHandle(handle)).resolves.toBeNull();
  });
});

describe('pickFileWithInput', () => {
  it('creates a file input and invokes the callback on change', () => {
    const onFile = jest.fn();
    const file = new File(['{}'], 'budget.ssjson');

    const clickSpy = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function(this: HTMLInputElement) {
      Object.defineProperty(this, 'files', { value: [file] });
      this.onchange?.(new Event('change') as unknown as Event);
    });

    pickFileWithInput(onFile);

    expect(clickSpy).toHaveBeenCalled();
    expect(onFile).toHaveBeenCalledWith(file);
    clickSpy.mockRestore();
  });
});
