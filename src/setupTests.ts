// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import '@testing-library/jest-dom';

// Mock navigator.clipboard for tests (jsdom doesn't provide it)
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
    readText: jest.fn(() => Promise.resolve('')),
  },
});

// ─── BroadcastChannel Polyfill for JSDOM ──────────────────────────────────────
// JSDOM does not implement BroadcastChannel. This in-memory polyfill
// allows tests to simulate cross-tab communication.
// Messages are delivered to all other channel instances with the same name,
// matching real BroadcastChannel behavior (no echo to sender).

if (typeof globalThis.BroadcastChannel === 'undefined') {
  interface PolyfillChannelInstance {
    name: string;
    onmessageHandler: ((event: MessageEvent) => void) | null;
    closed: boolean;
    messageHandlers: Set<(event: MessageEvent) => void>;
  }

  const channelInstances = new Map<string, Set<PolyfillChannelInstance>>();

  class BroadcastChannelPolyfill {
    name: string;
    private instance: PolyfillChannelInstance;

    constructor(name: string) {
      this.name = name;
      if (!channelInstances.has(name)) {
        channelInstances.set(name, new Set());
      }
      this.instance = { name, onmessageHandler: null, closed: false, messageHandlers: new Set() };
      channelInstances.get(name)!.add(this.instance);
    }

    postMessage(data: unknown): void {
      // Deliver to all OTHER instances on the same channel
      const instances = channelInstances.get(this.name);
      if (!instances) return;
      for (const inst of instances) {
        if (inst === this.instance || inst.closed) continue;
        // Call onmessage handler if set
        if (inst.onmessageHandler) {
          queueMicrotask(() => {
            if (!inst.closed && inst.onmessageHandler) {
              inst.onmessageHandler({ data } as MessageEvent);
            }
          });
        }
        // Call addEventListener('message') handlers
        for (const handler of inst.messageHandlers) {
          queueMicrotask(() => {
            if (!inst.closed) {
              handler({ data } as MessageEvent);
            }
          });
        }
      }
    }

    set onmessage(handler: ((event: MessageEvent) => void) | null) {
      this.instance.onmessageHandler = handler;
    }

    get onmessage(): ((event: MessageEvent) => void) | null {
      return this.instance.onmessageHandler;
    }

    addEventListener(type: string, handler: (event: MessageEvent) => void): void {
      if (type === 'message') {
        this.instance.messageHandlers.add(handler);
      }
    }

    removeEventListener(type: string, handler: (event: MessageEvent) => void): void {
      if (type === 'message') {
        this.instance.messageHandlers.delete(handler);
      }
    }

    close(): void {
      this.instance.closed = true;
      this.instance.messageHandlers.clear();
      channelInstances.get(this.name)?.delete(this.instance);
    }
  }

  globalThis.BroadcastChannel = BroadcastChannelPolyfill as unknown as typeof BroadcastChannel;
}
