// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import {
  supportsFileSystemAccess,
  pickFileWithHandle,
  readFileFromHandle,
  pickFileWithInput,
  supportsSaveFilePicker,
  saveWithFilePicker,
  serializeWorkbook,
  writeWorkbookToHandle,
} from './fileHandles';
import type { Workbook } from '../types';

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

describe('supportsSaveFilePicker', () => {
  afterEach(() => {
    delete (window as Partial<Window>).showSaveFilePicker;
  });

  it('returns false when showSaveFilePicker is missing', () => {
    expect(supportsSaveFilePicker()).toBe(false);
  });

  it('returns true when showSaveFilePicker exists', () => {
    (window as Partial<Window>).showSaveFilePicker = jest.fn();
    expect(supportsSaveFilePicker()).toBe(true);
  });
});

describe('saveWithFilePicker', () => {
  afterEach(() => {
    delete (window as Partial<Window>).showSaveFilePicker;
  });

  it('returns null when unsupported', async () => {
    await expect(saveWithFilePicker('budget.ssjson')).resolves.toBeNull();
  });

  it('returns the handle from the picker', async () => {
    const handle = { createWritable: jest.fn() } as unknown as FileSystemFileHandle;
    (window as Partial<Window>).showSaveFilePicker = jest.fn().mockResolvedValue(handle);
    await expect(saveWithFilePicker('budget.ssjson')).resolves.toBe(handle);
  });

  it('returns null when the user cancels', async () => {
    (window as Partial<Window>).showSaveFilePicker = jest.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(saveWithFilePicker('budget.ssjson')).resolves.toBeNull();
  });
});

describe('serializeWorkbook', () => {
  it('pretty-prints the workbook JSON', () => {
    const wb = { id: 'x', title: 'T', sheets: [], activeSheetIndex: 0 } as unknown as Workbook;
    expect(serializeWorkbook(wb)).toContain('\n');
  });
});

describe('writeWorkbookToHandle', () => {
  it('writes and closes the writable stream', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    const close = jest.fn().mockResolvedValue(undefined);
    const handle = {
      createWritable: jest.fn().mockResolvedValue({ write, close }),
    } as unknown as FileSystemFileHandle;

    await expect(writeWorkbookToHandle(handle, '{}')).resolves.toBe(true);
    expect(write).toHaveBeenCalledWith('{}');
    expect(close).toHaveBeenCalled();
  });

  it('returns false when writing fails', async () => {
    const handle = {
      createWritable: jest.fn().mockRejectedValue(new Error('denied')),
    } as unknown as FileSystemFileHandle;
    await expect(writeWorkbookToHandle(handle, '{}')).resolves.toBe(false);
  });
});
