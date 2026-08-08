// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * SheetLink Transport Layer
 *
 * Abstraction over the underlying cross-tab communication mechanism.
 * Currently implements BroadcastChannel (same-origin).
 */

import type { SheetLinkMessage } from './sheetLinkProtocol';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * Transport abstraction for SheetLink cross-tab communication.
 */
export interface SheetLinkTransport {
  /** Send a message to other tabs. */
  send(message: SheetLinkMessage): void;
  /** Register a handler for incoming messages. Returns an unsubscribe function. */
  onMessage(handler: (message: SheetLinkMessage) => void): () => void;
  /** Close the transport and release resources. */
  close(): void;
}

// ─── BroadcastChannel Implementation ─────────────────────────────────────────

/**
 * Transport implementation using the BroadcastChannel API.
 * Works for same-origin tabs in all modern browsers.
 */
export class BroadcastChannelTransport implements SheetLinkTransport {
  private channel: BroadcastChannel;
  private handler: ((message: SheetLinkMessage) => void) | null = null;

  constructor(channelName: string = 'simplesheets-link') {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event: MessageEvent) => {
      this.handler?.(event.data as SheetLinkMessage);
    };
  }

  send(message: SheetLinkMessage): void {
    this.channel.postMessage(message);
  }

  onMessage(handler: (message: SheetLinkMessage) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  close(): void {
    this.handler = null;
    this.channel.close();
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Creates the best available transport for the current environment.
 * @param channelName - The BroadcastChannel name to use.
 * @returns A SheetLinkTransport instance.
 */
export function createSheetLinkTransport(channelName: string = 'simplesheets-link'): SheetLinkTransport {
  return new BroadcastChannelTransport(channelName);
}
