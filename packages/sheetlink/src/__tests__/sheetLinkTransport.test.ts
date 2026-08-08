// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
/**
 * Unit tests for SheetLink BroadcastChannel transport.
 *
 * BroadcastChannel is available in jsdom test environment.
 */

import { BroadcastChannelTransport } from '../sheetLinkTransport';
import type { SheetLinkMessage } from '../sheetLinkProtocol';

describe('BroadcastChannelTransport', () => {
  let transport: BroadcastChannelTransport;

  afterEach(() => {
    if (transport) {
      transport.close();
    }
  });

  it('sends messages via BroadcastChannel', (done) => {
    const channelName = `test-channel-${Date.now()}`;
    const receiver = new BroadcastChannel(channelName);
    transport = new BroadcastChannelTransport(channelName);

    const testMsg: SheetLinkMessage = {
      type: 'SSL_HELLO',
      protocolVersion: 1,
      tabId: 'test-tab',
    };

    receiver.onmessage = (event: MessageEvent) => {
      expect(event.data).toEqual(testMsg);
      receiver.close();
      done();
    };

    transport.send(testMsg);
  });

  it('receives messages via onMessage handler', (done) => {
    const channelName = `test-channel-${Date.now()}-2`;
    const sender = new BroadcastChannel(channelName);
    transport = new BroadcastChannelTransport(channelName);

    const testMsg: SheetLinkMessage = {
      type: 'SSL_WELCOME',
      protocolVersion: 1,
      tabId: 'provider-1',
    };

    transport.onMessage((msg) => {
      expect(msg).toEqual(testMsg);
      sender.close();
      done();
    });

    // Give the handler time to register, then send
    setTimeout(() => {
      sender.postMessage(testMsg);
    }, 10);
  });

  it('returns unsubscribe function from onMessage', () => {
    const channelName = `test-channel-${Date.now()}-3`;
    transport = new BroadcastChannelTransport(channelName);

    const handler = jest.fn();
    const unsub = transport.onMessage(handler);

    // Call unsubscribe
    unsub();

    // Send a message — handler should NOT be called
    transport.send({
      type: 'SSL_HELLO',
      protocolVersion: 1,
      tabId: 'a',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('close releases the channel', () => {
    const channelName = `test-channel-${Date.now()}-4`;
    transport = new BroadcastChannelTransport(channelName);

    expect(() => transport.close()).not.toThrow();
    // After close, sending should not throw (BroadcastChannel handles it gracefully)
    expect(() => transport.send({
      type: 'SSL_HELLO',
      protocolVersion: 1,
      tabId: 'a',
    })).not.toThrow();
  });
});
