// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Atomic UTF-8/binary file writes.
 *
 * The data is written to a sibling temporary file, flushed to disk, then
 * renamed over the target. A failure leaves the original file untouched and
 * removes the temporary file.
 */

import { randomBytes } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';

/** File version captured after a successful write. */
export interface AtomicWriteStat {
  readonly mtimeMs: number;
  readonly size: number;
}

/**
 * Flush a directory entry on POSIX so the rename is durable. Windows does not
 * allow opening a directory for fsync through Node, so this is best-effort.
 *
 * @param directory - Directory containing the renamed file.
 */
async function syncDirectory(directory: string): Promise<void> {
  if (process.platform === 'win32') return;
  const handle = await fsp.open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Write a file atomically.
 *
 * @param filePath - Absolute target path.
 * @param data - UTF-8 text or binary bytes.
 * @returns The target's new mtime and size.
 */
export async function atomicWriteFile(
  filePath: string,
  data: string | Uint8Array,
): Promise<AtomicWriteStat> {
  const directory = path.dirname(filePath);
  const baseName = path.basename(filePath);
  const tempPath = path.join(
    directory,
    `.${baseName}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`,
  );

  let mode: number | undefined;
  try {
    mode = (await fsp.stat(filePath)).mode;
  } catch {
    mode = undefined;
  }

  let handle: fsp.FileHandle | undefined;
  try {
    handle = await fsp.open(tempPath, 'wx', 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;

    if (mode !== undefined) await fsp.chmod(tempPath, mode);
    await fsp.rename(tempPath, filePath);
    await syncDirectory(directory);

    const stat = await fsp.stat(filePath);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    // The temp file may already carry the target's read-only mode; make it
    // removable again before cleaning up.
    await fsp.chmod(tempPath, 0o600).catch(() => undefined);
    await fsp.unlink(tempPath).catch(() => undefined);
    throw error;
  }
}
