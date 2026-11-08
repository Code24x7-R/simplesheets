// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Richard Robertson
import { OpenRequestQueue } from './openQueue';

interface Item {
  seq: number;
  name: string;
}

function item(seq: number): Item {
  return { seq, name: `file-${seq}` };
}

describe('OpenRequestQueue', () => {
  it('holds requests until the renderer is ready', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.enqueue(item(1));
    expect(queue.takeNext()).toBeNull();
    queue.setReady(true);
    expect(queue.takeNext()).toEqual(item(1));
  });

  it('delivers exactly one request at a time', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.setReady(true);
    queue.enqueue(item(1));
    queue.enqueue(item(2));

    expect(queue.takeNext()?.seq).toBe(1);
    expect(queue.takeNext()).toBeNull();
    expect(queue.size).toBe(2);

    expect(queue.ack(1)).toBe(true);
    expect(queue.takeNext()?.seq).toBe(2);
    expect(queue.size).toBe(1);
  });

  it('rejects an acknowledgement for a different sequence', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.setReady(true);
    queue.enqueue(item(1));
    queue.takeNext();

    expect(queue.ack(2)).toBe(false);
    expect(queue.activeRequest?.seq).toBe(1);
    expect(queue.size).toBe(1);
  });

  it('rejects an acknowledgement when nothing is active', () => {
    const queue = new OpenRequestQueue<Item>();
    expect(queue.ack(1)).toBe(false);
  });

  it('does not consume the request when the active marker is reset', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.setReady(true);
    queue.enqueue(item(1));
    queue.takeNext();
    queue.resetActive();

    expect(queue.takeNext()?.seq).toBe(1);
    expect(queue.size).toBe(1);
  });

  it('stops delivering while not ready', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.setReady(true);
    queue.enqueue(item(1));
    queue.setReady(false);
    expect(queue.takeNext()).toBeNull();
    queue.setReady(true);
    expect(queue.takeNext()?.seq).toBe(1);
  });

  it('drains in order', () => {
    const queue = new OpenRequestQueue<Item>();
    queue.setReady(true);
    queue.enqueue(item(1));
    queue.enqueue(item(2));
    queue.enqueue(item(3));

    const delivered: number[] = [];
    for (let next = queue.takeNext(); next; next = queue.takeNext()) {
      delivered.push(next.seq);
      queue.ack(next.seq);
    }
    expect(delivered).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
  });
});
