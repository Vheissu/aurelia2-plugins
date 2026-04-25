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
    transport.push({ channel: 'orders', type: 'order.created', payload: { id: 8 } });
    await flush();

    expect(allMessages).toHaveLength(1);
    expect(orderMessages).toHaveLength(1);
    expect(ignoredMessages).toHaveLength(0);
    expect(orderMessages[0].payload).toEqual({ id: 8 });

    await tearDown();
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
