import { createFixture } from '@aurelia/testing';
import {
  AureliaRealtimeConfiguration,
  IRealtime,
  MemoryRealtimeTransport,
  type RealtimeEnvelope,
} from './../src/index';

async function flush(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('aurelia2-realtime', () => {
  test('queues outbound channel messages until the transport opens', async () => {
    const transport = new MemoryRealtimeTransport();
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaRealtimeConfiguration.configure({
        transportFactory: () => transport,
        queueWhileDisconnected: true,
      })]
    );

    await startPromise;
    const realtime = container.get(IRealtime);

    const envelope = await realtime.publish('orders', 'order.updated', { id: 7 });
    expect(realtime.getQueuedMessages()).toEqual([envelope]);
    expect(transport.sent).toEqual([]);

    await realtime.connect();

    expect(realtime.status).toBe('open');
    expect(realtime.getQueuedMessages()).toEqual([]);
    expect(JSON.parse(transport.sent[0]) as RealtimeEnvelope).toMatchObject({
      channel: 'orders',
      type: 'order.updated',
      payload: { id: 7 },
    });

    await tearDown();
    expect(transport.status).toBe('closed');
  });

  test('dispatches inbound messages to global and channel subscribers', async () => {
    const transport = new MemoryRealtimeTransport();
    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaRealtimeConfiguration.configure({ transportFactory: () => transport })]
    );

    await startPromise;
    const realtime = container.get(IRealtime);
    const allMessages: RealtimeEnvelope[] = [];
    const orderMessages: RealtimeEnvelope[] = [];
    const ignoredMessages: RealtimeEnvelope[] = [];

    realtime.onMessage((message) => allMessages.push(message));
    realtime.subscribe('orders', (message) => orderMessages.push(message));
    realtime.subscribe('chat', (message) => ignoredMessages.push(message));

    await realtime.connect();
    transport.push('null');
    transport.push('{');
    transport.push('{"channel": 123, "type": "invalid"}');
    transport.push({ channel: 'orders', type: 'order.created', payload: { id: 8 } });
    await flush();

    expect(allMessages).toHaveLength(1);
    expect(orderMessages).toHaveLength(1);
    expect(ignoredMessages).toHaveLength(0);
    expect(orderMessages[0].payload).toEqual({ id: 8 });

    await tearDown();
  });

  test('shares an in-flight connect, retries on rejection, and ignores retired transports', async () => {
    jest.useFakeTimers();
    const failing = new MemoryRealtimeTransport();
    jest.spyOn(failing, 'connect').mockRejectedValueOnce(new Error('Network failed'));
    const replacement = new MemoryRealtimeTransport();
    const createTransport = jest.fn(() => replacement).mockReturnValueOnce(failing);
    const fixture = await createFixture('<div></div>', {}, [
      AureliaRealtimeConfiguration.configure({ transportFactory: createTransport, reconnectDelay: 10 }),
    ]).started;
    const realtime = fixture.container.get(IRealtime);
    const onMessage = jest.fn();
    realtime.onMessage(onMessage);

    try {
      const first = realtime.connect();
      expect(realtime.connect()).toBe(first);
      await expect(first).rejects.toThrow('Network failed');
      expect(realtime.status).toBe('error');

      await jest.advanceTimersByTimeAsync(10);
      expect(createTransport).toHaveBeenCalledTimes(2);
      expect(realtime.status).toBe('open');
      failing.push({ channel: 'old', type: 'stale' });
      failing.close();
      expect(onMessage).not.toHaveBeenCalled();
      expect(realtime.status).toBe('open');

      replacement.close();
      await realtime.disconnect();
      await jest.advanceTimersByTimeAsync(10);
      expect(createTransport).toHaveBeenCalledTimes(2);
    } finally {
      await realtime.disconnect();
      await fixture.tearDown();
      jest.useRealTimers();
    }
  });

  test('keeps failed outbound messages queued for the next connection', async () => {
    const failing = new MemoryRealtimeTransport();
    jest.spyOn(failing, 'send').mockRejectedValueOnce(new Error('Send failed'));
    const replacement = new MemoryRealtimeTransport();
    const createTransport = jest.fn(() => replacement).mockReturnValueOnce(failing);
    const fixture = await createFixture('<div></div>', {}, [
      AureliaRealtimeConfiguration.configure({ transportFactory: createTransport, reconnect: false }),
    ]).started;
    const realtime = fixture.container.get(IRealtime);
    const first = await realtime.publish('orders', 'first');
    const second = await realtime.publish('orders', 'second');
    const circular: { self?: unknown } = {};
    circular.self = circular;
    await expect(realtime.publish('orders', 'invalid', circular)).rejects.toThrow();

    await realtime.connect();
    expect(realtime.status).toBe('error');
    expect(realtime.getQueuedMessages()).toEqual([first, second]);

    await realtime.connect();
    await flush();
    expect(replacement.sent.map((message) => JSON.parse(message))).toEqual([first, second]);
    expect(realtime.getQueuedMessages()).toEqual([]);
    await realtime.disconnect();
    await fixture.tearDown();
  });

  test('settles a WebSocket connection attempt if the socket closes before opening', async () => {
    const socket = new EventTarget();
    const createSocket = jest.spyOn(globalThis, 'WebSocket').mockImplementation(() => socket as WebSocket);
    const fixture = await createFixture('<div></div>', {}, [
      AureliaRealtimeConfiguration.configure({ url: 'wss://example.test', reconnect: false }),
    ]).started;
    const realtime = fixture.container.get(IRealtime);

    try {
      const connection = realtime.connect();
      await Promise.resolve();
      socket.dispatchEvent(new CloseEvent('close', { code: 1006 }));
      await expect(connection).rejects.toThrow('closed before opening');
      expect(realtime.status).toBe('closed');
    } finally {
      await fixture.tearDown();
      createSocket.mockRestore();
    }
  });

  test('reports status changes and reconnects after abnormal close', async () => {
    jest.useFakeTimers();
    const transports = [new MemoryRealtimeTransport(), new MemoryRealtimeTransport()];
    let created = 0;

    const { container, startPromise, tearDown } = createFixture(
      '<div></div>',
      class {},
      [AureliaRealtimeConfiguration.configure({
        reconnect: true,
        reconnectDelay: 25,
        maxReconnectAttempts: 1,
        transportFactory: () => transports[created++],
      })]
    );

    await startPromise;
    const realtime = container.get(IRealtime);
    const statuses: string[] = [];
    realtime.onStatus((status) => statuses.push(status));

    await realtime.connect();
    transports[0].close(1006, 'network');
    await Promise.resolve();

    expect(realtime.status).toBe('closed');
    jest.advanceTimersByTime(25);
    await Promise.resolve();
    await Promise.resolve();

    expect(created).toBe(2);
    expect(realtime.status).toBe('open');
    expect(statuses).toContain('connecting');
    expect(statuses).toContain('closed');

    jest.useRealTimers();
    await tearDown();
  });
});
