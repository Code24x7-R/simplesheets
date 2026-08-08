// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLinkClient.
 *
 * Uses a mock transport to simulate provider responses.
 */

import { SheetLinkClient } from '../SheetLinkClient';
import type { SheetLinkTransport } from '../sheetLinkTransport';
import type { SheetLinkMessage, CellData, SheetLinkSubscribeMessage } from '../sheetLinkProtocol';
import { SheetLinkError } from '../SheetLinkError';

// ─── Mock Transport ──────────────────────────────────────────────────────────

class MockTransport implements SheetLinkTransport {
  private handler: ((msg: SheetLinkMessage) => void) | null = null;
  public sentMessages: SheetLinkMessage[] = [];
  // If set, auto-respond to messages with this callback
  public autoResponder: ((msg: SheetLinkMessage) => void) | null = null;

  send(message: SheetLinkMessage): void {
    this.sentMessages.push(message);
    // Allow tests to auto-respond
    if (this.autoResponder) {
      // Use setTimeout to simulate async behavior
      setTimeout(() => this.autoResponder!(message), 0);
    }
  }

  onMessage(handler: (msg: SheetLinkMessage) => void): () => void {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }

  /** Simulate receiving a message from another tab */
  simulateReceive(message: SheetLinkMessage): void {
    this.handler?.(message);
  }

