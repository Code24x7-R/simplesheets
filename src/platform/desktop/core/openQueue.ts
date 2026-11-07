// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * One-at-a-time open-intent queue.
 *
 * Main enqueues every open intent; the renderer acknowledges each one before
 * the next is delivered. This guarantees exactly one load per intent and keeps
 * a burst of command-line/second-instance opens from racing.
 *
 * Pure logic, unit-tested without Electron.
 */

export interface SequencedRequest {
  readonly seq: number;
}

/**
 * A FIFO queue that only releases a request when the renderer is ready and no
 * previous request is awaiting acknowledgement.
 */
export class OpenRequestQueue<T extends SequencedRequest> {
  private readonly pending: T[] = [];
  private active: T | null = null;
  private ready = false;

  /** Add a request to the queue. */
  enqueue(request: T): void {
    this.pending.push(request);
  }

  /** Update renderer readiness. */
  setReady(ready: boolean): void {
    this.ready = ready;
  }

  /**
   * Return the next request to deliver, or null when the renderer is not
   * ready or a previous request is still active.
   */
  takeNext(): T | null {
    if (!this.ready || this.active || this.pending.length === 0) return null;
    this.active = this.pending[0];
    return this.active;
  }

  /**
   * Acknowledge the active request.
   *
   * @param seq - Sequence number reported by the renderer.
   * @returns True when the sequence matched the active request.
   */
  ack(seq: number): boolean {
    if (!this.active || this.active.seq !== seq) return false;
    this.active = null;
    this.pending.shift();
    return true;
  }

  /** Drop the active marker without consuming the queued request (used on reload). */
  resetActive(): void {
    this.active = null;
  }

  /** Number of queued requests, including the active one. */
  get size(): number {
    return this.pending.length;
  }

  /** The active request, if any. */
  get activeRequest(): T | null {
    return this.active;
  }
}