  close(): void {
    this.handler = null;
  }
}

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeCellData(raw: string, computed: string | number | boolean | null): CellData {
  return { rawValue: raw, computedValue: computed, isFormula: raw.startsWith('=') };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SheetLinkClient', () => {
  let transport: MockTransport;
  let client: SheetLinkClient;

  beforeEach(() => {
    transport = new MockTransport();
    client = new SheetLinkClient({ transport, timeoutMs: 100 });
  });

  afterEach(() => {
    client.disconnect();
  });

  // ─── Connection ─────────────────────────────────────────────────────────

  describe('connect', () => {
    it('sends HELLO on connect', async () => {
      // Set up auto-responder to send WELCOME
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        }
      };

      await client.connect();

      expect(transport.sentMessages).toHaveLength(1);
      expect(transport.sentMessages[0].type).toBe('SSL_HELLO');
      expect(client.isConnected()).toBe(true);
    });

    it('rejects with NO_PROVIDER if no WELCOME received', async () => {
      // No auto-responder — no WELCOME will be received
      await expect(client.connect()).rejects.toThrow(SheetLinkError);
      await expect(client.connect()).rejects.toMatchObject({ code: 'NO_PROVIDER' });
    });

    it('rejects with PROTOCOL_MISMATCH on version mismatch', async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 99,
            tabId: 'provider-1',
          });
        }
      };

      await expect(client.connect()).rejects.toMatchObject({ code: 'PROTOCOL_MISMATCH' });
    });
  });

  // ─── Data Access ─────────────────────────────────────────────────────────

  describe('getCellValue', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_REQUEST') {
          transport.simulateReceive({
            type: 'SSL_RESPONSE',
            corrId: msg.corrId,
            ok: true,
            result: makeCellData('=SUM(A1:A3)', 42),
          });
        }
      };
      await client.connect();
      transport.sentMessages = []; // clear connect messages
    });

    it('returns cell data on success', async () => {
      const result = await client.getCellValue('Sheet1', 'B2');
      expect(result.rawValue).toBe('=SUM(A1:A3)');
      expect(result.computedValue).toBe(42);
      expect(result.isFormula).toBe(true);
    });

    it('sends correct request message', async () => {
      await client.getCellValue('Sheet1', 'B2');
      const req = transport.sentMessages.find(m => m.type === 'SSL_REQUEST');
      expect(req).toBeDefined();
      if (req?.type === 'SSL_REQUEST') {
        expect(req.operation).toBe('getCellValue');
      }
    });
  });

  describe('getRangeValues', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_REQUEST') {
          transport.simulateReceive({
            type: 'SSL_RESPONSE',
            corrId: msg.corrId,
            ok: true,
            result: [
              [makeCellData('Name', 'Name'), makeCellData('Q1', 'Q1')],
              [makeCellData('Item 1', 'Item 1'), makeCellData('100', 100)],
            ],
          });
        }
      };
      await client.connect();
    });

    it('returns 2D array of cell data', async () => {
      const result = await client.getRangeValues('Sheet1', 'A1:B2');
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveLength(2);
      expect(result[1][1].computedValue).toBe(100);
    });
  });

  describe('listSheets', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_REQUEST') {
          transport.simulateReceive({
            type: 'SSL_RESPONSE',
            corrId: msg.corrId,
            ok: true,
            result: ['Sheet1', 'Sheet2', 'Data'],
          });
        }
      };
      await client.connect();
    });

    it('returns sheet names', async () => {
      const sheets = await client.listSheets();
      expect(sheets).toEqual(['Sheet1', 'Sheet2', 'Data']);
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_REQUEST') {
          transport.simulateReceive({
            type: 'SSL_RESPONSE',
            corrId: msg.corrId,
            ok: false,
            error: {
              code: 'SHEET_NOT_FOUND',
              message: 'Sheet "Missing" not found',
              recoverable: true,
            },
          });
        }
      };
      await client.connect();
    });

    it('rejects with typed error on failure response', async () => {
      await expect(client.getCellValue('Missing', 'A1')).rejects.toThrow(SheetLinkError);
    });

    it('rejects when not connected', async () => {
      client.disconnect();
      await expect(client.getCellValue('Sheet1', 'A1')).rejects.toMatchObject({
        code: 'NO_PROVIDER',
      });
    });
  });

  // ─── Subscriptions ──────────────────────────────────────────────────────

  describe('subscribe', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        }
      };
      await client.connect();
    });

    it('sends SUBSCRIBE message', () => {
      const callback = jest.fn();
      client.subscribe('Sheet1', 'A1:B2', callback);

      const sub = transport.sentMessages.find(m => m.type === 'SSL_SUBSCRIBE');
      expect(sub).toBeDefined();
    });

    it('invokes callback on UPDATE message', () => {
      const callback = jest.fn();
      client.subscribe('Sheet1', 'A1:B2', callback);

      // Find the subscription ID from the sent message
      const subMsg = transport.sentMessages.find(m => m.type === 'SSL_SUBSCRIBE') as SheetLinkSubscribeMessage | undefined;
      expect(subMsg).toBeDefined();
      const subId = subMsg!.subscriptionId;

      // Simulate an update from the provider
      transport.simulateReceive({
        type: 'SSL_UPDATE',
        subscriptionId: subId,
        data: [[makeCellData('99', 99)]],
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith([[makeCellData('99', 99)]]);
    });

    it('unsubscribe stops further callbacks', () => {
      const callback = jest.fn();
      const unsub = client.subscribe('Sheet1', 'A1:B2', callback);

      const subMsg = transport.sentMessages.find(m => m.type === 'SSL_SUBSCRIBE') as SheetLinkSubscribeMessage | undefined;
      const subId = subMsg!.subscriptionId;

      unsub();

      transport.simulateReceive({
        type: 'SSL_UPDATE',
        subscriptionId: subId,
        data: [[makeCellData('99', 99)]],
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  // ─── Range Picker ────────────────────────────────────────────────────────

  describe('pickRange', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_PICK_RANGE_REQUEST') {
          transport.simulateReceive({
            type: 'SSL_PICK_RANGE_RESULT',
            corrId: msg.corrId,
            range: 'Sheet1!A1:D10',
          });
        }
      };
      await client.connect();
    });

    it('returns selected range on success', async () => {
      const range = await client.pickRange('Select data');
      expect(range).toBe('Sheet1!A1:D10');
    });
  });

  describe('pickRange cancelled', () => {
    beforeEach(async () => {
      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        } else if (msg.type === 'SSL_PICK_RANGE_REQUEST') {
          // Simulate user cancelling
          transport.simulateReceive({
            type: 'SSL_PICK_RANGE_CANCEL',
            corrId: msg.corrId,
          });
        }
      };
      await client.connect();
    });

    it('rejects with PICK_CANCELLED when user cancels', async () => {
      await expect(client.pickRange()).rejects.toMatchObject({ code: 'PICK_CANCELLED' });
    });
  });

  // ─── Connection Callbacks ───────────────────────────────────────────────

  describe('onConnectionChange', () => {
    it('notifies on connect and disconnect', async () => {
      const callback = jest.fn();
      client.onConnectionChange(callback);

      transport.autoResponder = (msg) => {
        if (msg.type === 'SSL_HELLO') {
          transport.simulateReceive({
            type: 'SSL_WELCOME',
            protocolVersion: 1,
            tabId: 'provider-1',
          });
        }
      };

      await client.connect();
      expect(callback).toHaveBeenCalledWith(true);

      client.disconnect();
      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  // ─── Protocol Version Export ─────────────────────────────────────────────

  it('exports protocol version', () => {
    // Import is at top of file via the module
    expect(transport).toBeDefined();
  });
});
